// Planning helpers: the weekly goal, the backup nudge, saved timer routines and the grade
// pathway. Pure (no React Native imports), so they're unit-tested in plain Node, see
// tests/planning.test.mjs.

const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const makeIdDefault = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

// Whole days from date a to date b ('YYYY-MM-DD'), by calendar date (immune to DST).
export function daysBetween(a, b) {
  const n = s => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) / 86400000;
  return Math.round(n(b) - n(a));
}

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + n);
  return iso(d);
}

// ── Weekly goal ──────────────────────────────────────────────────────────────────────

export const GOAL_OPTIONS = [0, 60, 120, 180, 240, 300]; // minutes a week; 0 = no goal

// A stored goal (a string) to whole minutes; anything unusable means "no goal".
export function parseGoal(raw) {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n > 0 && n <= 3000 ? n : 0;
}

export function goalProgress(minutes, goal) {
  const g = parseGoal(goal);
  if (!g) return null;
  const m = Math.max(0, Number(minutes) || 0);
  return { goal: g, minutes: m, fraction: Math.min(1, m / g), remaining: Math.max(0, g - m), reached: m >= g };
}

// ── Backup nudge ─────────────────────────────────────────────────────────────────────

export const BACKUP_AFTER_DAYS = 14;
export const BACKUP_SNOOZE_DAYS = 7;

// Should we remind the user to back up? Never when there's nothing to lose or while snoozed.
// Otherwise once BACKUP_AFTER_DAYS have passed since the last backup, or (if they've never
// backed up) since their first session. Returns { days, never } or null.
export function backupNudge({ lastBackup, snoozedUntil, today, sessionCount, firstSessionDate }) {
  if (!sessionCount) return null;
  if (snoozedUntil && today < snoozedUntil) return null;
  if (lastBackup) {
    const days = daysBetween(lastBackup, today);
    return days >= BACKUP_AFTER_DAYS ? { days, never: false } : null;
  }
  const days = firstSessionDate ? daysBetween(firstSessionDate, today) : 0;
  return days >= BACKUP_AFTER_DAYS ? { days, never: true } : null;
}

export function snoozeUntil(today) { return addDays(today, BACKUP_SNOOZE_DAYS); }

// ── Saved timer routines ─────────────────────────────────────────────────────────────
// A routine is { id, name, segments: [{ type, title, compositionId, plannedMinutes, articulation? }] },
// the same segment shape the timer setup uses (minus its per-draft id and `confirmed` flag).

export const MAX_ROUTINES = 12;
const NAME_MAX = 40;
const clampMinutes = m => Math.min(60, Math.max(1, Math.round(Number(m) || 10)));

function cleanSegment(seg) {
  const out = {
    type: seg.type === 'repertoire' ? 'repertoire' : 'technique',
    title: String(seg.title || ''),
    compositionId: seg.compositionId ? String(seg.compositionId) : '',
    plannedMinutes: clampMinutes(seg.plannedMinutes),
  };
  if (seg.articulation) out.articulation = seg.articulation;
  return out;
}

// Stored JSON to a clean list. Anything malformed is dropped rather than crashing the screen.
export function parseRoutines(raw) {
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter(r => r && typeof r.name === 'string' && r.name.trim() && Array.isArray(r.segments) && r.segments.length)
      .map(r => ({ id: String(r.id || makeIdDefault()), name: r.name.trim().slice(0, NAME_MAX), segments: r.segments.map(cleanSegment) }))
      .slice(0, MAX_ROUTINES);
  } catch {
    return [];
  }
}

export const serializeRoutines = list => JSON.stringify(list);

// Add a routine (newest first). Saving under an existing name replaces it; the list is capped.
export function addRoutine(list, name, segments, makeId = makeIdDefault) {
  const trimmed = String(name || '').trim().slice(0, NAME_MAX);
  if (!trimmed || !segments || segments.length === 0) return list;
  const entry = { id: makeId(), name: trimmed, segments: segments.map(cleanSegment) };
  const others = list.filter(r => r.name.toLowerCase() !== trimmed.toLowerCase());
  return [entry, ...others].slice(0, MAX_ROUTINES);
}

export const removeRoutine = (list, id) => list.filter(r => r.id !== id);

// A routine as timer-setup drafts, with fresh ids. A segment that can run comes back
// `confirmed` (collapsed); one whose piece has since been removed from the library stays open.
export function routineToPlan(routine, compositions, makeId = makeIdDefault) {
  return routine.segments.map(seg => {
    const isTech = seg.type === 'technique';
    const comp = (compositions || []).find(c => c.id === seg.compositionId);
    const draft = {
      id: makeId(),
      type: seg.type,
      title: isTech ? seg.title : (comp ? comp.title : seg.title),
      compositionId: comp ? comp.id : '',
      plannedMinutes: seg.plannedMinutes,
    };
    if (isTech && seg.articulation) draft.articulation = seg.articulation;
    draft.confirmed = isTech ? !!draft.title : !!draft.compositionId;
    return draft;
  });
}

// ── Grade pathway ────────────────────────────────────────────────────────────────────

export const GRADE_ORDER = ['Pre-Grade 1', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Diploma'];
const STATUS_WEIGHT = { 'performance-ready': 4, consolidating: 3, learning: 2, new: 1, shelved: 0, ambition: -1 };

// The library grouped by grade, easiest first: each piece with the minutes you've logged on it
// (summed from session segments linked to it) and when you last played it, plus per-grade
// counts. Pieces with no grade are left out. Within a grade, furthest-along comes first.
export function gradePathway(compositions, sessions) {
  const minutes = {};
  const last = {};
  (sessions || []).forEach(s => (s.segments || []).forEach(seg => {
    if (!seg.compositionId) return;
    minutes[seg.compositionId] = (minutes[seg.compositionId] || 0) + (Number(seg.duration) || 0);
    if (!last[seg.compositionId] || s.date > last[seg.compositionId]) last[seg.compositionId] = s.date;
  }));

  const groups = {};
  (compositions || []).forEach(c => {
    if (!c.grade) return;
    (groups[c.grade] = groups[c.grade] || []).push({
      id: c.id, title: c.title || 'Untitled', composer: c.composer || '',
      status: c.status || 'new', minutes: minutes[c.id] || 0, lastPlayed: last[c.id] || null,
    });
  });

  const order = [...GRADE_ORDER.filter(g => groups[g]), ...Object.keys(groups).filter(g => !GRADE_ORDER.includes(g)).sort()];
  return order.map(grade => {
    const pieces = groups[grade].sort((a, b) =>
      (STATUS_WEIGHT[b.status] ?? 0) - (STATUS_WEIGHT[a.status] ?? 0) || b.minutes - a.minutes || a.title.localeCompare(b.title));
    const counts = {};
    pieces.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });
    return {
      grade, pieces, counts,
      total: pieces.length,
      ready: counts['performance-ready'] || 0,
      minutes: pieces.reduce((sum, p) => sum + p.minutes, 0),
    };
  });
}

// ── Practice reminder ────────────────────────────────────────────────────────────

export const REMINDER_TIMES = ['08:00', '12:00', '18:00', '20:00'];

// 'HH:MM' (24h) to { hour, minute }, or null for anything else (including '' = reminders off).
export function parseReminderTime(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ''));
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

// ── Sorting the library ────────────────────────────────────────────────────────────────────────────────

export const PIECE_SORTS = [
  { key: 'title', label: 'A–Z' },
  { key: 'recent', label: 'Recent' },
  { key: 'grade', label: 'Grade' },
];

// The date each piece was last practised, from the session segments linked to it.
function lastPlayedByPiece(sessions) {
  const last = {};
  (sessions || []).forEach(s => (s.segments || []).forEach(seg => {
    if (seg.compositionId && s.date && (!last[seg.compositionId] || s.date > last[seg.compositionId])) last[seg.compositionId] = s.date;
  }));
  return last;
}

// A sorted copy of the library. 'title' is A–Z; 'recent' puts the most recently practised first
// and never-practised pieces last; 'grade' goes easiest first with ungraded pieces last. Ties
// always fall back to the title, so the order is stable.
export function sortPieces(compositions, sessions, mode = 'title') {
  const byTitle = (a, b) => (a.title || '').localeCompare(b.title || '');
  const list = [...(compositions || [])];
  if (mode === 'recent') {
    const last = lastPlayedByPiece(sessions);
    return list.sort((a, b) => {
      const la = last[a.id] || '';
      const lb = last[b.id] || '';
      if (la === lb) return byTitle(a, b);
      if (!la) return 1;
      if (!lb) return -1;
      return lb.localeCompare(la);
    });
  }
  if (mode === 'grade') {
    const rank = g => { const i = GRADE_ORDER.indexOf(g); return i < 0 ? Infinity : i; };
    return list.sort((a, b) => {
      const ra = rank(a.grade);
      const rb = rank(b.grade);
      if (ra === rb) return byTitle(a, b);
      return ra < rb ? -1 : 1;
    });
  }
  return list.sort(byTitle);
}
