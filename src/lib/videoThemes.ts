export type VideoVariant = 'modern' | 'cyber' | 'curvy' | 'minimal';

export interface VideoTheme {
  id: string;
  name: string;
  emoji: string;
  description: string;
  variant: VideoVariant;
  bg: string;
  bgGradient: string;
  surface: string;
  surfaceBorder: string;
  textPrimary: string;
  textSecondary: string;
  defaultAccent: string;
  badgeBg: (accent: string) => string;
  badgeText: (accent: string) => string;
  transition: 'slide' | 'fade' | 'zoom';
  bgColors?: string[];
}

export const VIDEO_THEMES: Record<string, VideoTheme> = {
  cleardoc: {
    id: 'cleardoc', name: 'ClearDoc', emoji: '🔴', description: 'Rouge identitaire, fidèle à l\'app',
    variant: 'modern',
    bg: '#f8f9fa', bgGradient: '#f8f9fa', surface: '#ffffff', surfaceBorder: '#e2e8f0',
    textPrimary: '#1e293b', textSecondary: '#64748b', defaultAccent: '#dc2626',
    badgeBg: (a) => `${a}18`, badgeText: (a) => a, transition: 'slide',
  },
  moderne: {
    id: 'moderne', name: 'Moderne', emoji: '✨', description: 'Épuré, indigo, dégradé doux',
    variant: 'modern',
    bg: '#f5f7fb', bgGradient: 'linear-gradient(135deg, #eef2ff 0%, #f5f7fb 100%)',
    surface: '#ffffff', surfaceBorder: '#e2e8f0',
    textPrimary: '#0f172a', textSecondary: '#64748b', defaultAccent: '#6366f1',
    badgeBg: (a) => `${a}16`, badgeText: (a) => a, transition: 'slide',
  },
  arctic: {
    id: 'arctic', name: 'Arctic', emoji: '❄️', description: 'Bleu glacé, épuré, moderne',
    variant: 'modern',
    bg: '#f0f7ff', bgGradient: 'linear-gradient(135deg, #e8f4fd 0%, #f0f7ff 100%)',
    surface: '#ffffff', surfaceBorder: '#bfdbfe',
    textPrimary: '#1e293b', textSecondary: '#475569', defaultAccent: '#2563eb',
    badgeBg: (a) => `${a}15`, badgeText: (a) => a, transition: 'slide',
  },
  noir: {
    id: 'noir', name: 'Noir', emoji: '🌑', description: 'Fond sombre, élégant, premium',
    variant: 'modern',
    bg: '#0f172a', bgGradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    surface: '#1e293b', surfaceBorder: '#334155',
    textPrimary: '#f1f5f9', textSecondary: '#94a3b8', defaultAccent: '#dc2626',
    badgeBg: (a) => `${a}30`, badgeText: (a) => `${a}dd`, transition: 'fade',
  },
  doux: {
    id: 'doux', name: 'Doux', emoji: '🌸', description: 'Pastel, accessible, bienveillant',
    variant: 'modern',
    bg: '#fdf4ff', bgGradient: 'linear-gradient(135deg, #fdf4ff 0%, #f0fdf4 100%)',
    surface: '#ffffff', surfaceBorder: '#e9d5ff',
    textPrimary: '#1e293b', textSecondary: '#6b7280', defaultAccent: '#d946ef',
    badgeBg: (a) => `${a}15`, badgeText: (a) => a, transition: 'fade',
  },
  foret: {
    id: 'foret', name: 'Forêt', emoji: '🌲', description: 'Vert sombre, naturel, calme',
    variant: 'modern',
    bg: '#0f2417', bgGradient: 'linear-gradient(135deg, #0f2417 0%, #1a3a25 100%)',
    surface: '#1a3a25', surfaceBorder: '#2d6a40',
    textPrimary: '#f0fdf4', textSecondary: '#86efac', defaultAccent: '#16a34a',
    badgeBg: (a) => `${a}30`, badgeText: () => '#86efac', transition: 'slide',
  },
  cyber: {
    id: 'cyber', name: 'Cyber', emoji: '🤖', description: 'Néon, grille, formes carrées',
    variant: 'cyber',
    bg: '#05060a', bgGradient: 'linear-gradient(135deg, #05060a 0%, #0a0f1f 100%)',
    surface: '#0c1424', surfaceBorder: '#1f2a44',
    textPrimary: '#e2f6ff', textSecondary: '#7dd3fc', defaultAccent: '#22d3ee',
    badgeBg: (a) => `${a}22`, badgeText: (a) => a, transition: 'fade',
  },
  courbe: {
    id: 'courbe', name: 'Courbe', emoji: '🎨', description: 'Coloré, formes organiques, rebond',
    variant: 'curvy',
    bg: '#15102e', bgGradient: 'linear-gradient(135deg, #1e1147 0%, #3a1d6e 100%)',
    surface: '#ffffff', surfaceBorder: '#e9d5ff',
    textPrimary: '#fdf4ff', textSecondary: '#d8b4fe', defaultAccent: '#fb7185',
    badgeBg: (a) => `${a}26`, badgeText: () => '#ffffff', transition: 'slide',
    bgColors: ['#fb7185', '#fbbf24', '#a78bfa', '#34d399'],
  },
  sobre: {
    id: 'sobre', name: 'Sobre', emoji: '◽', description: 'Minimaliste, neutre, peu d\'animation',
    variant: 'minimal',
    bg: '#fafafa', bgGradient: '#fafafa', surface: '#ffffff', surfaceBorder: '#e5e5e5',
    textPrimary: '#18181b', textSecondary: '#71717a', defaultAccent: '#0f172a',
    badgeBg: (a) => `${a}12`, badgeText: (a) => a, transition: 'fade',
  },
};

export const DEFAULT_THEME = VIDEO_THEMES.cleardoc;

export interface BgConfig {
  mode: 'theme' | 'solid' | 'gradient';
  color1: string;
  color2: string;
  angle: number | string;
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;

function lumOf(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function textForLum(lum: number) {
  return lum < 0.45
    ? { textPrimary: '#f8fafc', textSecondary: '#cbd5e1' }
    : { textPrimary: '#0f172a', textSecondary: '#475569' };
}

/** Calcule le fond (CSS) et les couleurs de texte pour l'aperçu, selon la config. */
export function resolveBgPreview(theme: VideoTheme, bg: BgConfig) {
  const themeBg = { background: theme.bgGradient || theme.bg, textPrimary: theme.textPrimary, textSecondary: theme.textSecondary };
  if (!bg || bg.mode === 'theme' || !HEX6.test(bg.color1)) return themeBg;
  if (bg.mode === 'solid') {
    return { background: bg.color1, ...textForLum(lumOf(bg.color1)) };
  }
  const c2 = HEX6.test(bg.color2) ? bg.color2 : bg.color1;
  const angle = Number.isFinite(+bg.angle) ? +bg.angle : 135;
  return {
    background: `linear-gradient(${angle}deg, ${bg.color1} 0%, ${c2} 100%)`,
    ...textForLum((lumOf(bg.color1) + lumOf(c2)) / 2),
  };
}

export const ACCENT_PRESETS: { name: string; value: string }[] = [
  { name: 'Rouge ClearDoc', value: '#dc2626' },
  { name: 'Bleu', value: '#2563eb' },
  { name: 'Vert', value: '#16a34a' },
  { name: 'Violet', value: '#d946ef' },
  { name: 'Ambre', value: '#f59e0b' },
  { name: 'Cyan', value: '#0891b2' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Rose', value: '#ec4899' },
];
