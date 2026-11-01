import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getAllSessions, saveSession, deleteSession,
  getAllCompositions, saveComposition, deleteComposition,
  getAllLessons, saveLesson, deleteLesson, clearAllLocal,
} from '../db';
import { pullTable, mergeRows } from './sync';
import { fromRemoteComposition } from './records';
import { outbox } from './outbox';
import { notify } from '../utils/notify';
import { isTombstone } from '../utils/syncQueue';
import { singleFlight } from '../utils/singleFlight';
import { clearAllData } from '../utils/clearData';

// A failed write to local storage used to vanish: the form has already closed by then, so the entry
// was lost without a word. Say so (the caller still sees the error, as before).
async function guardLocalWrite(write, what) {
  try {
    await write();
  } catch (e) {
    notify(`Couldn't save your ${what}`, 'It was not stored on this device. Please enter it again.');
    throw e;
  }
}

// ─── Local intent guards ───────────────────────────────────────────────────────
// These sets/maps prevent remote stale data from overwriting local edits or
// resurrecting locally-deleted records during the async push/pull window.

const pendingDeletes = {
  sessions:     new Set(),
  compositions: new Set(),
  lessons:      new Set(),
};

const pendingSaves = {
  sessions:     new Map(), // id → record
  compositions: new Map(),
  lessons:      new Map(),
};

// After a save lands in Supabase we can stop guarding it, but we leave a
// small grace period (5 s) so the immediately-following reload can't stomp it.
const SAVE_GUARD_MS = 5000;

// ─── Clear everything ──────────────────────────────────────────────────────────

// Deletes every session, lesson and piece, here and (when signed in) on Supabase and so on every other
// device. `local` is what's on this device now: { sessions, lessons, compositions }. The records are
// removed through the outbox as tombstones, because emptying the local database alone would be undone
// by the next pull (see utils/clearData.js). Settings that aren't records (theme, goals, sign-in) are
// left alone. Afterwards call each hook's reload() so the screens empty; there is no undo.
// -> { counts, total, sent, owed, unchecked } (see clearAllData)
export function clearAllRecords(local) {
  return clearAllData({
    local,
    pullRemote: async table => {
      const rows = await pullTable(table);
      return rows ? rows.filter(r => !isTombstone(r)) : null;
    },
    wipeLocal: clearAllLocal,
    trackDelete: (table, id) => outbox.trackDelete(table, id),
    guard: (table, ids) => {
      ids.forEach(id => pendingDeletes[table].add(id));
      return () => setTimeout(() => ids.forEach(id => pendingDeletes[table].delete(id)), SAVE_GUARD_MS);
    },
    dropConflicts: () => outbox.conflicts().forEach(c => outbox.resolveConflict(c.table, c.id, c.record.updated_at)),
  });
}

// ─── Sessions, lessons and pieces ─────────────────────────────────────────────
//
// The three hooks differ only in which table they use, how their list is sorted and a couple of
// names, so one hook (useRecords) does the work for all of them. They used to be three copies, and a
// fix to one had to be remembered in the other two.
//
// How a reload, a save and a delete behave:
//  - A reload reads this device first (so the screen is never empty while the network answers), then
//    pulls from Supabase and merges. Only one reload runs at a time per table; asking for another while
//    one is running makes it run once more when it finishes, instead of starting a second one beside it.
//    Two overlapping reloads used to be able to finish out of order, so an older one could put an older
//    list on the screen.
//  - A save writes to this device, shows the change at once, and sends it to Supabase in the
//    background: save() resolves when the record is stored locally, not when the network has answered,
//    so a form never waits on a slow connection. (It used to await a whole reload, pull included.)
//  - A delete works the same way.

const bySessionDate = (a, b) => (b.date || '').localeCompare(a.date || '');

const RECORDS = {
  sessions: {
    label: 'practice session',
    getAll: getAllSessions, saveLocal: saveSession, deleteLocal: deleteSession,
    sort: bySessionDate,
  },
  compositions: {
    label: 'piece',
    getAll: getAllCompositions, saveLocal: saveComposition, deleteLocal: deleteComposition,
    sort: (a, b) => (a.title || '').localeCompare(b.title || ''),
    // Supabase rows are snake_case (time_sigs); reshape them like local ones so the metronome
    // can read a piece's tempo and time signature on a device that only has it from sync.
    fromRemote: fromRemoteComposition,
  },
  lessons: {
    label: 'lesson',
    getAll: getAllLessons, saveLocal: saveLesson, deleteLocal: deleteLesson,
    sort: bySessionDate,
  },
};

function useRecords(table) {
  const cfg = RECORDS[table];
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // `isStale()` is true once another reload has been asked for since this one began (a save, say): what
  // this run has read may already be out of date, so it leaves showing it to the next run.
  const reloadOnce = useCallback(async isStale => {
    // Load local first for instant render
    const local = await cfg.getAll();
    if (!isStale()) setItems(local.filter(r => !pendingDeletes[table].has(r.id)));
    setLoading(false);

    // Then pull remote and merge
    const pulled = await pullTable(table, local);
    const remote = pulled ? (cfg.fromRemote ? pulled.map(cfg.fromRemote) : pulled) : null;
    if (!remote) return;

    // Retry edits that never reached the server, and keep a copy of whichever side loses when
    // two devices edited the same record (see utils/syncQueue.js).
    outbox.processPull(table, local, remote);
    // Deletions (see planDeletes in utils/syncQueue.js): a record another device deleted is removed
    // here too, and one this device deleted stays gone while the server still has the row.
    const plan = outbox.processDeletes(table, local, remote);
    for (const id of plan.deleteLocal) await cfg.deleteLocal(id);
    const kept = plan.deleteLocal.length ? local.filter(r => !plan.deleteLocal.includes(r.id)) : local;
    // Filter out anything we've locally deleted or recently saved
    const safeRemote = remote
      .filter(r => !plan.skip.has(r.id) && !pendingDeletes[table].has(r.id))
      .map(r => {
        const guarded = pendingSaves[table].get(r.id);
        return guarded ? guarded : r;
      });
    const merged = mergeRows(kept, safeRemote)
      .filter(r => !pendingDeletes[table].has(r.id))
      .sort(cfg.sort);
    // Write any remote-wins rows back to local db
    const keptById = new Map(kept.map(l => [l.id, l]));
    for (const row of merged) {
      const localRow = keptById.get(row.id);
      if (!localRow || row !== localRow) await cfg.saveLocal(row);
    }
    if (!isStale()) setItems(merged);
  }, [table, cfg]);

  // One reload at a time (see utils/singleFlight.js); asking again while one runs makes it go round once more.
  const reload = useMemo(() => singleFlight(reloadOnce), [reloadOnce]);

  useEffect(() => { reload(); }, [reload]);

  // A reload the caller is not waiting for: its failure is logged, not thrown into a form.
  const reloadInBackground = useCallback(() => {
    reload().catch(e => console.warn(`[sync] reload ${table} failed:`, e && e.message));
  }, [reload, table]);

  const save = useCallback(async (item) => {
    const record = { ...item, updated_at: new Date().toISOString() };
    pendingSaves[table].set(record.id, record);
    await guardLocalWrite(() => cfg.saveLocal(record), cfg.label);
    setItems(prev => [...prev.filter(r => r.id !== record.id), record].sort(cfg.sort));
    outbox.trackEdit(table, record, item.updated_at); // the version this edit started from
    outbox.pushTracked(table, record).finally(() => {
      setTimeout(() => pendingSaves[table].delete(record.id), SAVE_GUARD_MS);
    });
    reloadInBackground();
  }, [table, cfg, reloadInBackground]);

  const remove = useCallback(async (id) => {
    pendingDeletes[table].add(id);
    await cfg.deleteLocal(id);
    setItems(prev => prev.filter(r => r.id !== id));
    outbox.trackDelete(table, id).finally(() => {
      // Keep the guard for a while to survive any in-flight pulls
      setTimeout(() => pendingDeletes[table].delete(id), SAVE_GUARD_MS);
    });
    reloadInBackground();
  }, [table, cfg, reloadInBackground]);

  return { items, loading, save, remove, reload };
}

export function useSessions() {
  const { items, ...rest } = useRecords('sessions');
  return { sessions: items, ...rest };
}

export function useCompositions() {
  const { items, ...rest } = useRecords('compositions');
  return { compositions: items, ...rest };
}

export function useLessons() {
  const { items, ...rest } = useRecords('lessons');
  return { lessons: items, ...rest };
}
