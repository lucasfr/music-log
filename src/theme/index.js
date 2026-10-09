// Music.log — colour tokens
// Base: teal family (#09637E, #088395, #7AB2B2, #EBF4F6)
// Accents: burgundy (#8C2045), amber (#F77F00), gold (#FCBF49)

export const COLOURS = {
  // Base teal
  navy:      '#09637E',
  steel:     '#088395',
  tealLight: '#7AB2B2',

  // Accents
  ink:       '#003049',
  red:       '#8C2045',
  amber:     '#F77F00',
  gold:      '#FCBF49',

  // Backgrounds
  bg:        '#EBF4F6',
  bg2:       '#D4E9ED',

  // Text
  text:      '#09637E',
  textMuted: '#088395',
  textDim:   '#3A767C',   // was #7AB2B2 (2.1:1) — now 4.6:1 on the page bg, 5.2:1 on white

  // Glass
  glass:        'rgba(255,255,255,0.55)',
  glassHover:   'rgba(255,255,255,0.75)',
  glassBorder:  'rgba(255,255,255,0.0)',
  glassBorderSubtle: 'rgba(9,99,126,0.08)',
  glassShadow:  'rgba(9,99,126,0.12)',
  glassShadowMd:'rgba(9,99,126,0.18)',
  entryBg:      'rgba(255,255,255,0.68)',
  modalBg:      'rgba(255,255,255,0.65)',
  backdropColor:'rgba(0,48,73,0.45)',

  // Practice accents (burgundy)
  accent:           '#8C2045',
  accentLight:      'rgba(140,32,69,0.10)',
  accentMid:        'rgba(140,32,69,0.28)',
  practiceText:     '#6B1535',
  practiceBg:       'rgba(140,32,69,0.10)',
  practiceBorder:   'rgba(140,32,69,0.28)',

  // Lesson accents (amber)
  accent2:          '#F77F00',
  accent2Light:     'rgba(247,127,0,0.10)',
  accent2Mid:       'rgba(247,127,0,0.28)',
  lessonText:       '#7A3A00',
  lessonBg:         'rgba(247,127,0,0.10)',
  lessonBorder:     'rgba(247,127,0,0.28)',
  pinkLight:        'rgba(247,127,0,0.10)',
  pinkMid:          'rgba(247,127,0,0.30)',

  // Piece accents (gold)
  yellowLight:  'rgba(252,191,73,0.15)',
  yellowMid:    'rgba(252,191,73,0.35)',

  // Teal accents (metadata / generic pills)
  tealAccent:  'rgba(8,131,149,0.10)',
  tealBorder:  'rgba(8,131,149,0.30)',

  // Status — danger stays red (destructive actions only)
  danger:      '#C0392B',
  dangerLight: 'rgba(192,57,43,0.10)',
  success:     '#2E8A72',
  successLight:'rgba(46,138,114,0.12)',

  // ── Theme-aware helpers ── each palette supplies its own version ─────────────────────
  // Frosted-white surface, navy tint and teal tint at a given alpha. Use these
  // instead of hardcoding rgba(...) so every theme can restyle them.
  w:      a => `rgba(255,255,255,${a})`,
  navyA:  a => `rgba(9,99,126,${a})`,
  steelA: a => `rgba(8,131,149,${a})`,
  blurTint:  'light',   // expo-blur tint
  statusBar: 'dark',    // expo-status-bar style (dark icons on a light background)
  float:     'rgba(255,255,255,0.92)',   // floating chrome (FAB, tab bar): stays near-opaque in every theme
  isDark:    false,
  __theme:   'light',
};

// ─── Themes ───────────────────────────────────────────────────────────────────────────────────────────────────
// COLOURS above is the light palette and stays the single object every component
// reads. A theme is just a palette that applyTheme() copies over it, so adding a
// new colour theme later means adding one entry to THEMES — it then appears in
// Settings automatically. Anything a palette omits falls back to the light value.
const LIGHT = { ...COLOURS };

const DARK = {
  ...LIGHT,
  navy: '#2B94AE', steel: '#3BB3C6', tealLight: '#5E9AA3',
  ink: '#1E3A44', red: '#E0668F', amber: '#FF9A33', gold: '#FCBF49',
  bg: '#0A1418', bg2: '#13242A',
  text: '#E4F3F6', textMuted: '#9BD0DA', textDim: '#8FB6BE',
  glass: 'rgba(255,255,255,0.07)', glassHover: 'rgba(255,255,255,0.12)',
  glassBorder: 'rgba(255,255,255,0)', glassBorderSubtle: 'rgba(255,255,255,0.10)',
  glassShadow: 'rgba(0,0,0,0.35)', glassShadowMd: 'rgba(0,0,0,0.5)',
  entryBg: 'rgba(255,255,255,0.09)', modalBg: 'rgba(20,38,44,0.94)', backdropColor: 'rgba(0,0,0,0.6)',
  accent: '#E0668F', accentLight: 'rgba(224,102,143,0.16)', accentMid: 'rgba(224,102,143,0.40)',
  practiceText: '#F4A9C3', practiceBg: 'rgba(224,102,143,0.16)', practiceBorder: 'rgba(224,102,143,0.40)',
  accent2: '#FF9A33', accent2Light: 'rgba(255,154,51,0.16)', accent2Mid: 'rgba(255,154,51,0.40)',
  lessonText: '#FFC48A', lessonBg: 'rgba(255,154,51,0.16)', lessonBorder: 'rgba(255,154,51,0.40)',
  pinkLight: 'rgba(255,154,51,0.16)', pinkMid: 'rgba(255,154,51,0.38)',
  yellowLight: 'rgba(252,191,73,0.16)', yellowMid: 'rgba(252,191,73,0.38)',
  tealAccent: 'rgba(59,179,198,0.16)', tealBorder: 'rgba(59,179,198,0.40)',
  danger: '#FF7A6B', dangerLight: 'rgba(255,122,107,0.16)',
  success: '#4CC3A0', successLight: 'rgba(76,195,160,0.16)',
  // On a dark page, "white glass" is a faint white wash rather than a bright card.
  w:      a => `rgba(255,255,255,${+Math.min(1, a * 0.13).toFixed(3)})`,
  navyA:  a => `rgba(78,178,204,${+Math.min(1, a * 1.3).toFixed(3)})`,
  steelA: a => `rgba(70,190,208,${+Math.min(1, a * 1.3).toFixed(3)})`,
  blurTint: 'dark', statusBar: 'light', isDark: true, __theme: 'dark',
  float: '#1C323A',
};

export const THEMES = {
  light: { label: 'Light', colours: LIGHT },
  dark:  { label: 'Dark',  colours: DARK  },
};

// Swap COLOURS over to a theme. Cheap and synchronous; the app remounts afterwards
// (see ThemeContext) so every component re-reads the new values.
export function applyTheme(key) {
  const t = THEMES[key] || THEMES.light;
  Object.assign(COLOURS, LIGHT, t.colours);
  COLOURS.__theme = THEMES[key] ? key : 'light';
  return COLOURS.__theme;
}

// For styles that are built once at import time (a StyleSheet.create or a shared
// const at module scope) and would otherwise keep the colours of whichever theme
// was active at startup. The factory is re-run only when the theme changes.
export function live(factory) {
  let key = null;
  let value = null;
  const cur = () => {
    if (key !== COLOURS.__theme || value === null) { value = factory(); key = COLOURS.__theme; }
    return value;
  };
  return new Proxy({}, {
    get: (_, k) => cur()[k],
    has: (_, k) => k in cur(),
    ownKeys: () => Reflect.ownKeys(cur()),
    getOwnPropertyDescriptor: (_, k) => ({ enumerable: true, configurable: true, value: cur()[k] }),
  });
}

export const STATUS_COLOURS = {
  // Lifecycle arc — hues from palette 4 (crimson → navy), lightened for light bg
  new:                 { bg: '#FDE8D8', text: '#7A3500', border: 'rgba(247,127,0,0.43)'   },  // amber
  learning:            { bg: '#FAD9CC', text: '#6B1A05', border: 'rgba(213,62,15,0.43)'   },  // rust
  consolidating:       { bg: '#FDEFC8', text: '#6B3A00', border: 'rgba(252,191,73,0.43)'  },  // gold
  'performance-ready': { bg: '#D6EDD8', text: '#1E4D28', border: 'rgba(46,120,58,0.43)'   },  // sage green — clearly distinct, still warm
  // Holding states
  shelved:             { bg: '#E4EAF0', text: '#3E5A6D', border: 'rgba(94,138,158,0.45)'   },  // soft slate blue
  ambition:            { bg: '#EEEDFE', text: '#26215C', border: 'rgba(127,119,221,0.43)'  },  // purple — aspirational
};

export const RADIUS = {
  sm:   10,
  md:   16,
  lg:   22,
  xl:   28,
  pill: 99,
};

// ─── Touch targets ────────────────────────────────────────────────────────────
// Apple HIG asks for 44pt and Material for 48dp. Rather than bloat every glass
// pill to 44, pills are kept at a 36 minimum height and the rest is added as
// invisible hit area (hitSlop). Slop on pills is vertical only, so neighbours in
// a row never steal each other's taps.
export const TOUCH = { min: 44, pill: 36 };

// Spread into a pill's style to guarantee its visual height.
export const TOUCH_PILL = { minHeight: TOUCH.pill, justifyContent: 'center' };

// 36 pill + 4 + 4 = 44.
export const HIT_PILL = { top: 4, bottom: 4, left: 0, right: 0 };

// Bare text buttons (Cancel / Done / Edit / clear): ~16-20pt tall, no padding.
export const HIT_TEXT = { top: 14, bottom: 14, left: 12, right: 12 };

// Small glyph buttons (up / down / remove) sitting in a row: a fixed 36pt box,
// with vertical slop to make up the remaining height.
export const TOUCH_ICON = { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' };
export const HIT_ICON   = { top: 4, bottom: 4, left: 0, right: 0 };

// Pads a fixed-size control out to 44 on each axis (e.g. a 32pt round button).
export function hitFor(w, h = w) {
  const x = Math.max(0, (TOUCH.min - w) / 2);
  const y = Math.max(0, (TOUCH.min - h) / 2);
  return { top: y, bottom: y, left: x, right: x };
}

export const SIZES = {
  screenTitle:  28,   // music.log wordmark
  sectionTitle: 22,   // screen headings (Compositions, Calendar…)
  cardTitle:    18,   // piece title, session date in card
  body:         16,   // primary body text
  bodySmall:    14,   // secondary body, subtitles
  label:        13,   // uppercase labels, tags, pills
  labelSmall:   12,   // timestamps, meta
  tiny:         11,   // calendar day headers, legend
};
