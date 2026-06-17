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

// Packs de style par "variant" : chaque variant change le fond, les formes,
// la police et le ressenti des animations (pas seulement les couleurs).
const VARIANT_STYLES = {
  modern: {
    bgKind: 'blobs', font: 'Arial, sans-serif',
    iconKind: 'circle', iconRadius: '50%', iconBorder: 3, iconGlow: 0.14, iconFill: false,
    badgeKind: 'pill', badgeMono: false, badgeUpper: false, badgeLetter: 0,
    spring: { damping: 12, stiffness: 130, mass: 0.7 }, enterX: 70, pulse: true,
  },
  cyber: {
    bgKind: 'grid', font: '"Courier New", ui-monospace, monospace',
    iconKind: 'square', iconRadius: 16, iconBorder: 2, iconGlow: 0.6, iconFill: false,
    badgeKind: 'bracket', badgeMono: true, badgeUpper: true, badgeLetter: 4,
    spring: { damping: 200, stiffness: 200, mass: 0.6 }, enterX: 50, pulse: true,
  },
  curvy: {
    bgKind: 'waves', font: 'Arial, sans-serif',
    iconKind: 'squircle', iconRadius: '42% 58% 56% 44% / 48% 42% 58% 52%', iconBorder: 0, iconGlow: 0.32, iconFill: true,
    badgeKind: 'pill', badgeMono: false, badgeUpper: false, badgeLetter: 0,
    spring: { damping: 8, stiffness: 120, mass: 0.9 }, enterX: 90, pulse: false,
  },
  minimal: {
    bgKind: 'plain', font: 'Arial, sans-serif',
    iconKind: 'bare', iconRadius: '50%', iconBorder: 0, iconGlow: 0, iconFill: false,
    badgeKind: 'underline', badgeMono: false, badgeUpper: true, badgeLetter: 2,
    spring: { damping: 200, stiffness: 120, mass: 1 }, enterX: 0, pulse: false,
  },
};

const THEMES = {
  cleardoc: {
    variant: 'modern',
    bg: '#f8f9fa', bgGradient: '#f8f9fa', surface: '#ffffff', surfaceBorder: '#e2e8f0',
    textPrimary: '#1e293b', textSecondary: '#64748b', defaultAccent: '#dc2626',
    badgeBg: (a) => `${a}18`, badgeText: (a) => a, transition: 'slide',
  },
  moderne: {
    variant: 'modern',
    bg: '#f5f7fb', bgGradient: 'linear-gradient(135deg, #eef2ff 0%, #f5f7fb 100%)',
    surface: '#ffffff', surfaceBorder: '#e2e8f0',
    textPrimary: '#0f172a', textSecondary: '#64748b', defaultAccent: '#6366f1',
    badgeBg: (a) => `${a}16`, badgeText: (a) => a, transition: 'slide',
  },
  arctic: {
    variant: 'modern',
    bg: '#f0f7ff', bgGradient: 'linear-gradient(135deg, #e8f4fd 0%, #f0f7ff 100%)',
    surface: '#ffffff', surfaceBorder: '#bfdbfe',
    textPrimary: '#1e293b', textSecondary: '#475569', defaultAccent: '#2563eb',
    badgeBg: (a) => `${a}15`, badgeText: (a) => a, transition: 'slide',
  },
  noir: {
    variant: 'modern',
    bg: '#0f172a', bgGradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    surface: '#1e293b', surfaceBorder: '#334155',
    textPrimary: '#f1f5f9', textSecondary: '#94a3b8', defaultAccent: '#dc2626',
    badgeBg: (a) => `${a}30`, badgeText: (a) => `${a}dd`, transition: 'fade',
  },
  doux: {
    variant: 'modern',
    bg: '#fdf4ff', bgGradient: 'linear-gradient(135deg, #fdf4ff 0%, #f0fdf4 100%)',
    surface: '#ffffff', surfaceBorder: '#e9d5ff',
    textPrimary: '#1e293b', textSecondary: '#6b7280', defaultAccent: '#d946ef',
    badgeBg: (a) => `${a}15`, badgeText: (a) => a, transition: 'fade',
  },
  foret: {
    variant: 'modern',
    bg: '#0f2417', bgGradient: 'linear-gradient(135deg, #0f2417 0%, #1a3a25 100%)',
    surface: '#1a3a25', surfaceBorder: '#2d6a40',
    textPrimary: '#f0fdf4', textSecondary: '#86efac', defaultAccent: '#16a34a',
    badgeBg: (a) => `${a}30`, badgeText: () => '#86efac', transition: 'slide',
  },
  cyber: {
    variant: 'cyber',
    bg: '#05060a', bgGradient: 'linear-gradient(135deg, #05060a 0%, #0a0f1f 100%)',
    surface: '#0c1424', surfaceBorder: '#1f2a44',
    textPrimary: '#e2f6ff', textSecondary: '#7dd3fc', defaultAccent: '#22d3ee',
    badgeBg: (a) => `${a}22`, badgeText: (a) => a, transition: 'fade',
  },
  courbe: {
    variant: 'curvy',
    bg: '#15102e', bgGradient: 'linear-gradient(135deg, #1e1147 0%, #3a1d6e 100%)',
    surface: '#ffffff', surfaceBorder: '#e9d5ff',
    textPrimary: '#fdf4ff', textSecondary: '#d8b4fe', defaultAccent: '#fb7185',
    badgeBg: (a) => `${a}26`, badgeText: () => '#ffffff', transition: 'slide',
    bgColors: ['#fb7185', '#fbbf24', '#a78bfa', '#34d399'],
  },
  sobre: {
    variant: 'minimal',
    bg: '#fafafa', bgGradient: '#fafafa', surface: '#ffffff', surfaceBorder: '#e5e5e5',
    textPrimary: '#18181b', textSecondary: '#71717a', defaultAccent: '#0f172a',
    badgeBg: (a) => `${a}12`, badgeText: (a) => a, transition: 'fade',
  },
};

const HEX6 = /^#[0-9a-fA-F]{6}$/;

// Luminance relative approximative d'une couleur hex (#rrggbb)
function lumOf(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const f = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

// Choisit des couleurs de texte contrastées selon la luminance du fond
function textColorsForLum(lum) {
  return lum < 0.45
    ? { textPrimary: '#f8fafc', textSecondary: '#cbd5e1' }
    : { textPrimary: '#0f172a', textSecondary: '#475569' };
}

// Construit la surcharge de fond (uni / dégradé) à partir de la config utilisateur.
// Retourne null si on garde le fond du thème.
function backgroundOverride(bgConfig) {
  if (!bgConfig || !bgConfig.mode || bgConfig.mode === 'theme') return null;
  const c1 = String(bgConfig.color1 || '');
  if (!HEX6.test(c1)) return null;
  if (bgConfig.mode === 'solid') {
    return { background: c1, bg: c1, ...textColorsForLum(lumOf(c1)) };
  }
  if (bgConfig.mode === 'gradient') {
    const c2 = HEX6.test(String(bgConfig.color2 || '')) ? bgConfig.color2 : c1;
    const angle = Number.isFinite(+bgConfig.angle) ? +bgConfig.angle : 135;
    return {
      background: `linear-gradient(${angle}deg, ${c1} 0%, ${c2} 100%)`,
      bg: c1,
      ...textColorsForLum((lumOf(c1) + lumOf(c2)) / 2),
    };
  }
  return null;
}

// Résout un thème + une couleur d'accent (+ surcharge de fond optionnelle) en styles.
export function resolveTheme(themeId, accentColor, bgConfig) {
  const t = THEMES[themeId] || THEMES.cleardoc;
  const accent = (accentColor && /^#[0-9a-fA-F]{3,8}$/.test(accentColor)) ? accentColor : t.defaultAccent;
  const v = VARIANT_STYLES[t.variant] || VARIANT_STYLES.modern;
  const base = {
    accent,
    variant: t.variant,
    bg: t.bg,
    background: t.bgGradient || t.bg,
    surface: t.surface,
    surfaceBorder: t.surfaceBorder,
    textPrimary: t.textPrimary,
    textSecondary: t.textSecondary,
    badgeBg: t.badgeBg(accent),
    badgeText: t.badgeText(accent),
    transition: t.transition,
    bgColors: t.bgColors || [accent],
    ...v,
    // Styles d'icône dérivés du variant + accent
    iconBg: v.iconFill ? accent : `${accent}14`,
    iconColor: v.iconFill ? '#ffffff' : accent,
    iconBorderCss: v.iconBorder > 0 ? `${v.iconBorder}px solid ${accent}${v.iconKind === 'square' ? 'aa' : '33'}` : 'none',
    iconShadow: v.iconGlow > 0 ? `0 18px 64px ${accent}${Math.round(v.iconGlow * 255).toString(16).padStart(2, '0')}` : 'none',
  };
  const override = backgroundOverride(bgConfig);
  return override ? { ...base, ...override } : base;
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
// ICÔNES (lucide-react, déjà installé) — jeu cohérent pour les scènes
// ============================================

const ALLOWED_ICONS = [
  'wallet', 'coins', 'banknote', 'receipt', 'percent', 'calculator', 'calendar', 'building',
  'briefcase', 'file', 'piggy-bank', 'trending-up', 'trending-down', 'shield', 'info', 'check',
  'hand-coins', 'user', 'clock', 'scale', 'chart',
];

// Mappe chaque mot-clé vers le composant lucide-react correspondant.
const LUCIDE_BY_ICON = {
  wallet: 'Wallet', coins: 'Coins', banknote: 'Banknote', receipt: 'Receipt', percent: 'Percent',
  calculator: 'Calculator', calendar: 'Calendar', building: 'Building2', briefcase: 'Briefcase',
  file: 'FileText', 'piggy-bank': 'PiggyBank', 'trending-up': 'TrendingUp', 'trending-down': 'TrendingDown',
  shield: 'ShieldCheck', info: 'Info', check: 'CheckCircle2', 'hand-coins': 'HandCoins', user: 'User',
  clock: 'Clock', scale: 'Scale', chart: 'BarChart3',
};

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

Pour CHAQUE scène, fournis :
- "titre" : un titre court (3 à 5 mots)
- "voix" : le texte COMPLET de la voix-off (2 à 4 phrases) — c'est ce qui sera lu à voix haute
- "ecran" : une version TRÈS COURTE affichée à l'écran (8 mots maximum, l'idée clé seulement, surtout PAS le texte complet de la voix)
- "icone" : un seul mot-clé choisi STRICTEMENT dans cette liste : ${ALLOWED_ICONS.join(', ')} (choisis l'icône la plus pertinente pour la scène)
- "chiffre" : SI la scène met en avant un nombre clé (montant, taux, durée...), donne-le comme nombre avec un point décimal (ex: 512.31 ou 0). Sinon null. (les chiffres sont des exemples)
- "suffixe" : l'unité du chiffre ("€", "%", "h"...) ou "" si aucun / si chiffre est null

INTERDICTIONS STRICTES — ne jamais inclure :
- Messages politiques, patriotiques ou civiques
- "contribuer à la vie du pays", "pilier de la société", "fier de travailler pour la France"
- Références à la nation, la République, la citoyenneté
- Jugements de valeur sur le rôle social du travailleur
- Liens URL, adresses de sites web, noms de domaine
- Rester strictement factuel sur le contenu de la fiche de paie

Répondre UNIQUEMENT en JSON valide sans markdown :
{"scenes":[{"id":"scene1","titre":"Titre court","voix":"Texte voix-off complet.","ecran":"Idée clé courte","icone":"wallet","chiffre":512.31,"suffixe":"€"}]}`;

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

  return scenes.map((s, i) => {
    const voix = String(s.voix || '').trim();
    let ecran = String(s.ecran || '').trim();
    // Repli : si l'IA n'a pas fourni de texte court, prendre le titre ou la 1re phrase tronquée
    if (!ecran) ecran = String(s.titre || voix).split(/[.!?\n]/)[0].trim().slice(0, 70);
    const icone = ALLOWED_ICONS.includes(String(s.icone)) ? String(s.icone) : 'info';
    const chiffre = (typeof s.chiffre === 'number' && Number.isFinite(s.chiffre)) ? s.chiffre : null;
    const suffixe = chiffre !== null ? String(s.suffixe || '') : '';
    const decimals = chiffre !== null && !Number.isInteger(chiffre) ? 2 : 0;
    return {
      id: slugify(s.id || `scene${i + 1}`),
      titre: String(s.titre || `Scène ${i + 1}`),
      voix,
      ecran,
      icone,
      chiffre,
      suffixe,
      decimals,
    };
  }).filter(s => s.voix.length > 0);
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
  // Le texte complet (voix) n'est PLUS affiché : seule la phrase courte "ecran" + une icône.
  let acc = 0;
  const scenesData = scenes.map((s, i) => {
    const item = {
      id: s.id,
      titre: s.titre,
      ecran: s.ecran || s.titre || '',
      icone: s.icone || 'info',
      chiffre: (typeof s.chiffre === 'number' && Number.isFinite(s.chiffre)) ? s.chiffre : null,
      suffixe: s.suffixe || '',
      decimals: (typeof s.decimals === 'number') ? s.decimals : 0,
      index: i,
      frames: s.frames,
      from: acc,
      file: s.filename,
    };
    acc += s.frames;
    return item;
  });

  // Import lucide-react + table des icônes utilisables
  const uniqueLucide = [...new Set(Object.values(LUCIDE_BY_ICON))];
  const lucideImport = `import { ${uniqueLucide.join(', ')} } from 'lucide-react';`;
  const iconsMapEntries = Object.entries(LUCIDE_BY_ICON)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${v},`)
    .join('\n');

  // Les textes issus de l'IA et les couleurs du thème sont injectés via JSON.stringify :
  // aucune interpolation directe de chaîne dans le code généré (sécurité + robustesse).
  const tsx = `// Généré automatiquement par ClearDoc Video Generator — ne pas éditer à la main.
import React from 'react';
import {
  AbsoluteFill, Audio, Img, Sequence, staticFile,
  useCurrentFrame, useVideoConfig, interpolate, spring, Easing,
} from 'remotion';
${lucideImport}

const ICONS: Record<string, React.FC<any>> = {
${iconsMapEntries}
};

const SCENES = ${JSON.stringify(scenesData, null, 2)};
const VIDEO_TITLE = ${JSON.stringify(titre)};
const THEME = ${JSON.stringify(themeColors, null, 2)};
const ACCENT = ${JSON.stringify(themeColors.accent)};
const TOTAL_FRAMES = ${totalFrames};
const WATERMARK = ${watermarkEnabled};
const WM_STYLE = ${JSON.stringify(watermarkStyle)};

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

const formatNumber = (value: number, decimals: number) =>
  value.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// Fond animé continu — le style dépend du variant du thème.
const AnimatedBg: React.FC = () => {
  const frame = useCurrentFrame();
  const kind = THEME.bgKind;
  const colors = THEME.bgColors;

  if (kind === 'plain') {
    // Minimal : fond uni + halo accent qui respire doucement
    const pulse = 0.05 + Math.sin(frame / 50) * 0.02;
    return (
      <AbsoluteFill style={{ background: THEME.background, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: '50%', top: '44%', width: 1200, height: 1200, borderRadius: '50%', background: ACCENT, opacity: pulse, filter: 'blur(150px)', transform: 'translate(-50%, -50%)' }} />
      </AbsoluteFill>
    );
  }

  if (kind === 'grid') {
    // Cyber : grille néon qui défile + halo + vignette
    const shift = frame % 64;
    return (
      <AbsoluteFill style={{ background: THEME.background, overflow: 'hidden' }}>
        <AbsoluteFill
          style={{
            backgroundImage: \`linear-gradient(\${ACCENT}24 1px, transparent 1px), linear-gradient(90deg, \${ACCENT}24 1px, transparent 1px)\`,
            backgroundSize: '64px 64px',
            backgroundPosition: \`0px \${shift}px\`,
            opacity: 0.55,
          }}
        />
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 1500, height: 950, borderRadius: '50%', background: ACCENT, opacity: 0.1, filter: 'blur(170px)', transform: 'translate(-50%, -50%)' }} />
        <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 45%, transparent 32%, rgba(0,0,0,0.55) 100%)' }} />
      </AbsoluteFill>
    );
  }

  // 'blobs' (modern) et 'waves' (curvy) : blobs flous dérivants (plus gros & colorés en 'waves')
  const big = kind === 'waves';
  const blobs = [
    { x: 16, y: 22, r: big ? 780 : 540, phase: 0, amp: big ? 60 : 36 },
    { x: 84, y: 74, r: big ? 720 : 480, phase: 2.2, amp: big ? 74 : 46 },
    { x: 72, y: 12, r: big ? 540 : 340, phase: 4.1, amp: big ? 50 : 28 },
    { x: 32, y: 82, r: big ? 480 : 0, phase: 1.3, amp: 56 },
  ];
  return (
    <AbsoluteFill style={{ background: THEME.background, overflow: 'hidden' }}>
      {kind === 'blobs' && (
        <AbsoluteFill style={{ backgroundImage: \`radial-gradient(\${THEME.textSecondary}1f 1.6px, transparent 1.6px)\`, backgroundSize: '46px 46px', opacity: 0.4 }} />
      )}
      {blobs.filter((b) => b.r > 0).map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: \`\${b.x}%\`,
            top: \`\${b.y}%\`,
            width: b.r,
            height: b.r,
            borderRadius: '50%',
            background: colors[i % colors.length],
            opacity: big ? 0.28 : 0.13,
            filter: big ? 'blur(70px)' : 'blur(90px)',
            transform: \`translate(-50%, -50%) translateY(\${Math.sin(frame / (big ? 34 : 42) + b.phase) * b.amp}px)\`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

const Scene: React.FC<{ scene: any; total: number }> = ({ scene, total }) => {
  const { titre, ecran, icone, file, frames: sceneFrames, chiffre, suffixe, decimals, index } = scene;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Transition d'entrée/sortie de la scène (le fond animé reste, lui, continu)
  const inOut = interpolate(frame, [0, 16, sceneFrames - 16, sceneFrames], [0, 1, 1, 0], clamp);
  const slideX = interpolate(frame, [0, 20], [THEME.enterX, 0], { ...clamp, easing: Easing.out(Easing.cubic) });

  // Icône : apparition en spring (ressenti selon le variant) + flottement continu
  const iconSpring = spring({ frame: frame - 4, fps, config: THEME.spring });
  const iconScale = interpolate(iconSpring, [0, 1], [0.4, 1]);
  const iconOpacity = interpolate(frame, [2, 16], [0, 1], clamp);
  const float = Math.sin(frame / 16) * 7;

  // Badge
  const badgeOpacity = interpolate(frame, [12, 26], [0, 1], clamp);
  const badgeY = interpolate(frame, [12, 26], [16, 0], clamp);

  // Compteur de montant (count-up)
  const countSpring = spring({ frame: frame - 16, fps, config: { damping: 20, stiffness: 80 } });
  const countValue = chiffre != null ? chiffre * Math.min(1, countSpring) : 0;
  const numberOpacity = interpolate(frame, [16, 30], [0, 1], clamp);

  const Icon = ICONS[icone] || ICONS.info;
  const words = String(ecran).split(' ');

  return (
    <AbsoluteFill
      style={{
        opacity: inOut,
        transform: \`translateX(\${slideX}px)\`,
        padding: '70px 120px',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <Audio src={staticFile(\`audio/\${file}\`)} />

      {/* Points de progression des scènes */}
      <div style={{ position: 'absolute', top: 64, display: 'flex', gap: 10 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            style={{
              width: i === index ? 36 : 12,
              height: 12,
              borderRadius: 999,
              background: i === index ? ACCENT : \`\${THEME.textSecondary}55\`,
            }}
          />
        ))}
      </div>

      {/* Icône — forme & traitement selon le variant */}
      {THEME.iconKind === 'bare' ? (
        <div style={{ marginBottom: 40, opacity: iconOpacity, transform: \`translateY(\${float}px) scale(\${iconScale})\` }}>
          <Icon size={150} color={THEME.iconColor} strokeWidth={1.5} />
        </div>
      ) : (
        <div style={{ position: 'relative', width: 260, height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 44, transform: \`translateY(\${float}px)\` }}>
          {THEME.pulse && [0, 1].map((r) => {
            const raw = ((frame - r * 18) % 72) / 72;
            const t = raw < 0 ? raw + 1 : raw;
            return (
              <div
                key={r}
                style={{
                  position: 'absolute',
                  width: 260,
                  height: 260,
                  borderRadius: THEME.iconRadius,
                  border: \`2px solid \${ACCENT}\`,
                  opacity: (1 - t) * 0.32 * iconOpacity,
                  transform: \`scale(\${1 + t * 0.7})\`,
                }}
              />
            );
          })}
          <div
            style={{
              width: 260,
              height: 260,
              borderRadius: THEME.iconRadius,
              background: THEME.iconBg,
              border: THEME.iconBorderCss,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: iconOpacity,
              transform: \`scale(\${iconScale})\`,
              boxShadow: THEME.iconShadow,
            }}
          >
            <Icon size={140} color={THEME.iconColor} strokeWidth={1.75} />
          </div>
        </div>
      )}

      {/* Badge titre — forme selon le variant */}
      {THEME.badgeKind === 'underline' ? (
        <div style={{ marginBottom: 24, opacity: badgeOpacity, transform: \`translateY(\${badgeY}px)\` }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: THEME.badgeText, fontFamily: THEME.font, textTransform: THEME.badgeUpper ? 'uppercase' : 'none', letterSpacing: THEME.badgeLetter }}>{titre}</div>
          <div style={{ height: 3, width: 90, background: ACCENT, borderRadius: 3, margin: '12px auto 0' }} />
        </div>
      ) : THEME.badgeKind === 'bracket' ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 24, opacity: badgeOpacity, transform: \`translateY(\${badgeY}px)\`, fontFamily: THEME.font }}>
          <span style={{ color: ACCENT, fontSize: 34, fontWeight: 700 }}>{'['}</span>
          <span style={{ fontSize: 24, fontWeight: 700, color: THEME.badgeText, textTransform: 'uppercase', letterSpacing: THEME.badgeLetter }}>{titre}</span>
          <span style={{ color: ACCENT, fontSize: 34, fontWeight: 700 }}>{']'}</span>
        </div>
      ) : (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 24, opacity: badgeOpacity, transform: \`translateY(\${badgeY}px)\` }}>
          <div style={{ width: 6, height: 30, background: ACCENT, borderRadius: 3 }} />
          <div
            style={{
              background: THEME.badgeBg,
              color: THEME.badgeText,
              border: \`2px solid \${ACCENT}40\`,
              fontSize: 26,
              fontWeight: 700,
              fontFamily: THEME.font,
              padding: '8px 26px',
              borderRadius: 999,
            }}
          >
            {titre}
          </div>
        </div>
      )}

      {/* Compteur de montant (si présent) */}
      {chiffre != null && (
        <div style={{ fontSize: 116, fontWeight: 900, color: ACCENT, fontFamily: THEME.font, lineHeight: 1, marginBottom: 18, opacity: numberOpacity }}>
          {formatNumber(countValue, decimals)}{suffixe ? ' ' + suffixe : ''}
        </div>
      )}

      {/* Texte court — révélation mot par mot (le texte complet reste dans l'audio) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 16px', maxWidth: 1500 }}>
        {words.map((w, i) => {
          const start = 24 + i * 4;
          const o = interpolate(frame, [start, start + 12], [0, 1], clamp);
          const y = interpolate(frame, [start, start + 12], [20, 0], clamp);
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                fontSize: chiffre != null ? 44 : 60,
                fontWeight: 800,
                color: THEME.textPrimary,
                fontFamily: THEME.font,
                lineHeight: 1.3,
                opacity: o,
                transform: \`translateY(\${y}px)\`,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const ${componentName}: React.FC = () => {
  const frame = useCurrentFrame();
  const globalProgress = Math.min(1, frame / TOTAL_FRAMES);
  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg }}>
      <AnimatedBg />

      {SCENES.map((scene) => (
        <Sequence key={scene.id} from={scene.from} durationInFrames={scene.frames}>
          <Scene scene={scene} total={SCENES.length} />
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

// Qualité -> CRF h264 (plus bas = meilleure qualité / plus lourd).
// 18 ≈ visuellement sans perte ; on rend en 1080p natif (au lieu de 2880x1620)
// ce qui réduit massivement le poids tout en gardant une excellente qualité.
const QUALITY_CRF = { high: 18, standard: 23, light: 28 };

// Render asynchrone (NE JAMAIS bloquer la boucle d'événements Node : le serveur
// sert aussi le frontend). Timeout pour éviter tout gel permanent si Chromium
// ne se lance pas.
export function renderVideo({ componentName, slug, projectRoot, quality = 'high', onLog, timeoutMs = 12 * 60 * 1000 }) {
  return new Promise((resolve, reject) => {
    const output = path.join('data', 'videos', `${slug}.mp4`);
    const crf = QUALITY_CRF[quality] || QUALITY_CRF.high;
    const args = [
      'remotion', 'render', 'src/Root.tsx', componentName, output,
      '--codec=h264',
      `--crf=${crf}`,
      '--pixel-format=yuv420p',
      '--image-format=png',
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
export async function generateVideoForDocument({ doc, getSetting, send, projectRoot, theme, accentColor, quality, bg }) {
  const videosCodeDir = path.join(projectRoot, 'src', 'videos');
  const rootPath = path.join(projectRoot, 'src', 'Root.tsx');
  const audioDir = path.join(projectRoot, 'data', 'audio');

  // Thème : valeur de la requête > réglage en base > défaut
  const themeId = theme || getSetting('VIDEO_THEME') || 'cleardoc';
  const accent = accentColor || getSetting('VIDEO_ACCENT_COLOR') || null;
  // Fond personnalisé : config de la requête, sinon réglages en base
  const bgConfig = (bg && bg.mode) ? bg : {
    mode: getSetting('VIDEO_BG_MODE') || 'theme',
    color1: getSetting('VIDEO_BG_COLOR1') || '',
    color2: getSetting('VIDEO_BG_COLOR2') || '',
    angle: getSetting('VIDEO_BG_ANGLE') || '135',
  };
  const resolvedTheme = resolveTheme(themeId, accent, bgConfig);
  const videoQuality = quality || getSetting('VIDEO_QUALITY') || 'high';

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
  await renderVideo({ componentName, slug, projectRoot, quality: videoQuality });
  send('render', 'Vidéo rendue', 90);

  const videoUrl = `/data/videos/${slug}.mp4`;
  return { videoUrl, slug };
}
