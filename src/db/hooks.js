import { useState, useEffect, useCallback } from 'react';
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

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function useSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    // Load local first for instant render
    const local = await getAllSessions();
    setSessions(local.filter(r => !pendingDeletes.sessions.has(r.id)));
    setLoading(false);

    // Then pull remote and merge
    const remote = await pullTable('sessions', local);
    if (remote) {
      // Retry edits that never reached the server, and keep a copy of whichever side loses when
      // two devices edited the same record (see utils/syncQueue.js).
      outbox.processPull('sessions', local, remote);
      // Deletions (see planDeletes in utils/syncQueue.js): a record another device deleted is removed
      // here too, and one this device deleted stays gone while the server still has the row.
      const plan = outbox.processDeletes('sessions', local, remote);
      for (const id of plan.deleteLocal) await deleteSession(id);
      const kept = plan.deleteLocal.length ? local.filter(r => !plan.deleteLocal.includes(r.id)) : local;
      // Filter out anything we've locally deleted or recently saved
      const safeRemote = remote
        .filter(r => !plan.skip.has(r.id) && !pendingDeletes.sessions.has(r.id))
        .map(r => {
          const guarded = pendingSaves.sessions.get(r.id);
          return guarded ? guarded : r;
        });
      const merged = mergeRows(kept, safeRemote)
        .filter(r => !pendingDeletes.sessions.has(r.id))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      // Write any remote-wins rows back to local db
      for (const row of merged) {
        const localRow = kept.find(l => l.id === row.id);
        if (!localRow || row !== localRow) await saveSession(row);
      }
      setSessions(merged);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const save = useCallback(async (session) => {
    const record = { ...session, updated_at: new Date().toISOString() };
    pendingSaves.sessions.set(record.id, record);
    await guardLocalWrite(() => saveSession(record), 'practice session');
    outbox.trackEdit('sessions', record, session.updated_at); // the version this edit started from
    outbox.pushTracked('sessions', record).finally(() => {
      setTimeout(() => pendingSaves.sessions.delete(record.id), SAVE_GUARD_MS);
    });
    await reload();
  }, [reload]);

  const remove = useCallback(async (id) => {
    pendingDeletes.sessions.add(id);
    await deleteSession(id);
    outbox.trackDelete('sessions', id).finally(() => {
      // Keep the guard for a while to survive any in-flight pulls
      setTimeout(() => pendingDeletes.sessions.delete(id), SAVE_GUARD_MS);
    });
    await reload();
  }, [reload]);

  return { sessions, loading, save, remove, reload };
}

// ─── Compositions ─────────────────────────────────────────────────────────────

export function useCompositions() {
  const [compositions, setCompositions] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const local = await getAllCompositions();
    setCompositions(local.filter(r => !pendingDeletes.compositions.has(r.id)));
    setLoading(false);

    // Supabase rows are snake_case (time_sigs); reshape them like local ones so the metronome
    // can read a piece's tempo and time signature on a device that only has it from sync.
    const pulled = await pullTable('compositions', local);
    const remote = pulled ? pulled.map(fromRemoteComposition) : null;
    if (remote) {
      outbox.processPull('compositions', local, remote);
      // Deletions (see planDeletes in utils/syncQueue.js): a record another device deleted is removed
      // here too, and one this device deleted stays gone while the server still has the row.
      const plan = outbox.processDeletes('compositions', local, remote);
      for (const id of plan.deleteLocal) await deleteComposition(id);
      const kept = plan.deleteLocal.length ? local.filter(r => !plan.deleteLocal.includes(r.id)) : local;
      // Filter out anything we've locally deleted or recently saved
      const safeRemote = remote
        .filter(r => !plan.skip.has(r.id) && !pendingDeletes.compositions.has(r.id))
        .map(r => {
          const guarded = pendingSaves.compositions.get(r.id);
          return guarded ? guarded : r;
        });
      const merged = mergeRows(kept, safeRemote)
        .filter(r => !pendingDeletes.compositions.has(r.id))
        .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      for (const row of merged) {
        const localRow = kept.find(l => l.id === row.id);
        if (!localRow || row !== localRow) await saveComposition(row);
      }
      setCompositions(merged);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const save = useCallback(async (comp) => {
    const record = { ...comp, updated_at: new Date().toISOString() };
    pendingSaves.compositions.set(record.id, record);
    await guardLocalWrite(() => saveComposition(record), 'piece');
    outbox.trackEdit('compositions', record, comp.updated_at);
    outbox.pushTracked('compositions', record).finally(() => {
      setTimeout(() => pendingSaves.compositions.delete(record.id), SAVE_GUARD_MS);
    });
    await reload();
  }, [reload]);

  const remove = useCallback(async (id) => {
    pendingDeletes.compositions.add(id);
    await deleteComposition(id);
    outbox.trackDelete('compositions', id).finally(() => {
      setTimeout(() => pendingDeletes.compositions.delete(id), SAVE_GUARD_MS);
    });
    await reload();
  }, [reload]);

  return { compositions, loading, save, remove, reload };
}

// ─── Lessons ──────────────────────────────────────────────────────────────────

export function useLessons() {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const local = await getAllLessons();
    setLessons(local.filter(r => !pendingDeletes.lessons.has(r.id)));
    setLoading(false);

    const remote = await pullTable('lessons', local);
    if (remote) {
      outbox.processPull('lessons', local, remote);
      // Deletions (see planDeletes in utils/syncQueue.js): a record another device deleted is removed
      // here too, and one this device deleted stays gone while the server still has the row.
      const plan = outbox.processDeletes('lessons', local, remote);
      for (const id of plan.deleteLocal) await deleteLesson(id);
      const kept = plan.deleteLocal.length ? local.filter(r => !plan.deleteLocal.includes(r.id)) : local;
      // Filter out anything we've locally deleted or recently saved
      const safeRemote = remote
        .filter(r => !plan.skip.has(r.id) && !pendingDeletes.lessons.has(r.id))
        .map(r => {
          const guarded = pendingSaves.lessons.get(r.id);
          return guarded ? guarded : r;
        });
      const merged = mergeRows(kept, safeRemote)
        .filter(r => !pendingDeletes.lessons.has(r.id))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      for (const row of merged) {
        const localRow = kept.find(l => l.id === row.id);
        if (!localRow || row !== localRow) await saveLesson(row);
      }
      setLessons(merged);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const save = useCallback(async (lesson) => {
    const record = { ...lesson, updated_at: new Date().toISOString() };
    pendingSaves.lessons.set(record.id, record);
    await guardLocalWrite(() => saveLesson(record), 'lesson');
    outbox.trackEdit('lessons', record, lesson.updated_at);
    outbox.pushTracked('lessons', record).finally(() => {
      setTimeout(() => pendingSaves.lessons.delete(record.id), SAVE_GUARD_MS);
    });
    await reload();
  }, [reload]);

  const remove = useCallback(async (id) => {
    pendingDeletes.lessons.add(id);
    await deleteLesson(id);
    outbox.trackDelete('lessons', id).finally(() => {
      setTimeout(() => pendingDeletes.lessons.delete(id), SAVE_GUARD_MS);
    });
    await reload();
  }, [reload]);

  return { lessons, loading, save, remove, reload };
}
