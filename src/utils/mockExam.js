// A mock exam: from your grade target, a random pick of the scales and arpeggios it asks for, then
// your pieces, then sight-reading, taken one at a time against the clock, the way an exam goes. Pure
// (no React Native imports), so it's unit-tested in plain Node, see tests/mockExam.test.mjs.
//
// It draws on `readiness(...)` from utils/insights.js (the same lists the Grade target card shows), so
// there is nothing extra to enter: the requirements are the ones you typed into the target.

export const DEFAULT_SCALES = 4;
export const DEFAULT_ARPEGGIOS = 2;

// A small seeded random generator (mulberry32), so a mock exam can be reproduced in a test. The app
// uses Math.random; a test passes makeRng(seed).
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A shuffled copy (Fisher-Yates); the list given is not changed.
export function shuffled(list, rng = Math.random) {
  const out = [...(list || [])];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// `r` is the readiness result: { scales: [...], arpeggios: [...], pieces: { needed, list: [{ id, title }] } }.
// `describe` turns a scale or arpeggio requirement into text (describeRequirement in utils/insights.js).
// -> [{ kind: 'scale' | 'arpeggio' | 'piece' | 'sight', label }]
export function buildMockExam(r, rng = Math.random, { scales = DEFAULT_SCALES, arpeggios = DEFAULT_ARPEGGIOS, describe = q => q.name } = {}) {
  const items = [];
  const take = (list, n, kind) => shuffled(list, rng).slice(0, Math.max(0, n)).forEach(q => items.push({ kind, label: describe(q) }));
  take((r && r.scales) || [], scales, 'scale');
  take((r && r.arpeggios) || [], arpeggios, 'arpeggio');

  const pieces = (r && r.pieces) || {};
  const listed = (pieces.list || []).filter(p => p && p.title);
  const needed = Math.max(0, Math.round(Number(pieces.needed)) || 0);
  if (listed.length) listed.forEach(p => items.push({ kind: 'piece', label: p.title }));
  else for (let i = 1; i <= needed; i += 1) items.push({ kind: 'piece', label: `Piece ${i}` });

  items.push({ kind: 'sight', label: 'Sight-reading' });
  return items;
}

// 75 -> '1:15', 5 -> '0:05', 3725 -> '1:02:05'
export function formatElapsed(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

// How it went. `marks` is { [index]: true } for the items flagged "needs work"; `seconds` is the time taken
// on each item, by index. -> { total, count, needsWork: [labels], slowest: { label, seconds } | null, line }
export function summariseMockExam(items, marks, seconds) {
  const list = items || [];
  const m = marks || {};
  const secs = list.map((_, i) => Math.max(0, Math.round(Number((seconds || [])[i]) || 0)));
  const total = secs.reduce((a, v) => a + v, 0);
  const needsWork = list.filter((_, i) => m[i]).map(x => x.label);
  let slowest = null;
  secs.forEach((v, i) => { if (v > 0 && (!slowest || v > slowest.seconds)) slowest = { label: list[i].label, seconds: v }; });
  const count = `${list.length} ${list.length === 1 ? 'item' : 'items'}`;
  const line = needsWork.length
    ? `${count} in ${formatElapsed(total)}. ${needsWork.length} to work on.`
    : `${count} in ${formatElapsed(total)}. Nothing flagged.`;
  return { total, count: list.length, needsWork, slowest, line };
}
