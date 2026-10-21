import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ARTICULATION_LABELS } from './constants';
import { deriveCompositionStatus as deriveStatusOn, deriveStatusHistory as deriveHistoryOn } from './utils/status';
import { scaleName, scaleMotion, scaleInterval, scaleOctaves, articulationOf, dynamicsOf, formatDynamics } from './utils/scaleStats';

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Local-calendar YYYY-MM-DD for a Date. Don't use toISOString() for this: it
// converts to UTC first, so a local-midnight Date in BST lands on the previous day.
export function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayISO() {
  return localISO(new Date());
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

// scaleName, scaleMotion, scaleInterval, scaleOctaves and articulationOf live in utils/scaleStats.js
// (pure, so they're tested); they're re-exported here so imports from this file keep working.
export { scaleName, scaleMotion, scaleInterval, scaleOctaves, articulationOf, dynamicsOf, formatDynamics };

export function formatScaleEntry(entry, fallbackOctaves = 1) {
  const name = scaleName(entry);
  const motion = scaleMotion(entry);
  const interval = scaleInterval(entry);
  const octaves = scaleOctaves(entry, fallbackOctaves);
  const attrs = [`${octaves}oct`];
  if (motion === 'contrary') attrs.push('contrary');
  if (interval !== 'unison') attrs.push(interval === 'third' ? '3rds' : interval === 'sixth' ? '6ths' : '10ths');
  return `${name} (${attrs.join(', ')})`;
}

// ─── Articulation ────────────────────────────────────────────────────────────
// segment.articulation is { rh, lh } (each a key of ARTICULATION_LABELS or
// null), or absent on any segment logged before this field existed.

// Clean tempo reached on a technique segment, entered by hand after
// practising (not the metronome's setting — that is often not the tempo you
// actually held). null when unset.
export function formatTempo(seg) {
  const n = Number(seg?.tempo);
  return n > 0 ? `${n} bpm` : null;
}

// 'Staccato' when both hands match, 'RH legato · LH staccato' when they
// differ, null when nothing is set.
export function formatArticulation(seg) {
  const { rh, lh } = articulationOf(seg);
  if (!rh && !lh) return null;
  if (rh === lh) return ARTICULATION_LABELS[rh];
  const part = v => (v ? ARTICULATION_LABELS[v].toLowerCase() : '—');
  return `RH ${part(rh)} · LH ${part(lh)}`;
}

// How a technique segment was played, as one label: its articulation and its dynamics, e.g.
// 'Legato · mf' or 'Staccato · p, f'. null when neither is set.
export function formatTouch(seg) {
  return [formatArticulation(seg), formatDynamics(seg)].filter(Boolean).join(' · ') || null;
}

// ─── Local UI preferences ──────────────────────────────────────────
// Small choices that should survive a relaunch: the last-selected toggle, "swipe hint
// seen", "onboarding done". They're read synchronously so any screen can use one in a
// useState initialiser:
//   web    — straight from localStorage.
//   native — there is no localStorage and AsyncStorage is async, so a copy lives in
//            memory. initPrefs() fills it once at startup (App.js waits for it before
//            showing anything); writes update the copy at once and persist in the
//            background.
const PREF_PREFIX = 'musiclog_pref_';
const nativePrefs = {};
const hasLocalStorage = () => typeof localStorage !== 'undefined';

export async function initPrefs() {
  if (hasLocalStorage()) return;
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith(PREF_PREFIX));
    if (keys.length) (await AsyncStorage.multiGet(keys)).forEach(([k, v]) => { nativePrefs[k] = v; });
  } catch {
    // prefs simply fall back to their defaults
  }
}

export function getLocalPref(key, fallback = null) {
  const k = PREF_PREFIX + key;
  const raw = hasLocalStorage() ? localStorage.getItem(k) : (k in nativePrefs ? nativePrefs[k] : null);
  return raw === null || raw === undefined ? fallback : raw;
}

const prefListeners = new Set();
// Lets a screen react when a preference changes elsewhere (e.g. Settings changes the weekly goal
// that Home is showing). See utils/usePref.js.
export function subscribePrefs(fn) {
  prefListeners.add(fn);
  return () => { prefListeners.delete(fn); };
}

export function setLocalPref(key, value) {
  const k = PREF_PREFIX + key;
  if (hasLocalStorage()) {
    localStorage.setItem(k, value);
  } else {
    nativePrefs[k] = String(value);
    AsyncStorage.setItem(k, String(value)).catch(() => {});
  }
  prefListeners.forEach(fn => fn(key));
}

// sessionToTimerPlan and latestSession live in utils/progress.js (pure, so the repo's tests
// cover them); re-exported here so existing imports keep working.
export { sessionToTimerPlan, latestSession } from './utils/progress';

// Same idea as confirmDelete, for leaving a form with unsaved changes.
export function confirmDiscard(onDiscard) {
  if (Platform.OS === 'web') {
    if (window.confirm('Discard changes?\nYou have unsaved changes that will be lost.')) onDiscard();
  } else {
    Alert.alert('Discard changes?', 'You have unsaved changes that will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onDiscard },
    ]);
  }
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
export function deriveCompositionStatus(compositionId, sessions, lessons, manualShelvedAt) {
  return deriveStatusOn(compositionId, sessions, lessons, manualShelvedAt, todayISO());
}

// Reconstructs a piece's full status history with per-stage tallies: how
// many sessions/lessons were logged in each stage, total minutes, and the
// date range — including any 'shelved' quiet gaps between logs. Contiguous
// logs of the same derived stage are merged into one row (safe because rank
// only ever increases, so each active stage forms one continuous block).
// `manualShelvedAt` mirrors the override in deriveCompositionStatus: if set
// and no log has happened since, the tail of the history is trimmed/replaced
// with a 'shelved' segment running from that date to today.
export function deriveStatusHistory(compositionId, sessions, lessons, manualShelvedAt) {
  return deriveHistoryOn(compositionId, sessions, lessons, manualShelvedAt, todayISO());
}

// Reconstructs how a piece's derived status changed over time, for the
// Timeline chart to render as colour changes along the bar rather than one
// flat colour. Returns an ordered list of { start, end, status } date-string
// ranges. Empty array means no logs exist yet (piece is still in ambition).
export function deriveStatusTimeline(compositionId, sessions, lessons, manualShelvedAt) {
  return deriveStatusHistory(compositionId, sessions, lessons, manualShelvedAt)
    .map(({ start, end, status }) => ({ start, end, status }));
}
