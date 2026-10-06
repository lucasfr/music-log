// Tiny pub-sub for sync state, so any screen (just Settings, for now) can
// show "is this actually working" without polling. Pushes are fire-and-
// forget by design (the UI that triggered them shouldn't block on network),
// but that previously meant a failure was only ever visible as a silent
// console.warn — no signal anywhere that a session never actually reached
// Supabase short of noticing it missing on another device later.
let status = {
  pending: 0,        // in-flight push/pull count
  lastSuccessAt: null, // ISO timestamp of the last successful push or pull
  lastError: null,     // last error message, cleared on the next success
};

const listeners = new Set();

function notify() {
  listeners.forEach(cb => cb(status));
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

export function reportSyncSuccess() {
  status = { ...status, pending: Math.max(0, status.pending - 1), lastSuccessAt: new Date().toISOString(), lastError: null };
  notify();
}

export function reportSyncError(message) {
  status = { ...status, pending: Math.max(0, status.pending - 1), lastError: message };
  notify();
}
