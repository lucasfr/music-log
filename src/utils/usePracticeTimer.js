import { useState, useRef, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';

const TICK_MS = 250;

// Drives a pomodoro-style practice session: a list of segments, each with
// its own planned duration, timed one at a time.
//
// Elapsed time is always computed from real timestamps (Date.now()) rather
// than decremented on each tick, so backgrounding the app or losing focus
// never desyncs the clock — when the tab/app comes back to the foreground,
// the very next tick recomputes correctly from how much wall-clock time
// actually passed.
//
// The internal 250ms interval deliberately never dispatches any React
// state update itself. It used to (via a useReducer "forceTick"), which
// forced this hook's *caller* to fully re-render every 250ms just to
// refresh the countdown display — a real, measurable cost (BlurView,
// SVG ring, surrounding layout) that competed for the same JS thread as
// anything else on a tight schedule elsewhere in the same screen (e.g. a
// metronome's own setTimeout scheduling), on a cadence that doesn't evenly
// divide most tempos, producing intermittent-feeling interference. Now the
// interval only does two things, neither of which touches React state
// unless something actually needs to change:
//   1. notifies subscribeTick() listeners directly, so a display component
//      (the countdown ring) can refresh on its own, in isolation
//   2. checks via refs whether the current segment's time has run out, and
//      only then calls goTo() — a real, infrequent state change
//
// segments: [{ id, title, type, compositionId, plannedMinutes }]
export function usePracticeTimer(initialSegments = []) {
  const [segments, setSegments] = useState(initialSegments);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Accumulated elapsed ms per segment, only updated when a segment is
  // paused/left — while running, current elapsed is derived live instead.
  const [elapsedMs, setElapsedMs] = useState(() => initialSegments.map(() => 0));
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const runStartRef = useRef(null);

  const plannedMsFor = idx => (segments[idx]?.plannedMinutes || 0) * 60000;

  const currentElapsedMs = useCallback(() => {
    const base = elapsedMs[currentIndex] || 0;
    if (isRunning && runStartRef.current) return base + (Date.now() - runStartRef.current);
    return base;
  }, [elapsedMs, currentIndex, isRunning]);

  const currentRemainingMs = useCallback(
    () => Math.max(0, plannedMsFor(currentIndex) - currentElapsedMs()),
    [currentIndex, currentElapsedMs, segments]
  );

  // Folds whatever time has run in the current segment into elapsedMs and
  // stops the live clock — called before pausing, skipping, or finishing.
  const freezeCurrent = useCallback(() => {
    if (isRunning && runStartRef.current) {
      const now = Date.now();
      const delta = now - runStartRef.current;
      setElapsedMs(prev => prev.map((v, i) => (i === currentIndex ? v + delta : v)));
      runStartRef.current = null;
    }
  }, [isRunning, currentIndex]);

  const start = useCallback(() => {
    if (isRunning || segments.length === 0) return;
    runStartRef.current = Date.now();
    setIsRunning(true);
  }, [isRunning, segments.length]);

  const pause = useCallback(() => {
    freezeCurrent();
    setIsRunning(false);
  }, [freezeCurrent]);

  const goTo = useCallback((idx) => {
    freezeCurrent();
    if (idx >= segments.length) {
      setIsFinished(true);
      setIsRunning(false);
      return;
    }
    if (idx < 0) return;
    setCurrentIndex(idx);
    runStartRef.current = Date.now();
    setIsRunning(true);
  }, [freezeCurrent, segments.length]);

  const skip = useCallback(() => goTo(currentIndex + 1), [goTo, currentIndex]);

  // Ends the session right now, wherever it is — freezes whatever time has
  // accumulated on the current segment and marks the session finished, same
  // as running out the last segment naturally. This is the only "stop"
  // affordance the timer screen needs: the caller's onFinish handler opens
  // LogModal with the real elapsed time, and LogModal's own Cancel button
  // covers genuinely discarding it.
  const finishNow = useCallback(() => {
    freezeCurrent();
    setIsFinished(true);
    setIsRunning(false);
  }, [freezeCurrent]);

  const addMinutes = useCallback((mins) => {
    setSegments(prev => prev.map((s, i) => (i === currentIndex ? { ...s, plannedMinutes: (s.plannedMinutes || 0) + mins } : s)));
  }, [currentIndex]);

  // Lets a display component (the countdown ring) opt into frequent
  // refreshes without forcing this hook's caller to re-render — the
  // interval below calls every registered listener directly, and the
  // listener itself decides what to do with that (typically: read
  // getRemainingMs() and setState locally, isolated to that component).
  const listenersRef = useRef(new Set());
  const subscribeTick = useCallback((cb) => {
    listenersRef.current.add(cb);
    return () => listenersRef.current.delete(cb);
  }, []);

  // Always-fresh mirror of whatever the interval below needs to check for
  // auto-advance, updated via plain assignment every render rather than an
  // effect — this interval is only re-created when isRunning toggles, so
  // without this it would read stale currentIndex/goTo closures from
  // whenever isRunning last changed, not the current segment.
  const latestRef = useRef();
  latestRef.current = { currentIndex, isRunning, currentRemainingMs, goTo };

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      listenersRef.current.forEach(cb => cb());
      const { isRunning: stillRunning, currentIndex: idx, currentRemainingMs: getRemaining, goTo: go } = latestRef.current;
      if (stillRunning && getRemaining() <= 0) go(idx + 1);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [isRunning]);

  // Notify listeners immediately on foreground instead of waiting up to
  // TICK_MS for the next interval — avoids a stale-looking countdown for a
  // beat right after unlocking the phone.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') listenersRef.current.forEach(cb => cb());
    });
    return () => sub.remove();
  }, []);

  function actualMinutesFor(idx) {
    const ms = idx === currentIndex ? currentElapsedMs() : (elapsedMs[idx] || 0);
    return Math.round(ms / 60000);
  }

  return {
    segments,
    currentIndex,
    currentSegment: segments[currentIndex] || null,
    nextSegment: segments[currentIndex + 1] || null,
    isRunning,
    isFinished,
    remainingMs: currentRemainingMs(),
    plannedMs: plannedMsFor(currentIndex),
    getRemainingMs: currentRemainingMs,
    subscribeTick,
    start,
    pause,
    skip,
    finishNow,
    addMinutes,
    goTo,
    actualMinutesFor,
    totalActualMinutes: () => segments.reduce((sum, _, i) => sum + actualMinutesFor(i), 0),
  };
}
