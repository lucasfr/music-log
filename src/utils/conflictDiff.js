// What differs between the version sync kept and a saved conflict copy, in plain words, so you can tell
// which to keep without opening both. Pure (no React Native imports), so it's unit-tested in plain Node,
// see tests/conflictDiff.test.mjs.
//
// `kept` is the record as it stands now (what sync kept), `saved` the copy that was replaced. Only fields a
// person would recognise are named; the rest are "differs".

const IGNORE = new Set(['id', 'created_at', 'updated_at', 'createdAt', 'updatedAt', 'user_id', 'userId', '_generatedId', 'data']);
const NAMES = {
  date: 'date', duration: 'duration', energy: 'energy', enjoyment: 'enjoyment', wins: 'wins', teacher: 'teacher',
  tomorrowFocus: "tomorrow's focus", title: 'title', composer: 'composer', status: 'status', tempo: 'tempo',
  grade: 'grade', notes: 'notes', keys: 'keys', timeSigs: 'time signatures', spots: 'tricky spots',
  memorised: 'memorised', lastFromMemory: 'last played from memory',
};
const UNITS = { duration: ' min', tempo: ' bpm' };
const LONG = new Set(['wins', 'notes', 'tomorrowFocus']);
const MAX_SHOWN = 4;

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const words = key => String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const blank = v => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

function show(key, v) {
  if (blank(v)) return 'nothing';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (Array.isArray(v)) return v.map(x => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ');
  return `${v}${UNITS[key] || ''}`;
}

function describeKey(key, kept, saved) {
  const label = NAMES[key] || words(key);
  if (key === 'segments') {
    const a = (kept || []).length;
    const b = (saved || []).length;
    return a === b ? 'segment details differ' : `${plural(a, 'segment', 'segments')} kept, ${b} in this copy`;
  }
  if (key === 'spots') {
    const a = (kept || []).length;
    const b = (saved || []).length;
    return a === b ? 'tricky spots differ' : `${plural(a, 'tricky spot', 'tricky spots')} kept, ${b} in this copy`;
  }
  const scalar = v => blank(v) || ['string', 'number', 'boolean'].includes(typeof v) || Array.isArray(v);
  if (LONG.has(key) || !scalar(kept) || !scalar(saved)) return `${label} differ${label.endsWith('s') ? '' : 's'}`;
  return `${label}: ${show(key, kept)} kept, ${show(key, saved)} in this copy`;
}

// -> [string], at most four, then "and N more". An entry deleted since (no `kept`) says so.
export function describeConflictChanges(kept, saved) {
  if (!saved || typeof saved !== 'object') return [];
  if (!kept || typeof kept !== 'object') return ['The entry has been deleted since; using this copy brings it back.'];
  const keys = [...new Set([...Object.keys(kept), ...Object.keys(saved)])].filter(k => !IGNORE.has(k) && !same(kept[k], saved[k]));
  if (!keys.length) return ['The same content, saved at a different time.'];
  const named = keys.filter(k => NAMES[k] || k === 'segments');
  const rest = keys.filter(k => !(NAMES[k] || k === 'segments'));
  const ordered = [...named, ...rest];
  const lines = ordered.slice(0, MAX_SHOWN).map(k => describeKey(k, kept[k], saved[k]));
  if (ordered.length > MAX_SHOWN) lines.push(`and ${ordered.length - MAX_SHOWN} more`);
  return lines;
}
