// Sections of a piece: split it into parts ("A", "bars 17 to 32", "coda") and give each its own stage, so you can
// see which part is holding the whole piece back. Tricky spots track single bars and the performance countdown
// tracks the whole piece; sections sit between them. When a piece has sections, the countdown reads its stages
// from them (the weakest section decides). The list is kept on the piece (`piece.sections`), so it travels in
// the Supabase `data` column like the piece's other extras. Pure (no React Native imports), so it's
// unit-tested in plain Node, see tests/sections.test.mjs.

// 0 not started, 1 notes learned, 2 hands together, 3 up to tempo, 4 memorised.
export const STAGE_LABELS = ['Not started', 'Notes learned', 'Hands together', 'Up to tempo', 'Memorised'];
export const MIN_STAGE = 0;
export const MAX_STAGE = 4;
const MAX_SECTIONS = 24;
const MAX_NAME = 40;

const clampStage = n => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(MIN_STAGE, Math.min(MAX_STAGE, v)) : MIN_STAGE;
};
const nameKey = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

// A piece's stored sections, cleaned: a name and a stage each, no blank names, each name once.
export function parseSections(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  raw.forEach(x => {
    if (!x || typeof x !== 'object') return;
    const name = String(x.name || '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME);
    const key = nameKey(name);
    if (!name || seen.has(key)) return;
    seen.add(key);
    out.push({ id: String(x.id || key), name, stage: clampStage(x.stage) });
  });
  return out.slice(0, MAX_SECTIONS);
}

// The list with a new section (at stage 0). Nothing is added for a blank or repeated name.
export function addSection(sections, name, makeId = () => `sec-${Math.random().toString(36).slice(2, 9)}`) {
  const list = parseSections(sections);
  const clean = String(name || '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME);
  if (!clean || list.some(s => nameKey(s.name) === nameKey(clean)) || list.length >= MAX_SECTIONS) return list;
  return [...list, { id: makeId(), name: clean, stage: 0 }];
}

export const removeSection = (sections, id) => parseSections(sections).filter(s => s.id !== id);

// One section set to a stage (kept within 0 to 4).
export const setSectionStage = (sections, id, stage) => parseSections(sections).map(s => (s.id === id ? { ...s, stage: clampStage(stage) } : s));

// One section a stage further on, going back to "not started" after "memorised", so a tap cycles round.
export function cycleSection(sections, id) {
  return parseSections(sections).map(s => (s.id === id ? { ...s, stage: s.stage >= MAX_STAGE ? MIN_STAGE : s.stage + 1 } : s));
}

// The section furthest behind (the first, if several are level), or null with no sections.
export function weakestSection(sections) {
  const list = parseSections(sections);
  if (!list.length) return null;
  return list.reduce((w, s) => (s.stage < w.stage ? s : w), list[0]);
}

// The lowest stage across the sections (what the whole piece can claim), or null with none.
export function pieceStageFromSections(sections) {
  const list = parseSections(sections);
  return list.length ? Math.min(...list.map(s => s.stage)) : null;
}

// For the page: "3 of 4 sections up to tempo. Holding it back: coda (notes learned).", or '' with none.
export function describeSections(sections) {
  const list = parseSections(sections);
  if (!list.length) return '';
  const low = Math.min(...list.map(s => s.stage));
  const high = Math.max(...list.map(s => s.stage));
  if (low === high) return `All ${list.length} ${list.length === 1 ? 'section is' : 'sections are'} at "${STAGE_LABELS[low].toLowerCase()}".`;
  const atOrAbove = list.filter(s => s.stage >= high).length;
  const weak = weakestSection(list);
  return `${atOrAbove} of ${list.length} ${list.length === 1 ? 'section' : 'sections'} at "${STAGE_LABELS[high].toLowerCase()}". Holding it back: ${weak.name} (${STAGE_LABELS[weak.stage].toLowerCase()}).`;
}
