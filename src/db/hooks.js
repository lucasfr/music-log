import { useState, useEffect, useCallback } from 'react';
import {
  getAllSessions, saveSession, deleteSession,
  getAllCompositions, saveComposition, deleteComposition,
  getAllLessons, saveLesson, deleteLesson,
} from '../db';

export function useSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const data = await getAllSessions();
    setSessions(data);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const save = useCallback(async (session) => {
    await saveSession(session);
    await reload();
  }, [reload]);

  const remove = useCallback(async (id) => {
    await deleteSession(id);
    await reload();
  }, [reload]);

  return { sessions, loading, save, remove, reload };
}

export function useCompositions() {
  const [compositions, setCompositions] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const data = await getAllCompositions();
    setCompositions(data);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const save = useCallback(async (comp) => {
    await saveComposition(comp);
    await reload();
  }, [reload]);

  const remove = useCallback(async (id) => {
    await deleteComposition(id);
    await reload();
  }, [reload]);

  return { compositions, loading, save, remove, reload };
}

export function useLessons() {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const data = await getAllLessons();
    setLessons(data);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const save = useCallback(async (lesson) => {
    await saveLesson(lesson);
    await reload();
  }, [reload]);

  const remove = useCallback(async (id) => {
    await deleteLesson(id);
    await reload();
  }, [reload]);

  return { lessons, loading, save, remove, reload };
}
