// Scale entries, and the numbers behind the scale coverage and technique breakdown charts on Stats.
// Pure (no React Native imports), so they're unit-tested in plain Node, see tests/scaleStats.test.mjs.
//
// The first part used to live in utils.js (which re-exports it, so imports from there still work);
// the second part used to sit inside the two chart components in StatsScreen.js.

// ─── Scale entries ───────────────────────────────────────────────────────────
// A scale entry on a segment is a plain string (the oldest data), or an object
// { scale, motion, octaves, interval }. These read both the same way. `fallbackOctaves` should be
// passed as `segment.octaves || 1` by callers so older entries without their own octaves value still
// read correctly.

export function scaleName(entry) {
  return typeof entry === 'string' ? entry : entry.scale;
}

export function scaleMotion(entry) {
  return typeof entry === 'string' ? 'parallel' : (entry.motion || 'parallel');
}

export function scaleInterval(entry) {
  return typeof entry === 'string' ? 'unison' : (entry.interval || 'unison');
}

export function scaleOctaves(entry, fallbackOctaves = 1) {
  if (typeof entry === 'string') return fallbackOctaves;
  return entry.octaves || fallbackOctaves;
}

// segment.articulation is { rh, lh } (each a key of ARTICULATION_LABELS or null), or absent on any
// segment logged before the field existed.
export function articulationOf(seg) {
  const a = seg?.articulation;
  return { rh: a?.rh || null, lh: a?.lh || null };
}

// ─── Dynamics ─────────────────────────────────────────────────────────────────
// How loudly an exercise was played (Hanon in piano, then in forte, or crescendo up and diminuendo
// down). A technique segment can have several, so `segment.dynamics` is a list of keys from
// DYNAMICS_OPTIONS (or absent, on any segment logged before it existed). Both hands share it.

export const DYNAMICS_OPTIONS = ['pp', 'p', 'mp', 'mf', 'f', 'ff', 'crescendo', 'diminuendo'];

export const DYNAMICS_LABELS = {
  pp: 'pp', p: 'p', mp: 'mp', mf: 'mf', f: 'f', ff: 'ff',
  crescendo: 'Crescendo', diminuendo: 'Diminuendo',
};

// The dynamics on a segment: only known ones, each once, in the order of DYNAMICS_OPTIONS.
export function dynamicsOf(seg) {
  const d = seg && seg.dynamics;
  if (!Array.isArray(d)) return [];
  return DYNAMICS_OPTIONS.filter(k => d.includes(k));
}

// The list after tapping `key` (added if it wasn't there, removed if it was). An unknown key changes
// nothing. [] when none are left; the picker stores that as null.
export function toggleDynamic(current, key) {
  const set = new Set(dynamicsOf({ dynamics: current }));
  if (DYNAMICS_OPTIONS.includes(key)) { if (set.has(key)) set.delete(key); else set.add(key); }
  return DYNAMICS_OPTIONS.filter(k => set.has(k));
}

// 'mf', 'p, f', 'Crescendo, Diminuendo'; null when nothing is set.
export function formatDynamics(seg) {
  const d = dynamicsOf(seg);
  return d.length ? d.map(k => DYNAMICS_LABELS[k]).join(', ') : null;
}

// ─── Circle of fifths ────────────────────────────────────────────────────────

export const COF_KEYS   = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
export const COF_MINORS = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];

// Maps the scale label stored in session data to a circle-of-fifths key or minor key. Built
// explicitly to avoid any root collision between major and minor.
export const SCALE_LABEL_TO_COF = {
  // Major
  'C major': 'C', 'G major': 'G', 'D major': 'D', 'A major': 'A',
  'E major': 'E', 'B major': 'B', 'F# major': 'F#', 'Gb major': 'F#', 'Db major': 'Db',
  'Ab major': 'Ab', 'Eb major': 'Eb', 'Bb major': 'Bb', 'F major': 'F',
  // Natural minor
  'A natural minor': 'Am', 'E natural minor': 'Em', 'B natural minor': 'Bm',
  'F# natural minor': 'F#m', 'C# natural minor': 'C#m', 'G# natural minor': 'G#m',
  'D# natural minor': 'D#m', 'Bb natural minor': 'Bbm', 'F natural minor': 'Fm',
  'C natural minor': 'Cm', 'G natural minor': 'Gm', 'D natural minor': 'Dm',
  // Harmonic minor
  'A harmonic minor': 'Am', 'E harmonic minor': 'Em', 'B harmonic minor': 'Bm',
  'F# harmonic minor': 'F#m', 'C# harmonic minor': 'C#m', 'G# harmonic minor': 'G#m',
  'D# harmonic minor': 'D#m', 'Bb harmonic minor': 'Bbm', 'F harmonic minor': 'Fm',
  'C harmonic minor': 'Cm', 'G harmonic minor': 'Gm', 'D harmonic minor': 'Dm',
  // Melodic minor
  'A melodic minor': 'Am', 'E melodic minor': 'Em', 'B melodic minor': 'Bm',
  'F# melodic minor': 'F#m', 'C# melodic minor': 'C#m', 'G# melodic minor': 'G#m',
  'D# melodic minor': 'D#m', 'Bb melodic minor': 'Bbm', 'F melodic minor': 'Fm',
  'C melodic minor': 'Cm', 'G melodic minor': 'Gm', 'D melodic minor': 'Dm',
  // Chromatic: no inherent major/minor quality, but named by tonic the same way major scales are,
  // so grouped onto the outer (major) ring
  'C chromatic': 'C', 'G chromatic': 'G', 'D chromatic': 'D', 'A chromatic': 'A',
  'E chromatic': 'E', 'B chromatic': 'B', 'F# chromatic': 'F#', 'Db chromatic': 'Db',
  'Ab chromatic': 'Ab', 'Eb chromatic': 'Eb', 'Bb chromatic': 'Bb', 'F chromatic': 'F',
  // Dominant 7th arpeggios: also grouped onto the outer ring by tonic
  'C dominant 7th': 'C', 'G dominant 7th': 'G', 'D dominant 7th': 'D', 'A dominant 7th': 'A',
  'E dominant 7th': 'E', 'B dominant 7th': 'B', 'F# dominant 7th': 'F#', 'Db dominant 7th': 'Db',
  'Ab dominant 7th': 'Ab', 'Eb dominant 7th': 'Eb', 'Bb dominant 7th': 'Bb', 'F dominant 7th': 'F',
  // Diminished 7th arpeggios: symmetrical, but grouped by named tonic same as above
  'C diminished 7th': 'C', 'G diminished 7th': 'G', 'D diminished 7th': 'D', 'A diminished 7th': 'A',
  'E diminished 7th': 'E', 'B diminished 7th': 'B', 'F# diminished 7th': 'F#', 'Db diminished 7th': 'Db',
  'Ab diminished 7th': 'Ab', 'Eb diminished 7th': 'Eb', 'Bb diminished 7th': 'Bb', 'F diminished 7th': 'F',
};

// ─── Scale coverage ──────────────────────────────────────────────────────────

// How much each key of the circle of fifths has been practised. Only technique segments with scales
// count, and `filters` ({ motion, octaves, interval }, each 'all' or a value) narrow which entries do.
// A segment that names several scales in the same key counts that key once, and its minutes are
// shared out across the distinct keys so total time isn't inflated.
// -> { counts: { [key]: { sessions, minutes, difficulty: [] } }, majorCounts, minorCounts, maxCount,
//      totalMinutes, totalSessions, keysVisited, avgDifficulty | null, anyTechnique }
export function scaleCoverage(sessions, filters = {}) {
  const { motion = 'all', octaves = 'all', interval = 'all' } = filters;
  const matches = (entry, seg) => {
    if (motion !== 'all' && scaleMotion(entry) !== motion) return false;
    if (octaves !== 'all' && scaleOctaves(entry, seg.octaves || 1) !== octaves) return false;
    if (interval !== 'all' && scaleInterval(entry) !== interval) return false;
    return true;
  };

  const counts = {};
  let totalMinutes = 0;
  let anyTechnique = false;
  (sessions || []).forEach(s => (s.segments || []).forEach(seg => {
    if (seg.type !== 'technique') return;
    anyTechnique = true;
    const entries = (seg.scales || []).filter(e => matches(e, seg));
    if (entries.some(e => SCALE_LABEL_TO_COF[scaleName(e)])) totalMinutes += Number(seg.duration) || 0;
    const keys = [...new Set(entries.map(e => SCALE_LABEL_TO_COF[scaleName(e)]).filter(Boolean))];
    if (keys.length === 0) return;
    const share = (Number(seg.duration) || 0) / keys.length;
    keys.forEach(key => {
      if (!counts[key]) counts[key] = { sessions: 0, minutes: 0, difficulty: [] };
      counts[key].sessions++;
      counts[key].minutes += share;
      if (seg.feltDifficulty) counts[key].difficulty.push(Number(seg.feltDifficulty));
    });
  }));

  const majorCounts = COF_KEYS.map(k => counts[k]?.sessions || 0);
  const minorCounts = COF_MINORS.map(k => counts[k]?.sessions || 0);
  const diffs = Object.values(counts).flatMap(v => v.difficulty);
  return {
    counts, majorCounts, minorCounts,
    maxCount: Math.max(...majorCounts, ...minorCounts, 1),
    totalMinutes,
    totalSessions: Object.values(counts).reduce((a, v) => a + v.sessions, 0),
    keysVisited: [...majorCounts, ...minorCounts].filter(v => v > 0).length,
    avgDifficulty: diffs.length ? diffs.reduce((a, v) => a + v, 0) / diffs.length : null,
    anyTechnique,
  };
}

// ─── Technique breakdown ─────────────────────────────────────────────────────

// Technique segments grouped by group (or title), most-used first, optionally only those where
// either hand uses the chosen articulation. `articulationOptions` is the ordered list of
// articulation keys the app knows; `available` is the ones that appear in this data, in that order
// (so the filter row only offers what exists). A chosen filter that has no data here (after
// switching period, say) falls back to 'all'.
// The same goes for the optional dynamics filter (`availableDynamics`, `activeDynamics`); a segment matches
// when it includes the chosen dynamic, and both filters apply together.
// -> { available, activeFilter, availableDynamics, activeDynamics,
//      sorted: [[name, { count, minutes, difficulty: [] }], ...] }
export function techniqueBreakdown(sessions, articulationFilter, articulationOptions, dynamicsFilter = 'all') {
  const used = new Set();
  const usedDynamics = new Set();
  (sessions || []).forEach(s => (s.segments || []).forEach(seg => {
    if (seg.type !== 'technique') return;
    const { rh, lh } = articulationOf(seg);
    if (rh) used.add(rh);
    if (lh) used.add(lh);
    dynamicsOf(seg).forEach(k => usedDynamics.add(k));
  }));
  const available = (articulationOptions || []).filter(a => used.has(a));
  const activeFilter = articulationFilter !== 'all' && available.includes(articulationFilter) ? articulationFilter : 'all';
  const availableDynamics = DYNAMICS_OPTIONS.filter(k => usedDynamics.has(k));
  const activeDynamics = dynamicsFilter !== 'all' && availableDynamics.includes(dynamicsFilter) ? dynamicsFilter : 'all';

  const groups = {};
  (sessions || []).forEach(s => (s.segments || []).forEach(seg => {
    if (seg.type !== 'technique') return;
    if (activeFilter !== 'all') {
      const { rh, lh } = articulationOf(seg);
      if (rh !== activeFilter && lh !== activeFilter) return;
    }
    if (activeDynamics !== 'all' && !dynamicsOf(seg).includes(activeDynamics)) return;
    const name = seg.group || seg.title || 'Technique';
    if (!groups[name]) groups[name] = { count: 0, minutes: 0, difficulty: [] };
    groups[name].count++;
    groups[name].minutes += Number(seg.duration) || 0;
    if (seg.feltDifficulty) groups[name].difficulty.push(Number(seg.feltDifficulty));
  }));
  return { available, activeFilter, availableDynamics, activeDynamics, sorted: Object.entries(groups).sort((a, b) => b[1].count - a[1].count) };
}
