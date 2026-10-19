// Which sync errors are worth putting in front of you. Pure (no React Native imports), so it's
// unit-tested in plain Node, see tests/syncIssue.test.mjs.
//
// Sync errors used to be visible only under Settings → Sync, which is how a piece with a tempo went
// unsynced for weeks. They now raise a dot on the Settings tab and a banner on Home, but not for
// being offline: this app is meant to be used with no signal (at the piano), and a banner that
// appears every time you lose Wi-Fi would just be noise that gets ignored.

const TABLES = { compositions: 'Pieces', sessions: 'Practice sessions', lessons: 'Lessons' };

// Errors that mean "no connection right now", which fix themselves.
const OFFLINE = /network|fetch|offline|internet|connection|timed? ?out|load failed|econn|enotfound|aborted/i;

export function isConnectivityError(message) {
  return OFFLINE.test(String(message || ''));
}

// errors: the `errors` map from syncStatus, scope -> message ('push:compositions', 'pull:sessions'...).
// Returns the first problem that needs attention as { scope, title, message }, or null.
export function syncIssue(errors) {
  for (const [scope, message] of Object.entries(errors || {})) {
    if (!message || isConnectivityError(message)) continue;
    const [direction, table] = scope.includes(':') ? scope.split(':') : ['', ''];
    const name = TABLES[table] || table || 'Your data';
    const title = direction === 'push' ? `${name} didn't save to Supabase`
      : direction === 'pull' ? `${name} couldn't be loaded from Supabase`
      : 'Sync problem';
    return { scope, title, message: String(message) };
  }
  return null;
}

// Whether two results are the same problem, so a listener can skip a redundant re-render.
export function sameIssue(a, b) {
  if (!a || !b) return !a && !b;
  return a.scope === b.scope && a.message === b.message;
}
