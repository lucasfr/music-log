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

// Reconstructs how a piece's derived status changed over time, for the
// Timeline chart to render as colour changes along the bar rather than one
// flat colour. Returns an ordered list of { start, end, status } date-string
// ranges. Empty array means no logs exist yet (piece is still in ambition).
export function deriveStatusTimeline(compositionId, sessions, lessons) {
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
  logs.sort((a, b) => a.date.localeCompare(b.date));

  if (logs.length === 0) return [];

  const todayISO = new Date().toISOString().slice(0, 10);
  const addDays = (iso, n) => {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const daysBetween = (a, b) => Math.floor((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);

  const segments = [];
  let rank = STATUS_RANK.new;

  for (let i = 0; i < logs.length; i++) {
    // Update rank using only logs seen up to this point — a true historical
    // reconstruction, not the piece's present-day status applied backwards.
    logs[i].progress.forEach(tag => {
      const status = PROGRESS_TAG_TO_STATUS[tag];
      if (status && STATUS_RANK[status] > rank) rank = STATUS_RANK[status];
    });
    if (rank === STATUS_RANK.new && i > 0) rank = STATUS_RANK.learning;

    const segStart = logs[i].date;
    const nextDate = logs[i + 1]?.date ?? todayISO;
    const gapDays  = daysBetween(segStart, nextDate);

    if (gapDays > SHELVED_AFTER_DAYS) {
      // Active for SHELVED_AFTER_DAYS after this log, then shelved until the
      // next one (or today, if this is the most recent log)
      const activeEnd = addDays(segStart, SHELVED_AFTER_DAYS);
      segments.push({ start: segStart, end: activeEnd, status: RANK_TO_STATUS[rank] });
      segments.push({ start: activeEnd, end: nextDate, status: 'shelved' });
    } else {
      segments.push({ start: segStart, end: nextDate, status: RANK_TO_STATUS[rank] });
    }
  }

  return segments;
}
