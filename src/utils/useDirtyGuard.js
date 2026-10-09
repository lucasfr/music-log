import { useState, useRef, useEffect } from 'react';

// Tells a form whether it has unsaved changes.
//
//   const guard = useDirtyGuard(JSON.stringify({ ...everything the form edits }));
//   ...in the effect that (re)loads the form's initial values, as its last step:
//   guard.markReset();
//   ...when the user cancels:
//   if (guard.isDirty()) confirmDiscard(onClose); else onClose();
//
// markReset() bumps a state counter, so the baseline is captured in an effect
// that runs after the render containing the freshly loaded values. That makes
// the baseline deterministic, with no timers or guessing about render order.
export function useDirtyGuard(snapshot) {
  const [tick, setTick] = useState(0);
  const latest = useRef(snapshot);
  latest.current = snapshot;
  const base = useRef(null);

  useEffect(() => { base.current = latest.current; }, [tick]);

  return {
    markReset: () => setTick(t => t + 1),
    isDirty: () => base.current !== null && base.current !== latest.current,
  };
}
