// A piece's status, derived from the practice and lessons logged against it. Pure (no React Native
// imports, and the date is passed in rather than read from the clock), so it is unit-tested in plain
// Node, see tests/status.test.mjs. utils.js wraps these with today's date, and constants.js
// re-exports the constants below, so existing imports keep working; any screen can use them directly.

// Status is derived from progress tags logged on repertoire segments, not
// manually set. 'breakthrough' and 'plateau' describe a single session's feel
// and don't map to a durable stage.
export const PROGRESS_TAG_TO_STATUS = {
  'new-piece': 'new',
  'consolidation': 'consolidating',
  'performance-ready': 'performance-ready',
};

// Ranking of active-practice stages so derivation tracks the highest ever
// reached, rather than regressing if a later session doesn't repeat an
// earlier tag.
export const STATUS_RANK = { new: 0, learning: 1, consolidating: 2, 'performance-ready': 3 };
export const RANK_TO_STATUS = ['new', 'learning', 'consolidating', 'performance-ready'];

// Days since the last repertoire log before an actively-practised piece
// rolls over to 'shelved'. Logging a new session/lesson immediately
// re-derives status, auto-unshelving it.
export const SHELVED_AFTER_DAYS = 60;

// Calendar-date arithmetic ('YYYY-MM-DD'), never by milliseconds, so a day is a day across the clocks
// changing. (The same two functions are in utils/statsCalc.js; this file has no imports so that it can
// be tested on its own.)
const parts = iso => [Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10))];

function addDays(iso, n) {
  const [y, m, d] = parts(iso);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + n);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

function daysBetween(a, b) {
  const t = iso => { const [y, m, d] = parts(iso); return Date.UTC(y, m - 1, d) / 86400000; };
  return Math.round(t(b) - t(a));
}

// ─── Composition status derivation ──────────────────────────────────────────
// Status is derived entirely from segments logged against a composition in
// sessions and lessons — whether logged as repertoire or as technique work
// linked to a library piece (e.g. Hanon).
//   - No logs at all       -> 'ambition' (the resting default for pieces not
//     yet actively practised)
//   - First log             -> exits ambition; 'new' unless its progress tags
//     already indicate more
//   - Subsequent logs        -> tracks the highest stage tag ever reached;
//     2+ logs with no stage tag at all settle into 'learning'
//   - Long inactivity on an actively-practised piece -> 'shelved'; a new log
//     immediately re-derives status, auto-unshelving it
// `manualShelvedAt` (composition.shelvedAt) is a deliberate "shelve now"
// override: forces 'shelved' immediately rather than waiting out the
// inactivity threshold, but only while no log has happened since — the
// moment a new session/lesson is logged after that date, it's ignored and
// derivation resumes normally (same auto-unshelve behaviour as the
// inactivity case).
export function deriveCompositionStatus(compositionId, sessions, lessons, manualShelvedAt, today) {
  const logs = [];
  (sessions || []).forEach(s => {
    (s.segments || []).forEach(seg => {
      if (seg.compositionId === compositionId) {
        logs.push({ date: s.date, progress: seg.progress || [] });
      }
    });
  });
  (lessons || []).forEach(l => {
    (l.segments || []).forEach(seg => {
      if (seg.compositionId === compositionId) {
        logs.push({ date: l.date, progress: seg.progress || [] });
      }
    });
  });

  if (logs.length === 0) return 'ambition';

  const lastDate = logs.map(l => l.date).sort().at(-1);

  if (manualShelvedAt && lastDate <= manualShelvedAt) return 'shelved';

  let rank = STATUS_RANK.new;
  logs.forEach(({ progress }) => {
    progress.forEach(tag => {
      const status = PROGRESS_TAG_TO_STATUS[tag];
      if (status && STATUS_RANK[status] > rank) rank = STATUS_RANK[status];
    });
  });
  if (rank === STATUS_RANK.new && logs.length > 1) rank = STATUS_RANK.learning;

  const daysSince = daysBetween(lastDate, today);
  if (daysSince >= SHELVED_AFTER_DAYS) return 'shelved';

  return RANK_TO_STATUS[rank];
}

// Reconstructs a piece's full status history with per-stage tallies: how
// many sessions/lessons were logged in each stage, total minutes, and the
// date range — including any 'shelved' quiet gaps between logs. Contiguous
// logs of the same derived stage are merged into one row (safe because rank
// only ever increases, so each active stage forms one continuous block).
// `manualShelvedAt` mirrors the override in deriveCompositionStatus: if set
// and no log has happened since, the tail of the history is trimmed/replaced
// with a 'shelved' segment running from that date to today.
export function deriveStatusHistory(compositionId, sessions, lessons, manualShelvedAt, today) {
  const logs = [];
  (sessions || []).forEach(s => {
    (s.segments || []).forEach(seg => {
      if (seg.compositionId === compositionId) {
        logs.push({ date: s.date, progress: seg.progress || [], minutes: Number(seg.duration) || 0 });
      }
    });
  });
  (lessons || []).forEach(l => {
    (l.segments || []).forEach(seg => {
      if (seg.compositionId === compositionId) {
        logs.push({ date: l.date, progress: seg.progress || [], minutes: Number(seg.duration) || 0 });
      }
    });
  });
  logs.sort((a, b) => a.date.localeCompare(b.date));

  if (logs.length === 0) return [];

  const raw = [];
  let rank = STATUS_RANK.new;

  for (let i = 0; i < logs.length; i++) {
    logs[i].progress.forEach(tag => {
      const status = PROGRESS_TAG_TO_STATUS[tag];
      if (status && STATUS_RANK[status] > rank) rank = STATUS_RANK[status];
    });
    if (rank === STATUS_RANK.new && i > 0) rank = STATUS_RANK.learning;

    const status  = RANK_TO_STATUS[rank];
    const segStart = logs[i].date;
    const nextDate = logs[i + 1]?.date ?? today;
    const gapDays  = daysBetween(segStart, nextDate);

    if (gapDays > SHELVED_AFTER_DAYS) {
      const activeEnd = addDays(segStart, SHELVED_AFTER_DAYS);
      raw.push({ status, start: segStart, end: activeEnd, count: 1, minutes: logs[i].minutes });
      raw.push({ status: 'shelved', start: activeEnd, end: nextDate, count: 0, minutes: 0 });
    } else {
      raw.push({ status, start: segStart, end: nextDate, count: 1, minutes: logs[i].minutes });
    }
  }

  const merged = [];
  raw.forEach(seg => {
    const last = merged[merged.length - 1];
    if (last && last.status === seg.status) {
      last.end = seg.end;
      last.count += seg.count;
      last.minutes += seg.minutes;
    } else {
      merged.push({ ...seg });
    }
  });

  const lastLogDate = logs[logs.length - 1].date;
  if (manualShelvedAt && lastLogDate <= manualShelvedAt) {
    // Trim any segments that start on/after the manual shelve date, clip
    // whatever remains up to that date, then append the manual shelved tail.
    while (merged.length && merged[merged.length - 1].start >= manualShelvedAt) {
      merged.pop();
    }
    if (merged.length && merged[merged.length - 1].end > manualShelvedAt) {
      merged[merged.length - 1].end = manualShelvedAt;
    }
    merged.push({ status: 'shelved', start: manualShelvedAt, end: today, count: 0, minutes: 0 });
  }

  return merged;
}
