// services/videoGenerator.js
// Service de génération automatique de vidéos explicatives pour ClearDoc.
// Pipeline : document -> scènes (IA) -> voix-off (ElevenLabs) -> composant Remotion (TSX) -> render MP4.
//
// Ce module n'importe PAS `remotion` : il se contente de générer du code TSX qui, lui,
// importe remotion. Le module reste donc importable même si remotion n'est pas installé.

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

// ============================================
// THÈMES VIDÉO
// Miroir backend de src/lib/videoThemes.ts (à garder synchronisé).
// Ne contient que ce dont le render a besoin.
// ============================================

const THEMES = {
  cleardoc: {
    bg: '#f8f9fa', bgGradient: '#f8f9fa', surface: '#ffffff', surfaceBorder: '#e2e8f0',
    textPrimary: '#1e293b', textSecondary: '#64748b', defaultAccent: '#dc2626',
    badgeBg: (a) => `${a}18`, badgeText: (a) => a, transition: 'slide',
  },
  arctic: {
    bg: '#f0f7ff', bgGradient: 'linear-gradient(135deg, #e8f4fd 0%, #f0f7ff 100%)',
    surface: '#ffffff', surfaceBorder: '#bfdbfe',
    textPrimary: '#1e293b', textSecondary: '#475569', defaultAccent: '#2563eb',
    badgeBg: (a) => `${a}15`, badgeText: (a) => a, transition: 'slide',
  },
  noir: {
    bg: '#0f172a', bgGradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    surface: '#1e293b', surfaceBorder: '#334155',
    textPrimary: '#f1f5f9', textSecondary: '#94a3b8', defaultAccent: '#dc2626',
    badgeBg: (a) => `${a}30`, badgeText: (a) => `${a}dd`, transition: 'fade',
  },
  doux: {
    bg: '#fdf4ff', bgGradient: 'linear-gradient(135deg, #fdf4ff 0%, #f0fdf4 100%)',
    surface: '#ffffff', surfaceBorder: '#e9d5ff',
    textPrimary: '#1e293b', textSecondary: '#6b7280', defaultAccent: '#d946ef',
    badgeBg: (a) => `${a}15`, badgeText: (a) => a, transition: 'fade',
  },
  foret: {
    bg: '#0f2417', bgGradient: 'linear-gradient(135deg, #0f2417 0%, #1a3a25 100%)',
    surface: '#1a3a25', surfaceBorder: '#2d6a40',
    textPrimary: '#f0fdf4', textSecondary: '#86efac', defaultAccent: '#16a34a',
    badgeBg: (a) => `${a}30`, badgeText: () => '#86efac', transition: 'slide',
  },
};

// Résout un thème + une couleur d'accent en un objet de couleurs prêtes à injecter.
function resolveTheme(themeId, accentColor) {
  const t = THEMES[themeId] || THEMES.cleardoc;
  const accent = (accentColor && /^#[0-9a-fA-F]{3,8}$/.test(accentColor)) ? accentColor : t.defaultAccent;
  return {
    accent,
    bg: t.bg,
    background: t.bgGradient || t.bg,
    surface: t.surface,
    surfaceBorder: t.surfaceBorder,
    textPrimary: t.textPrimary,
    textSecondary: t.textSecondary,
    badgeBg: t.badgeBg(accent),
    badgeText: t.badgeText(accent),
    transition: t.transition,
  };
}

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

const WATERMARK_SIZES = { small: 90, medium: 140, large: 200 };

// Construit le style CSS du watermark (coin fixe) à partir de position + taille.
function resolveWatermarkStyle(watermark) {
  const pos = watermark?.position || 'bottom-right';
  const height = WATERMARK_SIZES[watermark?.size] || WATERMARK_SIZES.medium;
  const vertical = pos.startsWith('top') ? 'top' : 'bottom';
  const horizontal = pos.endsWith('left') ? 'left' : 'right';
  return { position: 'absolute', [vertical]: 48, [horizontal]: 48, height, width: 'auto', opacity: 0.9, objectFit: 'contain' };
}

export function generateTSX({ titre, scenes, slug, videosDir, theme, watermark }) {
  fs.mkdirSync(videosDir, { recursive: true });

  const componentName = toPascalCase(slug);
  const totalFrames = scenes.reduce((sum, s) => sum + s.frames, 0);
  const themeColors = theme || resolveTheme('cleardoc', null);
  const watermarkEnabled = Boolean(watermark?.enabled);
  const watermarkStyle = resolveWatermarkStyle(watermark);

  // Pré-calcul des offsets de chaque scène pour éviter une accumulation mutable dans le rendu.
  let acc = 0;
  const scenesData = scenes.map(s => {
    const item = { id: s.id, titre: s.titre, voix: s.voix, frames: s.frames, from: acc, file: s.filename };
    acc += s.frames;
    return item;
  });

  // Les textes issus de l'IA et les couleurs du thème sont injectés via JSON.stringify :
  // aucune interpolation directe de chaîne dans le code généré (sécurité + robustesse).
  const tsx = `// Généré automatiquement par ClearDoc Video Generator — ne pas éditer à la main.
import React from 'react';
import {
  AbsoluteFill, Audio, Img, Sequence, staticFile,
  useCurrentFrame, useVideoConfig, interpolate, spring, Easing,
} from 'remotion';

const SCENES = ${JSON.stringify(scenesData, null, 2)};
const VIDEO_TITLE = ${JSON.stringify(titre)};
const THEME = ${JSON.stringify(themeColors, null, 2)};
const ACCENT = ${JSON.stringify(themeColors.accent)};
const TOTAL_FRAMES = ${totalFrames};
const WATERMARK = ${watermarkEnabled};
const WM_STYLE = ${JSON.stringify(watermarkStyle)};

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

const Scene: React.FC<{ titre: string; voix: string; file: string; sceneFrames: number }> = ({ titre, voix, file, sceneFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Transition d'entrée/sortie de la scène
  const inOut = interpolate(frame, [0, 18, sceneFrames - 18, sceneFrames], [0, 1, 1, 0], clamp);
  const slideX = THEME.transition === 'slide'
    ? interpolate(frame, [0, 20], [60, 0], { ...clamp, easing: Easing.out(Easing.cubic) })
    : 0;

  // Animations internes
  const badgeOpacity = interpolate(frame, [5, 20], [0, 1], clamp);
  const badgeY = interpolate(frame, [5, 20], [16, 0], clamp);
  const cardSpring = spring({ frame: frame - 12, fps, config: { damping: 16, stiffness: 110 } });
  const cardY = interpolate(cardSpring, [0, 1], [50, 0]);
  const textOpacity = interpolate(frame, [22, 42], [0, 1], clamp);

  return (
    <AbsoluteFill
      style={{
        background: THEME.background,
        opacity: inOut,
        transform: \`translateX(\${slideX}px)\`,
        padding: '56px 96px',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <Audio src={staticFile(\`audio/\${file}\`)} />

      {/* Badge titre */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, opacity: badgeOpacity, transform: \`translateY(\${badgeY}px)\` }}>
        <div style={{ width: 6, height: 34, background: ACCENT, borderRadius: 3 }} />
        <div
          style={{
            background: THEME.badgeBg,
            color: THEME.badgeText,
            border: \`2px solid \${ACCENT}40\`,
            fontSize: 24,
            fontWeight: 700,
            fontFamily: 'Arial, sans-serif',
            padding: '8px 24px',
            borderRadius: 999,
          }}
        >
          {titre}
        </div>
      </div>

      {/* Card contenu */}
      <div
        style={{
          background: THEME.surface,
          border: \`2px solid \${THEME.surfaceBorder}\`,
          borderRadius: 20,
          padding: '40px 52px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
          transform: \`translateY(\${cardY}px)\`,
          opacity: Math.min(1, cardSpring),
        }}
      >
        <div style={{ fontSize: 36, color: THEME.textPrimary, fontFamily: 'Arial, sans-serif', lineHeight: 1.6, opacity: textOpacity }}>
          {voix}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const ${componentName}: React.FC = () => {
  const frame = useCurrentFrame();
  const globalProgress = Math.min(1, frame / TOTAL_FRAMES);
  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg }}>
      {SCENES.map((scene) => (
        <Sequence key={scene.id} from={scene.from} durationInFrames={scene.frames}>
          <Scene titre={scene.titre} voix={scene.voix} file={scene.file} sceneFrames={scene.frames} />
        </Sequence>
      ))}

      {/* Barre de progression globale */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: 6,
            width: \`\${globalProgress * 100}%\`,
            background: ACCENT,
            borderRadius: '0 4px 4px 0',
          }}
        />
      </AbsoluteFill>

      {/* Watermark — incrusté dans un coin fixe, sur toutes les scènes */}
      {WATERMARK && (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          <Img src={staticFile('branding/watermark.png')} style={WM_STYLE} />
        </AbsoluteFill>
      )}
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

// Render asynchrone (NE JAMAIS bloquer la boucle d'événements Node : le serveur
// sert aussi le frontend). Timeout pour éviter tout gel permanent si Chromium
// ne se lance pas.
export function renderVideo({ componentName, slug, projectRoot, onLog, timeoutMs = 12 * 60 * 1000 }) {
  return new Promise((resolve, reject) => {
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

    const proc = spawn('npx', args, { cwd: projectRoot });
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill('SIGKILL');
      reject(new Error(`Render Remotion interrompu (timeout ${Math.round(timeoutMs / 60000)} min)`));
    }, timeoutMs);

    proc.stdout.on('data', d => onLog?.(d.toString()));
    proc.stderr.on('data', d => { stderr += d.toString(); onLog?.(d.toString()); });

    proc.on('error', err => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Impossible de lancer Remotion: ${err.message}`));
    });

    proc.on('close', code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error(`Échec du render Remotion (code ${code}): ${stderr.slice(-800)}`));
      }
      const abs = path.join(projectRoot, output);
      if (!fs.existsSync(abs)) return reject(new Error('Le fichier vidéo n\'a pas été produit'));
      resolve(abs);
    });
  });
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
export async function generateVideoForDocument({ doc, getSetting, send, projectRoot, theme, accentColor }) {
  const videosCodeDir = path.join(projectRoot, 'src', 'videos');
  const rootPath = path.join(projectRoot, 'src', 'Root.tsx');
  const audioDir = path.join(projectRoot, 'data', 'audio');

  // Thème : valeur de la requête > réglage en base > défaut
  const themeId = theme || getSetting('VIDEO_THEME') || 'cleardoc';
  const accent = accentColor || getSetting('VIDEO_ACCENT_COLOR') || null;
  const resolvedTheme = resolveTheme(themeId, accent);

  // Watermark : présence du fichier + position/taille en base
  const watermark = {
    enabled: fs.existsSync(path.join(projectRoot, 'data', 'branding', 'watermark.png')),
    position: getSetting('VIDEO_WATERMARK_POSITION') || 'bottom-right',
    size: getSetting('VIDEO_WATERMARK_SIZE') || 'medium',
  };

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
  const { componentName } = generateTSX({ titre, scenes: scenesWithAudio, slug, videosDir: videosCodeDir, theme: resolvedTheme, watermark });
  updateRoot({ videosDir: videosCodeDir, rootPath });
  send('tsx', 'Composant vidéo créé', 70);

  // Étape 4 — Render (asynchrone, ne bloque pas la boucle d'événements)
  send('render', 'Render vidéo en cours (~2-3 min)...', 75);
  await renderVideo({ componentName, slug, projectRoot });
  send('render', 'Vidéo rendue', 90);

  const videoUrl = `/data/videos/${slug}.mp4`;
  return { videoUrl, slug };
}
