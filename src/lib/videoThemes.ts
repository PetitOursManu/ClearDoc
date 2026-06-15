export interface VideoTheme {
  id: string;
  name: string;
  emoji: string;
  description: string;
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
}

export const VIDEO_THEMES: Record<string, VideoTheme> = {
  cleardoc: {
    id: 'cleardoc',
    name: 'ClearDoc',
    emoji: '🔴',
    description: 'Rouge identitaire, fidèle à l\'app',
    bg: '#f8f9fa',
    bgGradient: '#f8f9fa',
    surface: '#ffffff',
    surfaceBorder: '#e2e8f0',
    textPrimary: '#1e293b',
    textSecondary: '#64748b',
    defaultAccent: '#dc2626',
    badgeBg: (accent) => `${accent}18`,
    badgeText: (accent) => accent,
    transition: 'slide',
  },
  arctic: {
    id: 'arctic',
    name: 'Arctic',
    emoji: '❄️',
    description: 'Bleu glacé, épuré, moderne',
    bg: '#f0f7ff',
    bgGradient: 'linear-gradient(135deg, #e8f4fd 0%, #f0f7ff 100%)',
    surface: '#ffffff',
    surfaceBorder: '#bfdbfe',
    textPrimary: '#1e293b',
    textSecondary: '#475569',
    defaultAccent: '#2563eb',
    badgeBg: (accent) => `${accent}15`,
    badgeText: (accent) => accent,
    transition: 'slide',
  },
  noir: {
    id: 'noir',
    name: 'Noir',
    emoji: '🌑',
    description: 'Fond sombre, élégant, premium',
    bg: '#0f172a',
    bgGradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    surface: '#1e293b',
    surfaceBorder: '#334155',
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    defaultAccent: '#dc2626',
    badgeBg: (accent) => `${accent}30`,
    badgeText: (accent) => `${accent}dd`,
    transition: 'fade',
  },
  doux: {
    id: 'doux',
    name: 'Doux',
    emoji: '🌸',
    description: 'Pastel, accessible, bienveillant',
    bg: '#fdf4ff',
    bgGradient: 'linear-gradient(135deg, #fdf4ff 0%, #f0fdf4 100%)',
    surface: '#ffffff',
    surfaceBorder: '#e9d5ff',
    textPrimary: '#1e293b',
    textSecondary: '#6b7280',
    defaultAccent: '#d946ef',
    badgeBg: (accent) => `${accent}15`,
    badgeText: (accent) => accent,
    transition: 'fade',
  },
  foret: {
    id: 'foret',
    name: 'Forêt',
    emoji: '🌲',
    description: 'Vert sombre, naturel, calme',
    bg: '#0f2417',
    bgGradient: 'linear-gradient(135deg, #0f2417 0%, #1a3a25 100%)',
    surface: '#1a3a25',
    surfaceBorder: '#2d6a40',
    textPrimary: '#f0fdf4',
    textSecondary: '#86efac',
    defaultAccent: '#16a34a',
    badgeBg: (accent) => `${accent}30`,
    badgeText: () => '#86efac',
    transition: 'slide',
  },
};

export const DEFAULT_THEME = VIDEO_THEMES.cleardoc;

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
