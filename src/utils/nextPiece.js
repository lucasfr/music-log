// Which piece to bring up next. Your grade target needs a number of pieces at a grade performance-ready; this
// says how many you have, how many are missing, and which library pieces are closest to ready (or ambitions
// you have not started). Pure (no React Native imports), so it's unit-tested in plain Node, see
// tests/nextPiece.test.mjs.

const CLOSENESS = { consolidating: 3, learning: 2, new: 1, ambition: 0 };
const WORDS = {
  consolidating: 'nearly there, consolidating',
  learning: 'in progress',
  new: 'not started',
  ambition: 'an ambition not started yet',
};

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// `target` is { grade, piecesNeeded } (the grade target). -> null when there is nothing to say (no grade, or no
// pieces needed); otherwise { grade, needed, ready, shortfall, candidates: [{ id, title, composer, status, reason }], line }.
export function suggestNextPieces(compositions, target, limit = 3) {
  const grade = target && String(target.grade || '');
  const needed = Math.max(0, Math.round(Number(target && target.piecesNeeded)) || 0);
  if (!grade || needed <= 0) return null;

  const ofGrade = (compositions || []).filter(c => c && String(c.grade || '') === grade && c.status !== 'shelved');
  const ready = ofGrade.filter(c => c.status === 'performance-ready').length;
  const shortfall = Math.max(0, needed - ready);

  const candidates = ofGrade
    .filter(c => c.status !== 'performance-ready')
    .sort((a, b) => (CLOSENESS[b.status] ?? 1) - (CLOSENESS[a.status] ?? 1) || String(a.title || '').localeCompare(String(b.title || '')))
    .slice(0, Math.max(0, limit))
    .map(c => ({ id: c.id, title: c.title || 'Untitled', composer: c.composer || '', status: c.status, reason: WORDS[c.status] || 'in your library' }));

  let line;
  if (shortfall === 0) line = `You have ${plural(ready, 'piece', 'pieces')} performance-ready for ${grade}, enough for the ${needed} needed.`;
  else if (ofGrade.length - ready >= shortfall) line = `${ready} of ${needed} performance-ready for ${grade}. Closest to ready: ${candidates.slice(0, shortfall).map(c => c.title).join(', ')}.`;
  else {
    const more = shortfall - (ofGrade.length - ready);
    line = `${ready} of ${needed} performance-ready for ${grade}, and only ${plural(ofGrade.length - ready, 'more piece', 'more pieces')} in your library at that grade: add ${more} more.`;
  }
  return { grade, needed, ready, shortfall, candidates: shortfall === 0 ? [] : candidates, line };
}
