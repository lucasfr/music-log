// Music.log — colour tokens
// Palette: #213C51 (deep navy), #6594B1 (steel blue), #DDAED3 (soft pink), #EEEEEE (light grey)

export const COLOURS = {
  // Palette
  navy:      '#213C51',
  steel:     '#6594B1',
  pink:      '#DDAED3',
  grey:      '#EEEEEE',

  // Backgrounds
  bg:        '#EAF0F5',   // very light blue-tinted surface
  bg2:       '#D8E4ED',

  // Text
  text:      '#1A2E3D',
  textMuted: '#4A6A82',
  textDim:   '#8AAABF',

  // Glass
  glass:        'rgba(255,255,255,0.48)',
  glassHover:   'rgba(255,255,255,0.68)',
  glassBorder:  'rgba(255,255,255,0.72)',
  glassShadow:  'rgba(33,60,81,0.10)',
  glassShadowMd:'rgba(33,60,81,0.16)',
  entryBg:      'rgba(255,255,255,0.74)',
  modalBg:      'rgba(255,255,255,0.70)',
  backdropColor:'rgba(26,46,61,0.45)',

  // Accents
  accent:      '#213C51',  // navy — primary
  accentLight: 'rgba(33,60,81,0.10)',
  accent2:     '#6594B1',  // steel — secondary
  accent2Light:'rgba(101,148,177,0.12)',
  pinkLight:   'rgba(221,174,211,0.18)',

  // Status
  danger:      '#A03030',
  dangerLight: 'rgba(160,48,48,0.10)',
  success:     '#2E6B5E',
  successLight:'rgba(46,107,94,0.10)',
};

export const STATUS_COLOURS = {
  learning:            { bg: 'rgba(101,148,177,0.12)', text: '#213C51', border: 'rgba(101,148,177,0.40)' },
  consolidating:       { bg: 'rgba(221,174,211,0.15)', text: '#5C2D6E', border: 'rgba(221,174,211,0.50)' },
  'performance-ready': { bg: 'rgba(46,107,94,0.10)',   text: '#1E5046', border: 'rgba(46,107,94,0.30)'   },
};

export const RADIUS = {
  sm:   10,
  md:   16,
  lg:   22,
  xl:   28,
  pill: 99,
};
