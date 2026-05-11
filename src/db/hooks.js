import { useState, useEffect, useCallback } from 'react';
import {
  getAllSessions, saveSession, deleteSession,
  getAllCompositions, saveComposition, deleteComposition,
  getAllLessons, saveLesson, deleteLesson,
} from '../db';
import { pushRecord, deleteRecord, pullTable, mergeRows } from './sync';

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
    const remote = await pullTable('sessions');
    if (remote) {
      // Filter out anything we've locally deleted or recently saved
      const safeRemote = remote
        .filter(r => !pendingDeletes.sessions.has(r.id))
        .map(r => {
          const guarded = pendingSaves.sessions.get(r.id);
          return guarded ? guarded : r;
        });
      const merged = mergeRows(local, safeRemote)
        .filter(r => !pendingDeletes.sessions.has(r.id))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      // Write any remote-wins rows back to local db
      for (const row of merged) {
        const localRow = local.find(l => l.id === row.id);
        const localTs  = new Date(localRow?.updated_at || 0).getTime();
        const remoteTs = new Date(row.updated_at || 0).getTime();
        if (!localRow || remoteTs > localTs) await saveSession(row);
      }
      setSessions(merged);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const save = useCallback(async (session) => {
    const record = { ...session, updated_at: new Date().toISOString() };
    pendingSaves.sessions.set(record.id, record);
    await saveSession(record);
    pushRecord('sessions', record).finally(() => {
      setTimeout(() => pendingSaves.sessions.delete(record.id), SAVE_GUARD_MS);
    });
    await reload();
  }, [reload]);

  const remove = useCallback(async (id) => {
    pendingDeletes.sessions.add(id);
    await deleteSession(id);
    deleteRecord('sessions', id).finally(() => {
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

    const remote = await pullTable('compositions');
    if (remote) {
      const safeRemote = remote
        .filter(r => !pendingDeletes.compositions.has(r.id))
        .map(r => {
          const guarded = pendingSaves.compositions.get(r.id);
          return guarded ? guarded : r;
        });
      const merged = mergeRows(local, safeRemote)
        .filter(r => !pendingDeletes.compositions.has(r.id))
        .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      for (const row of merged) {
        const localRow = local.find(l => l.id === row.id);
        const localTs  = new Date(localRow?.updated_at || 0).getTime();
        const remoteTs = new Date(row.updated_at || 0).getTime();
        if (!localRow || remoteTs > localTs) await saveComposition(row);
      }
      setCompositions(merged);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const save = useCallback(async (comp) => {
    const record = { ...comp, updated_at: new Date().toISOString() };
    pendingSaves.compositions.set(record.id, record);
    await saveComposition(record);
    pushRecord('compositions', record).finally(() => {
      setTimeout(() => pendingSaves.compositions.delete(record.id), SAVE_GUARD_MS);
    });
    await reload();
  }, [reload]);

  const remove = useCallback(async (id) => {
    pendingDeletes.compositions.add(id);
    await deleteComposition(id);
    deleteRecord('compositions', id).finally(() => {
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

    const remote = await pullTable('lessons');
    if (remote) {
      const safeRemote = remote
        .filter(r => !pendingDeletes.lessons.has(r.id))
        .map(r => {
          const guarded = pendingSaves.lessons.get(r.id);
          return guarded ? guarded : r;
        });
      const merged = mergeRows(local, safeRemote)
        .filter(r => !pendingDeletes.lessons.has(r.id))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      for (const row of merged) {
        const localRow = local.find(l => l.id === row.id);
        const localTs  = new Date(localRow?.updated_at || 0).getTime();
        const remoteTs = new Date(row.updated_at || 0).getTime();
        if (!localRow || remoteTs > localTs) await saveLesson(row);
      }
      setLessons(merged);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const save = useCallback(async (lesson) => {
    const record = { ...lesson, updated_at: new Date().toISOString() };
    pendingSaves.lessons.set(record.id, record);
    await saveLesson(record);
    pushRecord('lessons', record).finally(() => {
      setTimeout(() => pendingSaves.lessons.delete(record.id), SAVE_GUARD_MS);
    });
    await reload();
  }, [reload]);

  const remove = useCallback(async (id) => {
    pendingDeletes.lessons.add(id);
    await deleteLesson(id);
    deleteRecord('lessons', id).finally(() => {
      setTimeout(() => pendingDeletes.lessons.delete(id), SAVE_GUARD_MS);
    });
    await reload();
  }, [reload]);

  return { lessons, loading, save, remove, reload };
}
