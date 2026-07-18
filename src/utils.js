import { Alert, Platform } from 'react-native';

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
// A scale entry in segment.scales can be either:
//   - a plain string (legacy, e.g. 'C major') — always implicitly parallel motion
//   - an object { scale, motion } where motion is 'parallel' (default) | 'contrary'
// These helpers normalise access so old and new data read the same way.

export function scaleName(entry) {
  return typeof entry === 'string' ? entry : entry.scale;
}

export function scaleMotion(entry) {
  return typeof entry === 'string' ? 'parallel' : (entry.motion || 'parallel');
}

export function formatScaleEntry(entry) {
  const name = scaleName(entry);
  return scaleMotion(entry) === 'contrary' ? `${name} (contrary)` : name;
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
