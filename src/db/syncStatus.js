// Tiny pub-sub for sync state, so any screen (just Settings, for now) can
// show "is this actually working" without polling. Pushes are fire-and-
// forget by design (the UI that triggered them shouldn't block on network),
// but that previously meant a failure was only ever visible as a silent
// console.warn — no signal anywhere that a session never actually reached
// Supabase short of noticing it missing on another device later.
//
// Errors are kept per scope ('push:compositions', 'pull:sessions', …), and a success only
// clears its own scope. Before, one global error was cleared by *any* success, and every
// reload pulls three tables, so a failed push was wiped out again within moments and
// never reached the screen.
let status = {
  pending: 0,          // in-flight push/pull count
  lastSuccessAt: null, // ISO timestamp of the last successful push or pull
  lastError: null,     // the first outstanding error message, or null
  errors: {},          // outstanding errors by scope
};

const listeners = new Set();

function notify() {
  listeners.forEach(cb => cb(status));
}

function withErrors(errors, extra) {
  return { ...status, ...extra, errors, lastError: Object.values(errors)[0] ?? null };
}

export function getSyncStatus() {
  return status;
}

export function subscribeSyncStatus(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function reportSyncStart() {
  status = { ...status, pending: status.pending + 1 };
  notify();
}

// scope: which push or pull succeeded. Without one, every outstanding error is cleared.
export function reportSyncSuccess(scope) {
  const errors = { ...status.errors };
  if (scope) delete errors[scope]; else Object.keys(errors).forEach(k => delete errors[k]);
  status = withErrors(errors, { pending: Math.max(0, status.pending - 1), lastSuccessAt: new Date().toISOString() });
  notify();
}

export function reportSyncError(message, scope = 'sync') {
  status = withErrors({ ...status.errors, [scope]: message }, { pending: Math.max(0, status.pending - 1) });
  notify();
}
