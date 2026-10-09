// Undo support.
//
//   useUndoToast()        -> { show(message, onUndo), toast }
//       For changes that have already been applied locally (e.g. a segment
//       removed from a form): Undo simply puts the item back.
//
//   useUndoableDelete()   -> { isPending(id), schedule(id, label, commit), toast }
//       For deletes that hit real data (sessions, lessons, library pieces): the
//       row is hidden straight away but the actual delete only runs after the
//       undo window closes. Undo cancels it, so nothing needs "restoring". A
//       delete still pending when the screen unmounts is committed, so it can
//       never be silently dropped.
//
// Render `toast` somewhere inside the screen; it positions itself absolutely.

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, Animated, TouchableOpacity, AppState } from 'react-native';
import { COLOURS, RADIUS, HIT_TEXT } from '../theme';

export function UndoToast({ message, onUndo, bottom = 24 }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 180, useNativeDriver: false }).start();
  }, [a]);
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute', left: 16, right: 16, bottom, zIndex: 60, alignItems: 'center',
        opacity: a,
        transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 16,
        minHeight: 48, paddingLeft: 18, paddingRight: 8,
        borderRadius: RADIUS.pill, backgroundColor: COLOURS.ink,
        shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 12,
      }}>
        <Text style={{ fontFamily: 'Lato', fontSize: 14, color: '#fff', flexShrink: 1 }} numberOfLines={1} maxFontSizeMultiplier={1.3}>{message}</Text>
        <TouchableOpacity
          onPress={onUndo}
          hitSlop={HIT_TEXT}
          accessibilityRole="button"
          accessibilityLabel="Undo"
          style={{ minHeight: 40, paddingHorizontal: 14, justifyContent: 'center' }}
        >
          <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.gold, letterSpacing: 0.4 }}>UNDO</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

export function useUndoToast({ duration = 5000, bottom = 24 } = {}) {
  const [state, setState] = useState(null);
  const timer = useRef(null);
  const seq = useRef(0);

  const hide = useCallback(() => { clearTimeout(timer.current); setState(null); }, []);
  const show = useCallback((message, onUndo) => {
    clearTimeout(timer.current);
    const id = ++seq.current;
    setState({ id, message, onUndo });
    timer.current = setTimeout(() => setState(s => (s && s.id === id ? null : s)), duration);
  }, [duration]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const toast = state
    ? <UndoToast key={state.id} message={state.message} bottom={bottom} onUndo={() => { hide(); state.onUndo(); }} />
    : null;
  return { show, hide, toast };
}

export function useUndoableDelete({ duration = 5000, bottom = 24 } = {}) {
  const [pending, setPending] = useState({});     // id -> true
  const [last, setLast] = useState(null);         // { id, label } shown in the toast
  const timers = useRef({});                      // id -> { t, commit }

  const clearPending = useCallback((id) => {
    setPending(p => { const n = { ...p }; delete n[id]; return n; });
    setLast(l => (l && l.id === id ? null : l));
  }, []);

  const schedule = useCallback((id, label, commit) => {
    if (timers.current[id]) { clearTimeout(timers.current[id].t); }
    setPending(p => ({ ...p, [id]: true }));
    setLast({ id, label });
    const t = setTimeout(() => {
      const e = timers.current[id];
      delete timers.current[id];
      if (e) e.commit();
      clearPending(id);
    }, duration);
    timers.current[id] = { t, commit };
  }, [duration, clearPending]);

  const undo = useCallback((id) => {
    const e = timers.current[id];
    if (e) { clearTimeout(e.t); delete timers.current[id]; }
    clearPending(id);
  }, [clearPending]);

  // Never lose a delete: commit anything still pending if the screen unmounts, the
  // tab is closed, or the app goes to the background before the undo window ends.
  // (Ids stay hidden afterwards; the toast just goes away since Undo can no longer help.)
  const flushAll = useCallback(() => {
    const ids = Object.keys(timers.current);
    if (!ids.length) return;
    ids.forEach(id => {
      const e = timers.current[id];
      clearTimeout(e.t);
      e.commit();
    });
    timers.current = {};
    setLast(null);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => { if (s !== 'active') flushAll(); });
    const onUnload = () => flushAll();
    if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('beforeunload', onUnload);
    return () => {
      if (sub && sub.remove) sub.remove();
      if (typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('beforeunload', onUnload);
      flushAll();
    };
  }, [flushAll]);

  const toast = last
    ? <UndoToast key={last.id} message={`${last.label} removed`} bottom={bottom} onUndo={() => undo(last.id)} />
    : null;
  return { isPending: (id) => !!pending[id], pending, schedule, toast };
}
