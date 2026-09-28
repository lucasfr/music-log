import { useState, useRef, useEffect, useCallback, useReducer } from 'react';
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
  const [tick, forceTick] = useReducer(x => x + 1, 0);

  // Re-render on an interval while running, purely to refresh the displayed
  // countdown — the actual time math never depends on how many ticks fired.
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(forceTick, TICK_MS);
    return () => clearInterval(id);
  }, [isRunning]);

  // Force an immediate recompute on foreground instead of waiting up to
  // TICK_MS for the next interval — avoids a stale-looking countdown for a
  // beat right after unlocking the phone.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') forceTick();
    });
    return () => sub.remove();
  }, []);

  const plannedMsFor = idx => (segments[idx]?.plannedMinutes || 0) * 60000;

  const currentElapsedMs = useCallback(() => {
    const base = elapsedMs[currentIndex] || 0;
    if (isRunning && runStartRef.current) return base + (Date.now() - runStartRef.current);
    return base;
  }, [elapsedMs, currentIndex, isRunning]);

  const currentRemainingMs = () => Math.max(0, plannedMsFor(currentIndex) - currentElapsedMs());

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

  // Auto-advance the moment a segment's planned time runs out.
  useEffect(() => {
    if (isRunning && currentRemainingMs() <= 0) {
      goTo(currentIndex + 1);
    }
    // Deliberately keyed on `tick`, not on the values read inside — this
    // effect exists purely to react to time passing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

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
