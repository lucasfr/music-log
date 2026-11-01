// A sight-reading ladder: log each attempt with its level and how it went, and the app says when to step up
// or down a level, rather than just counting minutes. Pure (no React Native imports), so it's unit-tested in
// plain Node, see tests/sightLadder.test.mjs.
//
// Levels are general steps (not any exam board's), 1 to 8. An attempt is { date, level, rating } with the
// rating 1 (a struggle) to 5 (fluent). The attempts are kept as a list (the latest 60) in a preference.

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 8;
export const MAX_ATTEMPTS = 60;
export const UP_AFTER = 3;        // this many attempts at a level, averaging UP_AVERAGE or better, and it is time to step up
export const UP_AVERAGE = 4;
export const DOWN_AFTER = 2;      // this many in a row at a level, each rated DOWN_RATING or lower, and it is time to step down
export const DOWN_RATING = 2;

export const LEVELS = [
  { level: 1, label: 'One hand, a few notes, steady crotchets' },
  { level: 2, label: 'One hand at a time, simple rhythms' },
  { level: 3, label: 'Both hands, simple rhythms, no accidentals' },
  { level: 4, label: 'Both hands, a few accidentals, small rhythm changes' },
  { level: 5, label: 'Both hands, varied rhythms, changes of position' },
  { level: 6, label: 'Sharper keys, ties, mixed articulation' },
  { level: 7, label: 'Busier textures, tricky rhythms, key changes' },
  { level: 8, label: 'Dense or fast passages, as it would be met cold' },
];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const clampLevel = n => Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.round(Number(n)) || MIN_LEVEL));

export const levelLabel = level => (LEVELS.find(l => l.level === level) || LEVELS[0]).label;

// Stored JSON to a clean list, oldest first. Malformed entries are dropped.
export function parseAttempts(raw) {
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter(a => a && typeof a === 'object' && ISO.test(String(a.date || '')))
      .map(a => ({ date: a.date, level: Number(a.level), rating: Number(a.rating) }))
      .filter(a => Number.isInteger(a.level) && a.level >= MIN_LEVEL && a.level <= MAX_LEVEL && Number.isInteger(a.rating) && a.rating >= 1 && a.rating <= 5)
      .slice(-MAX_ATTEMPTS);
  } catch {
    return [];
  }
}

export const serializeAttempts = list => JSON.stringify(parseAttempts(JSON.stringify(list)));

// The list with one more attempt. A level or rating outside range is not added.
export function addAttempt(list, date, level, rating) {
  const a = { date, level: Math.round(Number(level)), rating: Math.round(Number(rating)) };
  return parseAttempts(JSON.stringify([...(list || []), a]));
}

// The level you are on: where the latest attempt was, or the bottom rung with no attempts.
export const currentLevel = list => (list && list.length ? list[list.length - 1].level : MIN_LEVEL);

const mean = xs => xs.reduce((a, v) => a + v, 0) / xs.length;

// What to do next. Looks at the unbroken run of latest attempts at the current level.
// -> { level (the one to try next), change: 'up' | 'down' | 'stay', current, runLength, average | null, reason }
export function suggestLevel(list) {
  const attempts = parseAttempts(JSON.stringify(list || []));
  const current = currentLevel(attempts);
  if (!attempts.length) return { level: current, change: 'stay', current, runLength: 0, average: null, reason: 'Log an attempt and the ladder will suggest where to go next.' };
  const run = [];
  for (let i = attempts.length - 1; i >= 0 && attempts[i].level === current; i -= 1) run.unshift(attempts[i].rating);
  const average = mean(run);
  const tail = run.slice(-DOWN_AFTER);
  if (run.length >= DOWN_AFTER && tail.every(r => r <= DOWN_RATING) && current > MIN_LEVEL) {
    return { level: current - 1, change: 'down', current, runLength: run.length, average, reason: `The last ${DOWN_AFTER} at level ${current} were a struggle: go back to level ${current - 1} and rebuild.` };
  }
  const recent = run.slice(-UP_AFTER);
  if (recent.length >= UP_AFTER && mean(recent) >= UP_AVERAGE && current < MAX_LEVEL) {
    return { level: current + 1, change: 'up', current, runLength: run.length, average, reason: `The last ${UP_AFTER} at level ${current} averaged ${Math.round(mean(recent) * 10) / 10}: time for level ${current + 1}.` };
  }
  const need = Math.max(0, UP_AFTER - run.length);
  const reason = need > 0
    ? `${need} more ${need === 1 ? 'attempt' : 'attempts'} at level ${current} before deciding whether to step up.`
    : `Level ${current} is not fluent yet (the last ${UP_AFTER} averaged ${Math.round(mean(recent) * 10) / 10}). Stay here.`;
  return { level: current, change: 'stay', current, runLength: run.length, average, reason };
}
