import { useState, useEffect, useCallback } from 'react';
import {
  getAllSessions, saveSession, deleteSession,
  getAllCompositions, saveComposition, deleteComposition,
  getAllLessons, saveLesson, deleteLesson,
} from '../db';
import { pushRecord, deleteRecord, pullTable, mergeRows } from './sync';

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function useSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    // Load local first for instant render
    const local = await getAllSessions();
    setSessions(local);
    setLoading(false);

    // Then pull remote and merge
    const remote = await pullTable('sessions');
    if (remote) {
      const merged = mergeRows(local, remote).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
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
    await saveSession(record);
    pushRecord('sessions', record); // fire-and-forget
    await reload();
  }, [reload]);

  const remove = useCallback(async (id) => {
    await deleteSession(id);
    deleteRecord('sessions', id); // fire-and-forget
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
    setCompositions(local);
    setLoading(false);

    const remote = await pullTable('compositions');
    if (remote) {
      const merged = mergeRows(local, remote).sort((a, b) => (a.title || '').localeCompare(b.title || ''));
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
    await saveComposition(record);
    pushRecord('compositions', record);
    await reload();
  }, [reload]);

  const remove = useCallback(async (id) => {
    await deleteComposition(id);
    deleteRecord('compositions', id);
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
    setLessons(local);
    setLoading(false);

    const remote = await pullTable('lessons');
    if (remote) {
      const merged = mergeRows(local, remote).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
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
    await saveLesson(record);
    pushRecord('lessons', record);
    await reload();
  }, [reload]);

  const remove = useCallback(async (id) => {
    await deleteLesson(id);
    deleteRecord('lessons', id);
    await reload();
  }, [reload]);

  return { lessons, loading, save, remove, reload };
}
