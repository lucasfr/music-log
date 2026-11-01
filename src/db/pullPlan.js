// Pulling only what changed. Pure (the Supabase client is passed in, nothing from React Native is
// imported), so it's unit-tested in plain Node, see tests/pullPlan.test.mjs.
//
// A pull used to download every row of a table, segments and all, each time a screen reloaded. Now
// it first asks for a light index (id, updated_at and the deletion mark, no segments), compares it
// with what this device already has, and downloads in full only the rows that differ.
//
// Why not "everything updated since the last pull"? An edit made offline keeps the updated_at it
// had when it was made, so it can reach the server long after another device's last pull, with a
// timestamp older than that pull. A "since" cursor would miss it for good. Comparing the whole index
// has no such gap, and it also tells us which rows exist, which is what delete handling needs
// (see planDeletes in utils/syncQueue.js).
//
// What the callers get back is the same shape as a full pull: a row per record on the server.
// Rows this device already has at the same version come back as a stub ({ id, updated_at }), which
// every consumer (the outbox, delete handling and the merge) treats as "nothing new here"; a
// deletion comes back as { id, updated_at, deletedAt } without its row being downloaded.

const time = v => {
  const t = new Date(v || 0).getTime();
  return Number.isFinite(t) ? t : 0;
};

// A full pull still happens now and then, because a stub can't carry fields that only just started
// syncing (the merge fills those in at the same timestamp), and as a safety net for anything the
// index can't show.
export const FULL_PULL_EVERY_MS = 24 * 60 * 60 * 1000;

// Is a full pull due? `lastFullAt` is an ISO time or nothing. A clock that went backwards counts as due.
export function isFullPullDue(lastFullAt, nowMs = Date.now(), maxAgeMs = FULL_PULL_EVERY_MS) {
  const last = time(lastFullAt);
  if (!last) return true;
  const age = nowMs - last;
  return age < 0 || age >= maxAgeMs;
}

// The columns of the light index. `deleted_at` is the `deletedAt` mark inside the `data` column.
export const INDEX_COLUMNS = 'id, updated_at, deleted_at:data->>deletedAt';

// Sorts the server's index against the local rows.
//  index: [{ id, updated_at, deleted_at }]   local: the local records
// -> { rows: [what needs no download], fetch: [ids to download in full] }
export function planPull(index, local) {
  const mineById = new Map((local || []).map(r => [r.id, r]));
  const rows = [];
  const fetch = [];
  for (const entry of index || []) {
    if (!entry || !entry.id) continue;
    if (entry.deleted_at) {
      rows.push({ id: entry.id, updated_at: entry.updated_at, deletedAt: entry.deleted_at });
      continue;
    }
    const mine = mineById.get(entry.id);
    if (mine && time(mine.updated_at) === time(entry.updated_at)) rows.push({ id: entry.id, updated_at: mine.updated_at });
    else fetch.push(entry.id);
  }
  return { rows, fetch };
}

// Runs the two steps against a Supabase client.
// -> { rows, fetched } on success (`fetched` are the downloaded rows exactly as the server sent them),
//    or { error } when any request failed, so the caller can fall back to a full pull.
export async function pullChanged(client, table, uid, local, { pageSize = 1000, chunk = 100 } = {}) {
  const index = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from(table)
      .select(INDEX_COLUMNS)
      .eq('user_id', uid)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) return { error };
    if (!data || data.length === 0) break;
    index.push(...data);
    if (data.length < pageSize) break;
  }

  const { rows, fetch } = planPull(index, local);
  const fetched = [];
  for (let i = 0; i < fetch.length; i += chunk) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .eq('user_id', uid)
      .in('id', fetch.slice(i, i + chunk));
    if (error) return { error };
    if (data) fetched.push(...data);
  }
  return { rows, fetched };
}
