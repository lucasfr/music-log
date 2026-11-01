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
// on each item, by index. -> { total, count, needsWork: [labels], needsWorkItems: [{ kind, label }],
// slowest: { label, seconds } | null, line }
export function summariseMockExam(items, marks, seconds) {
  const list = items || [];
  const m = marks || {};
  const secs = list.map((_, i) => Math.max(0, Math.round(Number((seconds || [])[i]) || 0)));
  const total = secs.reduce((a, v) => a + v, 0);
  const needsWorkItems = list.filter((_, i) => m[i]).map(x => ({ kind: x.kind, label: x.label }));
  const needsWork = needsWorkItems.map(x => x.label);
  let slowest = null;
  secs.forEach((v, i) => { if (v > 0 && (!slowest || v > slowest.seconds)) slowest = { label: list[i].label, seconds: v }; });
  const count = `${list.length} ${list.length === 1 ? 'item' : 'items'}`;
  const line = needsWork.length
    ? `${count} in ${formatElapsed(total)}. ${needsWork.length} to work on.`
    : `${count} in ${formatElapsed(total)}. Nothing flagged.`;
  return { total, count: list.length, needsWork, needsWorkItems, slowest, line };
}

// ── History ──────────────────────────────────────────────────────────────────────────────────
//
// Each finished mock exam is kept as { date, total (seconds), count, flagged: [{ kind, label }] }, newest
// last, so the next one can say how it compares, and what you flagged feeds Today's plan for a while.

export const MAX_RUNS = 20;
export const FLAG_FRESH_DAYS = 14;   // a run's flags shape Today's plan for this long

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ['scale', 'arpeggio', 'piece', 'sight'];

// Stored JSON to a clean history. Anything malformed is dropped rather than breaking a screen.
export function parseMockHistory(raw) {
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter(r => r && typeof r === 'object' && ISO.test(String(r.date || '')))
      .map(r => ({
        date: r.date,
        total: Math.max(0, Math.round(Number(r.total)) || 0),
        count: Math.max(0, Math.round(Number(r.count)) || 0),
        flagged: (Array.isArray(r.flagged) ? r.flagged : [])
          .filter(f => f && KINDS.includes(f.kind) && typeof f.label === 'string' && f.label)
          .map(f => ({ kind: f.kind, label: f.label })),
      }))
      .slice(-MAX_RUNS);
  } catch {
    return [];
  }
}

export const serializeMockHistory = history => JSON.stringify(parseMockHistory(JSON.stringify(history)));

// The history with one more finished run on the end (the oldest drop off past MAX_RUNS).
export function addMockRun(history, date, summary) {
  const run = { date, total: summary.total, count: summary.count, flagged: summary.needsWorkItems || [] };
  return parseMockHistory(JSON.stringify([...(history || []), run]));
}

// Whole calendar days from a to b, by date (so the clocks changing can't move it).
const dayNumber = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;
const daysBetween = (a, b) => Math.round(dayNumber(b) - dayNumber(a));

// What the latest mock exam flagged, while it is recent enough to matter: [{ kind, label }], or [] when
// the latest run is older than `maxDays`, flagged nothing, or there is no history.
export function freshFlags(history, today, maxDays = FLAG_FRESH_DAYS) {
  const list = parseMockHistory(JSON.stringify(history || []));
  const last = list[list.length - 1];
  if (!last || !ISO.test(String(today || ''))) return [];
  const age = daysBetween(last.date, today);
  return age >= 0 && age <= maxDays ? last.flagged : [];
}

// How the latest run compares with the one before, in a sentence; null with fewer than two runs.
export function describeMockProgress(history) {
  const list = parseMockHistory(JSON.stringify(history || []));
  if (list.length < 2) return null;
  const last = list[list.length - 1];
  const prev = list[list.length - 2];
  const flagged = last.flagged.length === prev.flagged.length ? `still ${last.flagged.length} flagged`
    : last.flagged.length < prev.flagged.length ? `${last.flagged.length} flagged, down from ${prev.flagged.length}`
      : `${last.flagged.length} flagged, up from ${prev.flagged.length}`;
  const diff = last.total - prev.total;
  const time = Math.abs(diff) < 15 ? 'about the same time as' : diff < 0 ? `${formatElapsed(-diff)} quicker than` : `${formatElapsed(diff)} slower than`;
  return `Last mock exam: ${flagged}, ${time} the one before.`;
}
