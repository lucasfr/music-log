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
  learning:            { bg: 'rgba(140,32,69,0.10)',  text: '#6B1535', border: 'rgba(140,32,69,0.35)'  },
  consolidating:       { bg: 'rgba(247,127,0,0.12)',  text: '#7A3A00', border: 'rgba(247,127,0,0.38)'  },
  'performance-ready': { bg: 'rgba(252,191,73,0.20)', text: '#5A3A00', border: 'rgba(252,191,73,0.50)' },
};

export const RADIUS = {
  sm:   10,
  md:   16,
  lg:   22,
  xl:   28,
  pill: 99,
};

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
