// Refreshes the data when you come back to the app, and when the network returns, so an edit made
// offline reaches the other devices without waiting for the next save or a restart.
//
//  - web: when the tab becomes visible again, and on the browser's `online` event (which forces a
//    refresh, since the network has only just come back);
//  - phone: when the app returns to the foreground. There is no network-status library in the
//    project, so while edits are waiting to sync it also tries again every minute.
// The decisions about when are in utils/refreshGate.js (tested); this file only listens for events.

import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { createRefreshGate } from './refreshGate';

// `refresh` is an async function that reloads the data. `hasPending` says whether any edit is still
// waiting to sync (read when the timer fires, so it is always current).
export function useForegroundRefresh(refresh, { hasPending = () => false, retryEveryMs = 60000 } = {}) {
  const refreshRef = useRef(refresh);
  const pendingRef = useRef(hasPending);
  refreshRef.current = refresh;
  pendingRef.current = hasPending;

  useEffect(() => {
    const gate = createRefreshGate();
    async function run(force) {
      if (!gate.tryStart(force)) return;
      try { await refreshRef.current(); } catch { /* the next event tries again */ } finally { gate.finish(); }
    }

    const stops = [];
    if (Platform.OS === 'web') {
      const onVisible = () => { if (document.visibilityState === 'visible') run(false); };
      const onOnline = () => run(true);
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('online', onOnline);
      stops.push(() => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', onOnline); });
    } else {
      const sub = AppState.addEventListener('change', state => { if (state === 'active') run(false); });
      stops.push(() => sub.remove());
    }
    const timer = setInterval(() => { if (pendingRef.current()) run(true); }, retryEveryMs);
    stops.push(() => clearInterval(timer));
    return () => stops.forEach(stop => stop());
  }, [retryEveryMs]);
}
