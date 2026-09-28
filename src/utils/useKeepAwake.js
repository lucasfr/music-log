import { useEffect } from 'react';
import { Platform } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

const TAG = 'practice-timer';

// Keeps the screen on while a practice segment is actively running.
// Native (iOS/Android): expo-keep-awake.
// Web: the browser Screen Wake Lock API, feature-detected — unsupported
// browsers just don't get this, no crash, practice still works fine.
export function useKeepAwake(active) {
  useEffect(() => {
    if (!active) return;

    if (Platform.OS !== 'web') {
      activateKeepAwakeAsync(TAG);
      return () => deactivateKeepAwake(TAG);
    }

    if (typeof navigator === 'undefined' || !navigator.wakeLock) return;
    let sentinel;
    let cancelled = false;
    navigator.wakeLock.request('screen')
      .then(s => {
        if (cancelled) { s.release().catch(() => {}); return; }
        sentinel = s;
      })
      .catch(() => {}); // e.g. tab not visible yet — non-fatal
    return () => {
      cancelled = true;
      if (sentinel) sentinel.release().catch(() => {});
    };
  }, [active]);
}
