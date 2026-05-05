// Music.log — colour tokens
// Base: teal family (#09637E, #088395, #7AB2B2, #EBF4F6)
// Accents: ember family (#003049, #D62828, #F77F00, #FCBF49)

export const COLOURS = {
  // Base teal
  navy:      '#09637E',
  steel:     '#088395',
  tealLight: '#7AB2B2',

  // Accents
  ink:       '#003049',
  red:       '#D62828',
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
  glassBorder:  'rgba(255,255,255,0.0)',   // invisible — no hard outlines
  glassBorderSubtle: 'rgba(9,99,126,0.08)', // only used where a hint is needed
  glassShadow:  'rgba(9,99,126,0.12)',
  glassShadowMd:'rgba(9,99,126,0.18)',
  entryBg:      'rgba(255,255,255,0.68)',
  modalBg:      'rgba(255,255,255,0.65)',
  backdropColor:'rgba(0,48,73,0.45)',

  // Practice accents (red)
  accent:       '#D62828',
  accentLight:  'rgba(214,40,40,0.10)',
  accentMid:    'rgba(214,40,40,0.28)',

  // Lesson accents (amber)
  accent2:      '#F77F00',
  accent2Light: 'rgba(247,127,0,0.10)',
  accent2Mid:   'rgba(247,127,0,0.28)',
  pinkLight:    'rgba(247,127,0,0.10)',
  pinkMid:      'rgba(247,127,0,0.30)',

  // Piece accents (gold)
  yellowLight:  'rgba(252,191,73,0.15)',
  yellowMid:    'rgba(252,191,73,0.35)',

  // Teal accents (metadata / generic pills)
  tealAccent:  'rgba(8,131,149,0.10)',
  tealBorder:  'rgba(8,131,149,0.30)',

  // Status
  danger:      '#D62828',
  dangerLight: 'rgba(214,40,40,0.10)',
  success:     '#2E8A72',
  successLight:'rgba(46,138,114,0.12)',
};

export const STATUS_COLOURS = {
  learning:            { bg: 'rgba(214,40,40,0.10)',  text: '#8A1010', border: 'rgba(214,40,40,0.35)'  },
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
