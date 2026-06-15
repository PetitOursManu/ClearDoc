// services/videoGenerator.js
// Service de génération automatique de vidéos explicatives pour ClearDoc.
// Pipeline : document -> scènes (IA) -> voix-off (ElevenLabs) -> composant Remotion (TSX) -> render MP4.
//
// Ce module n'importe PAS `remotion` : il se contente de générer du code TSX qui, lui,
// importe remotion. Le module reste donc importable même si remotion n'est pas installé.

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

// ============================================
// UTILITAIRES
// ============================================

export function slugify(str) {
  const base = String(str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return base || 'video';
}

export function stripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function mp3ToFrames(filePath, fps = FPS, margin = FPS) {
  const size = fs.statSync(filePath).size;
  // Estimation de la durée à partir d'un débit de 128 kbps.
  return Math.ceil((size / (128 * 1024 / 8)) * fps) + margin;
}

export function toPascalCase(slug) {
  const name = String(slug || '')
    .split('_')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  // Un identifiant JS doit commencer par une lettre.
  return /^[A-Za-z]/.test(name) ? name : `V${name || 'ideo'}`;
}

// ============================================
// ÉTAPE 1 — GÉNÉRATION DES SCÈNES (IA compatible OpenAI)
// ============================================

export async function generateScenes({ titre, description, apiKey, baseUrl, model }) {
  if (!apiKey) throw new Error('Clé API IA manquante (AI_API_KEY)');

  const url = `${(baseUrl || 'https://api.deepseek.com/v1').replace(/\/$/, '')}/chat/completions`;

  const prompt = `Tu es un assistant qui crée des vidéos pédagogiques pour expliquer les fiches de paie à des travailleurs d'ESAT.

TITRE : ${titre}
DESCRIPTION : ${description}

Ta mission : découper ce contenu en 2 à 4 scènes pédagogiques.

RÈGLES ABSOLUES :
- Scène 1 : introduction courte (2-3 phrases max)
- Scènes suivantes : une idée par scène
- Dernière scène : résumé factuel et neutre
- Ton pédagogique, simple, bienveillant
- Préciser que les chiffres sont des exemples
- Texte en français

INTERDICTIONS STRICTES — ne jamais inclure :
- Messages politiques, patriotiques ou civiques
- "contribuer à la vie du pays", "pilier de la société", "fier de travailler pour la France"
- Références à la nation, la République, la citoyenneté
- Jugements de valeur sur le rôle social du travailleur
- Liens URL, adresses de sites web, noms de domaine
- Rester strictement factuel sur le contenu de la fiche de paie

Répondre UNIQUEMENT en JSON valide sans markdown :
{"scenes":[{"id":"scene1","titre":"Titre court","voix":"Texte voix-off."}]}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model || 'deepseek-chat',
      max_tokens: 1500,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const txt = await response.text().catch(() => '');
    throw new Error(`Erreur API IA (${response.status}): ${txt.slice(0, 300)}`);
  }

  const data = await response.json();
  let content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Réponse IA vide');

  // Nettoyer un éventuel bloc markdown ```json ... ```
  content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Réponse IA non parsable en JSON');
    parsed = JSON.parse(match[0]);
  }

  const scenes = parsed?.scenes;
  if (!Array.isArray(scenes) || scenes.length === 0) {
    throw new Error('Aucune scène générée par l\'IA');
  }

  return scenes.map((s, i) => ({
    id: slugify(s.id || `scene${i + 1}`),
    titre: String(s.titre || `Scène ${i + 1}`),
    voix: String(s.voix || '').trim(),
  })).filter(s => s.voix.length > 0);
}

// ============================================
// ÉTAPE 2 — GÉNÉRATION AUDIO (ElevenLabs)
// ============================================

export async function generateAudio({ scenes, slug, apiKey, voiceId, audioDir }) {
  if (!apiKey) throw new Error('Clé API ElevenLabs manquante (ELEVENLABS_API_KEY)');
  fs.mkdirSync(audioDir, { recursive: true });

  const voice = voiceId || 'O31r762Gb3WFygrEOGh0';
  const results = [];

  for (const scene of scenes) {
    const filename = `${slug}_${scene.id}.mp3`;
    const filepath = path.join(audioDir, filename);

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: scene.voix,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Erreur ElevenLabs (${res.status}): ${txt.slice(0, 300)}`);
    }

    fs.writeFileSync(filepath, Buffer.from(await res.arrayBuffer()));
    results.push({ ...scene, filename, filepath, frames: mp3ToFrames(filepath) });
  }

  return results;
}

// ============================================
// ÉTAPE 3 — GÉNÉRATION DU COMPOSANT REMOTION (TSX)
// ============================================

export function generateTSX({ titre, scenes, slug, videosDir }) {
  fs.mkdirSync(videosDir, { recursive: true });

  const componentName = toPascalCase(slug);
  const totalFrames = scenes.reduce((sum, s) => sum + s.frames, 0);

  // Pré-calcul des offsets de chaque scène pour éviter une accumulation mutable dans le rendu.
  let acc = 0;
  const scenesData = scenes.map(s => {
    const item = { id: s.id, titre: s.titre, voix: s.voix, frames: s.frames, from: acc, file: s.filename };
    acc += s.frames;
    return item;
  });

  // Les textes issus de l'IA sont injectés via JSON.stringify : aucune interpolation directe
  // de chaîne dans le code généré (sécurité + robustesse).
  const tsx = `// Généré automatiquement par ClearDoc Video Generator — ne pas éditer à la main.
import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, interpolate } from 'remotion';

const SCENES = ${JSON.stringify(scenesData, null, 2)};
const VIDEO_TITLE = ${JSON.stringify(titre)};

const SceneView: React.FC<{ titre: string; voix: string; index: number }> = ({ titre, voix, index }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const translateY = interpolate(frame, [0, 20], [30, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 120,
      }}
    >
      <div style={{ opacity, transform: \`translateY(\${translateY}px)\`, textAlign: 'center', maxWidth: 1500 }}>
        <div style={{ fontSize: 36, color: '#93c5fd', fontFamily: 'sans-serif', marginBottom: 30, fontWeight: 600 }}>
          {VIDEO_TITLE} · Scène {index + 1}
        </div>
        <h1 style={{ fontSize: 72, color: 'white', fontFamily: 'sans-serif', fontWeight: 800, marginBottom: 50, lineHeight: 1.1 }}>
          {titre}
        </h1>
        <p style={{ fontSize: 42, color: '#e2e8f0', fontFamily: 'sans-serif', lineHeight: 1.5 }}>
          {voix}
        </p>
      </div>
    </AbsoluteFill>
  );
};

export const ${componentName}: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0f172a' }}>
      {SCENES.map((scene, i) => (
        <Sequence key={scene.id} from={scene.from} durationInFrames={scene.frames}>
          <SceneView titre={scene.titre} voix={scene.voix} index={i} />
          <Audio src={staticFile(\`audio/\${scene.file}\`)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const ${componentName}Meta = {
  id: ${JSON.stringify(componentName)},
  durationInFrames: ${totalFrames},
  fps: ${FPS},
  width: ${WIDTH},
  height: ${HEIGHT},
  title: VIDEO_TITLE,
  slug: ${JSON.stringify(slug)},
};
`;

  fs.writeFileSync(path.join(videosDir, `${slug}.tsx`), tsx, 'utf-8');
  return { componentName, totalFrames };
}

// ============================================
// ÉTAPE 4 — RÉGÉNÉRATION DU Root.tsx
// ============================================

export function updateRoot({ videosDir, rootPath }) {
  const files = fs.existsSync(videosDir)
    ? fs.readdirSync(videosDir).filter(f => f.endsWith('.tsx'))
    : [];

  const entries = files.map(f => {
    const slug = f.replace(/\.tsx$/, '');
    return { slug, name: toPascalCase(slug) };
  });

  const imports = entries
    .map(e => `import { ${e.name}, ${e.name}Meta } from './videos/${e.slug}';`)
    .join('\n');

  const comps = entries
    .map(e =>
      `      <Composition id={${e.name}Meta.id} component={${e.name}} ` +
      `durationInFrames={${e.name}Meta.durationInFrames} fps={${e.name}Meta.fps} ` +
      `width={${e.name}Meta.width} height={${e.name}Meta.height} />`)
    .join('\n');

  const root = `// Généré automatiquement par ClearDoc Video Generator — ne pas éditer à la main.
import React from 'react';
import { Composition, registerRoot } from 'remotion';
${imports}

const RemotionRoot: React.FC = () => {
  return (
    <>
${comps}
    </>
  );
};

registerRoot(RemotionRoot);
`;

  fs.writeFileSync(rootPath, root, 'utf-8');
}

// ============================================
// ÉTAPE 5 — RENDER REMOTION
// ============================================

export function renderVideo({ componentName, slug, projectRoot }) {
  const output = path.join('data', 'videos', `${slug}.mp4`);
  const args = [
    'remotion', 'render', 'src/Root.tsx', componentName, output,
    '--codec=h264',
    '--crf=1',
    '--pixel-format=yuv420p',
    '--image-format=png',
    '--scale=1.5',
    '--public-dir=data',
    '--log=error',
  ];

  const result = spawnSync('npx', args, {
    cwd: projectRoot,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`Impossible de lancer Remotion: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const out = (result.stderr || result.stdout || '').slice(-800);
    throw new Error(`Échec du render Remotion (code ${result.status}): ${out}`);
  }

  const abs = path.join(projectRoot, output);
  if (!fs.existsSync(abs)) throw new Error('Le fichier vidéo n\'a pas été produit');
  return abs;
}

// ============================================
// ORCHESTRATEUR
// ============================================

/**
 * Pipeline complet de génération d'une vidéo pour un document.
 * @param {object} params
 * @param {object} params.doc       Ligne `documents` (id, title, description, ...)
 * @param {function} params.getSetting  (key) => string|null
 * @param {function} params.send    (step, message, progress) => void  (SSE)
 * @param {string} params.projectRoot   Racine du projet ClearDoc (__dirname du server)
 * @returns {Promise<{ videoUrl: string, slug: string }>}
 */
export async function generateVideoForDocument({ doc, getSetting, send, projectRoot }) {
  const videosCodeDir = path.join(projectRoot, 'src', 'videos');
  const rootPath = path.join(projectRoot, 'src', 'Root.tsx');
  const audioDir = path.join(projectRoot, 'data', 'audio');

  // Vérification préalable : Remotion installé ?
  if (!fs.existsSync(path.join(projectRoot, 'node_modules', 'remotion'))) {
    throw new Error('Remotion n\'est pas installé. Installez-le depuis l\'interface avant de générer une vidéo.');
  }

  const titre = doc.title || 'Document';
  const description = stripHtml(doc.description);
  const slug = `${slugify(titre)}_${slugify(String(doc.id)).slice(0, 8)}`;

  send('fetch', `Document "${titre}" récupéré`, 10);

  // Étape 1 — Scènes via IA
  send('ai', 'Génération des scènes avec IA...', 20);
  const scenes = await generateScenes({
    titre,
    description,
    apiKey: getSetting('AI_API_KEY'),
    baseUrl: getSetting('AI_API_BASE_URL'),
    model: getSetting('AI_MODEL'),
  });
  send('ai', `${scenes.length} scènes générées`, 35);

  // Étape 2 — Audio via ElevenLabs
  send('audio', 'Génération de la voix-off...', 40);
  const scenesWithAudio = await generateAudio({
    scenes,
    slug,
    apiKey: getSetting('ELEVENLABS_API_KEY'),
    voiceId: getSetting('ELEVENLABS_VOICE_ID'),
    audioDir,
  });
  send('audio', 'Fichiers audio créés', 60);

  // Étape 3 — Composant TSX + Root.tsx
  send('tsx', 'Génération du composant vidéo...', 65);
  const { componentName } = generateTSX({ titre, scenes: scenesWithAudio, slug, videosDir: videosCodeDir });
  updateRoot({ videosDir: videosCodeDir, rootPath });
  send('tsx', 'Composant vidéo créé', 70);

  // Étape 4 — Render
  send('render', 'Render vidéo en cours (~2-3 min)...', 75);
  renderVideo({ componentName, slug, projectRoot });
  send('render', 'Vidéo rendue', 90);

  const videoUrl = `/data/videos/${slug}.mp4`;
  return { videoUrl, slug };
}
