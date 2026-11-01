// "From memory": marking a piece as memorised, and when it was last played without the score. The
// fields live on the piece (`memorised`, `memorisedAt`, `lastFromMemory`), so they travel in the
// Supabase `data` column like the piece's other extras and need no schema change. Pure (no React
// Native imports), so it's unit-tested in plain Node, see tests/memory.test.mjs.
//
// Dates are local 'YYYY-MM-DD' strings; day arithmetic is done at local noon so a daylight-saving
// change can't push a date across midnight.

export const STALE_AFTER_DAYS = 14;   // a memorised piece not played from memory for this long is due a run

const noon = s => new Date(`${s}T12:00:00`);
const validDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(noon(s).getTime());
const daysBetween = (from, to) => Math.round((noon(to) - noon(from)) / 86400000);

// Where a piece stands. `line` is the one-line summary shown on the piece's page; null when the piece
// isn't memorised.
export function memoryState(piece, today) {
  if (!piece || !piece.memorised) return { memorised: false, since: null, lastPlayed: null, daysSince: null, stale: false, line: null };
  const since = validDate(piece.memorisedAt) ? piece.memorisedAt : null;
  const lastPlayed = validDate(piece.lastFromMemory) ? piece.lastFromMemory : null;
  const daysSince = lastPlayed ? Math.max(0, daysBetween(lastPlayed, today)) : null;
  const stale = daysSince === null ? false : daysSince >= STALE_AFTER_DAYS;
  let line;
  if (daysSince === null) line = 'Memorised. Not yet played from memory since you marked it.';
  else if (daysSince === 0) line = 'Memorised. Played from memory today.';
  else line = `Memorised. Last played from memory ${daysSince} ${daysSince === 1 ? 'day' : 'days'} ago${stale ? ', so due a run-through' : ''}.`;
  return { memorised: true, since, lastPlayed, daysSince, stale, line };
}

// The piece marked memorised, or not. Marking keeps the date it was first memorised; unmarking keeps
// the history, so marking it again later carries on from there.
export function withMemorised(piece, on, today) {
  if (on) return { ...piece, memorised: true, memorisedAt: validDate(piece.memorisedAt) ? piece.memorisedAt : today };
  return { ...piece, memorised: false };
}

// "Played from memory today": also marks the piece memorised if it wasn't.
export function withPlayedFromMemory(piece, today) {
  return { ...withMemorised(piece, true, today), lastFromMemory: today };
}

// The ids of the memorised pieces, for lists that only have the piece's id to go on.
export const memorisedIds = compositions => new Set((compositions || []).filter(c => c && c.memorised).map(c => c.id));
