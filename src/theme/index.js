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
  textDim:   '#7AB2B2',

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
};

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
  label:        12,   // uppercase labels, tags, pills
  labelSmall:   11,   // timestamps, meta
  tiny:         10,   // calendar day headers, legend
};
