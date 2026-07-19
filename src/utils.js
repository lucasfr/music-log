import { Alert, Platform } from 'react-native';
import { PROGRESS_TAG_TO_STATUS, STATUS_RANK, RANK_TO_STATUS, SHELVED_AFTER_DAYS } from './constants';

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function fmtDateShort(iso) {
  if (!iso) return '';
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

// ─── Scale entries ───────────────────────────────────────────────────────────
// A scale entry in segment.scales can be:
//   - a plain string (oldest legacy, e.g. 'C major') — parallel motion, octaves
//     falls back to the segment's old shared `octaves` field
//   - an object { scale, motion } (legacy) — octaves still falls back to the
//     segment's shared `octaves` field
//   - an object { scale, motion, octaves } (current) — fully self-contained
// These helpers normalise access so all three generations of data read the
// same way. `fallbackOctaves` should be passed as `segment.octaves || 1` by
// callers so older entries without their own octaves value still display
// correctly.

export function scaleName(entry) {
  return typeof entry === 'string' ? entry : entry.scale;
}

export function scaleMotion(entry) {
  return typeof entry === 'string' ? 'parallel' : (entry.motion || 'parallel');
}

export function scaleOctaves(entry, fallbackOctaves = 1) {
  if (typeof entry === 'string') return fallbackOctaves;
  return entry.octaves || fallbackOctaves;
}

export function formatScaleEntry(entry, fallbackOctaves = 1) {
  const name = scaleName(entry);
  const motion = scaleMotion(entry);
  const octaves = scaleOctaves(entry, fallbackOctaves);
  const attrs = [`${octaves}oct`];
  if (motion === 'contrary') attrs.push('contrary');
  return `${name} (${attrs.join(', ')})`;
}

// ─── Local UI preferences ──────────────────────────────────────────
// Persists small UI choices (e.g. which toggle was last selected) across
// launches. Web-only for now (uses localStorage, same pattern as the
// Supabase credentials in lib/supabase.js) — on native this silently
// no-ops, so the preference just resets each launch instead of crashing.
const PREF_PREFIX = 'musiclog_pref_';

export function getLocalPref(key, fallback = null) {
  if (typeof localStorage === 'undefined') return fallback;
  const raw = localStorage.getItem(PREF_PREFIX + key);
  return raw === null ? fallback : raw;
}

export function setLocalPref(key, value) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(PREF_PREFIX + key, value);
}

// Alert.alert is a no-op on web — use window.confirm there instead
export function confirmDelete(title, message, onConfirm) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

// ─── Composition status derivation ──────────────────────────────────────────
// Status is derived entirely from segments logged against a composition in
// sessions and lessons — whether logged as repertoire or as technique work
// linked to a library piece (e.g. Hanon) — no manual editing.
//   - No logs at all       -> 'ambition' (the resting default for pieces not
//     yet actively practised)
//   - First log             -> exits ambition; 'new' unless its progress tags
//     already indicate more
//   - Subsequent logs        -> tracks the highest stage tag ever reached;
//     2+ logs with no stage tag at all settle into 'learning'
//   - Long inactivity on an actively-practised piece -> 'shelved'; a new log
//     immediately re-derives status, auto-unshelving it
export function deriveCompositionStatus(compositionId, sessions, lessons) {
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

  let rank = STATUS_RANK.new;
  logs.forEach(({ progress }) => {
    progress.forEach(tag => {
      const status = PROGRESS_TAG_TO_STATUS[tag];
      if (status && STATUS_RANK[status] > rank) rank = STATUS_RANK[status];
    });
  });
  if (rank === STATUS_RANK.new && logs.length > 1) rank = STATUS_RANK.learning;

  const lastDate = logs.map(l => l.date).sort().at(-1);
  const daysSince = Math.floor((new Date() - new Date(lastDate + 'T12:00:00')) / 86400000);
  if (daysSince >= SHELVED_AFTER_DAYS) return 'shelved';

  return RANK_TO_STATUS[rank];
}

// Reconstructs a piece's full status history with per-stage tallies: how
// many sessions/lessons were logged in each stage, total minutes, and the
// date range — including any 'shelved' quiet gaps between logs. Contiguous
// logs of the same derived stage are merged into one row (safe because rank
// only ever increases, so each active stage forms one continuous block).
export function deriveStatusHistory(compositionId, sessions, lessons) {
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

  const todayISO = new Date().toISOString().slice(0, 10);
  const addDays = (iso, n) => {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const daysBetween = (a, b) => Math.floor((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);

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
    const nextDate = logs[i + 1]?.date ?? todayISO;
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

  return merged;
}

// Reconstructs how a piece's derived status changed over time, for the
// Timeline chart to render as colour changes along the bar rather than one
// flat colour. Returns an ordered list of { start, end, status } date-string
// ranges. Empty array means no logs exist yet (piece is still in ambition).
export function deriveStatusTimeline(compositionId, sessions, lessons) {
  return deriveStatusHistory(compositionId, sessions, lessons)
    .map(({ start, end, status }) => ({ start, end, status }));
}
