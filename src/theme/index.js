import { useColorScheme } from 'react-native';

export const COLORS_LIGHT = {
  ink: '#1a1a1a',
  ink2: '#555555',
  ink3: '#888888',
  surface: '#fafaf8',
  card: '#ffffff',
  border: '#e8e6e0',
  border2: '#d4d0c8',
  accent: '#2d5a3d',
  accentLight: '#e8f0eb',
  accent2: '#7c5c3a',
  accent2Light: '#f5ede4',
  danger: '#992222',
  dangerLight: '#fdf0f0',
};

export const COLORS_DARK = {
  ink: '#f0ede8',
  ink2: '#b8b4ab',
  ink3: '#7a7670',
  surface: '#1a1916',
  card: '#242220',
  border: '#333028',
  border2: '#44403a',
  accent: '#7ab890',
  accentLight: '#1c2d22',
  accent2: '#c4956a',
  accent2Light: '#2a201a',
  danger: '#ee8888',
  dangerLight: '#2a1818',
};

export function useTheme() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? COLORS_DARK : COLORS_LIGHT;
}

export const STATUS_COLORS_LIGHT = {
  learning:            { bg: '#FFF7ED', text: '#92400E', border: '#FED7AA' },
  consolidating:       { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
  'performance-ready': { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
};

export const STATUS_COLORS_DARK = {
  learning:            { bg: '#2a1f10', text: '#FBBF24', border: '#92400E' },
  consolidating:       { bg: '#0f1f35', text: '#93C5FD', border: '#1E40AF' },
  'performance-ready': { bg: '#0d2318', text: '#86EFAC', border: '#166534' },
};

export function useStatusColors() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;
}

export const FONTS = {
  serif: 'serif',       // fallback — replace with loaded font if desired
  sans: 'System',
};

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 20,
};
