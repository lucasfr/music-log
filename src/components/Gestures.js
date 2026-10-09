// Touch gestures for lists: swipe-left-to-delete and drag-to-reorder.
//
// Built on the core PanResponder + Animated, so it behaves the same on the web
// PWA and on native, with no extra dependencies or native rebuild.
//
//   <ReorderList data keyExtractor onReorder onDragChange renderItem>
//     renderItem({ item, index, isActive, handleProps }) ->
//       <SwipeRow onDelete={...}>
//         ... <DragHandle handleProps={handleProps} /> ...
//       </SwipeRow>
//
// Reordering is driven from an explicit grip (DragHandle), not a long-press, so
// it can never fight with scrolling or with tapping a card open. Swiping only
// claims the touch once the movement is clearly horizontal, so vertical
// scrolling is untouched.

import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, Animated, PanResponder, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLOURS, RADIUS, TOUCH } from '../theme';
import { overIndex, shiftFor, snapOffset, clampDy } from '../utils/reorder';

const IS_WEB = Platform.OS === 'web';

function buzz() {
  if (IS_WEB) return;
  try {
    const p = Haptics.selectionAsync();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* haptics unavailable */ }
}

// Tell the browser which touch gestures are ours. Without this, a horizontal
// swipe or a drag on the handle would be hijacked by native page scrolling.
const PAN_Y    = IS_WEB ? { touchAction: 'pan-y' } : null;
const NO_TOUCH = IS_WEB ? { touchAction: 'none', userSelect: 'none', cursor: 'grab' } : null;

// ─── Swipe left to delete ─────────────────────────────────────────────────────

export const SWIPE_ACTION_W = 88;

export function SwipeRow({
  children,
  onDelete,
  label = 'Delete',
  bottomInset = 0,        // match the child's marginBottom so the red action lines up with the card
  radius = RADIUS.md,
  fullSwipe = true,       // swipe most of the way across to delete without tapping the button
  disabled = false,
}) {
  const x       = useRef(new Animated.Value(0)).current;
  const cur     = useRef(0);
  const start   = useRef(0);
  const width   = useRef(0);
  const latest  = useRef({});
  latest.current = { onDelete, disabled, fullSwipe };
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const id = x.addListener(({ value }) => { cur.current = value; });
    return () => x.removeListener(id);
  }, [x]);

  const animateTo = (to, done) =>
    Animated.timing(x, { toValue: to, duration: 170, useNativeDriver: false }).start(done);

  const close = () => { setIsOpen(false); animateTo(0); };
  const open  = () => { setIsOpen(true); animateTo(-SWIPE_ACTION_W); };

  const remove = () => {
    animateTo(-(width.current || 400), () => {
      const fn = latest.current.onDelete;
      if (fn) fn();
      // If the parent didn't remove us (e.g. a confirm dialog was cancelled),
      // slide back rather than leaving an invisible row behind.
      setTimeout(() => { x.setValue(0); setIsOpen(false); }, 60);
    });
  };

  const settle = (g) => {
    const nx = cur.current;
    const w = width.current || 400;
    const vx = g ? g.vx : 0;
    if (latest.current.fullSwipe && (nx < -w * 0.5 || (vx < -0.9 && nx < -SWIPE_ACTION_W))) {
      buzz();
      remove();
    } else if (g && vx > 0.4) {
      close();
    } else if (nx < -SWIPE_ACTION_W * 0.5 || (g && vx < -0.5)) {
      open();
    } else {
      close();
    }
  };

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      !latest.current.disabled && Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { start.current = cur.current; x.stopAnimation(); },
    onPanResponderMove: (_, g) => {
      let nx = start.current + g.dx;
      if (nx > 0) nx *= 0.15;                       // rubber-band when pulling right
      x.setValue(Math.max(nx, -(width.current || 400)));
    },
    onPanResponderRelease: (_, g) => settle(g),
    onPanResponderTerminate: () => settle(null),
  })).current;

  return (
    <View onLayout={e => { width.current = e.nativeEvent.layout.width; }}>
      <Animated.View
        style={{
          position: 'absolute', top: 0, right: 0, bottom: bottomInset, width: SWIPE_ACTION_W,
          opacity: x.interpolate({ inputRange: [-24, 0], outputRange: [1, 0], extrapolate: 'clamp' }),
        }}
      >
        <TouchableOpacity
          onPress={() => { close(); if (onDelete) onDelete(); }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={{
            flex: 1, borderRadius: radius, backgroundColor: COLOURS.danger,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="trash-outline" size={22} color="#fff" />
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: '#fff', marginTop: 2 }}>{label}</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[{ transform: [{ translateX: x }] }, PAN_Y]} {...pan.panHandlers}>
        {children}
        {isOpen && (
          // While open, the first tap anywhere on the row just closes it.
          <TouchableOpacity activeOpacity={1} onPress={close} style={StyleSheet.absoluteFill} />
        )}
      </Animated.View>
    </View>
  );
}

// ─── Drag to reorder ──────────────────────────────────────────────────────────

export function DragHandle({ handleProps, active = false }) {
  return (
    <View
      {...handleProps}
      accessibilityRole="button"
      accessibilityLabel="Drag to reorder"
      style={[{ width: TOUCH.min, height: TOUCH.min, alignItems: 'center', justifyContent: 'center' }, NO_TOUCH]}
    >
      <Ionicons name="reorder-three" size={26} color={active ? COLOURS.navy : COLOURS.textDim} />
    </View>
  );
}

export function ReorderList({ data, keyExtractor, renderItem, onReorder, onDragChange, itemGap = 10 }) {
  const layouts    = useRef({});   // key -> { y, h } (original, un-shifted)
  const shifts     = useRef({});   // key -> Animated.Value (translateY)
  const responders = useRef({});   // key -> PanResponder
  const drag       = useRef(null); // { key, index, keys, h, startY, over }
  const latest     = useRef({});
  latest.current = { data, keyExtractor, onReorder, onDragChange, itemGap };
  const [activeKey, setActiveKey] = useState(null);
  // The dashed "drop here" placeholder that glides to wherever the card will land.
  const [slotH, setSlotH] = useState(0);
  const slotTop = useRef(new Animated.Value(0)).current;

  const getShift = (key) => {
    if (!shifts.current[key]) shifts.current[key] = new Animated.Value(0);
    return shifts.current[key];
  };

  const begin = (key) => {
    const { data: d, keyExtractor: kx, onDragChange: odc } = latest.current;
    const keys = d.map(kx);
    const index = keys.indexOf(key);
    const L = layouts.current[key];
    if (index < 0 || !L) return;
    drag.current = { key, index, keys, h: L.h, startY: L.y, over: index };
    slotTop.setValue(L.y);
    setSlotH(Math.max(0, L.h - latest.current.itemGap));
    setActiveKey(key);
    if (odc) odc(true);
    buzz();
  };

  const move = (dy) => {
    const s = drag.current;
    if (!s) return;
    const cdy = clampDy(s.keys, layouts.current, s.index, dy);
    getShift(s.key).setValue(cdy);
    const over = overIndex(s.keys, layouts.current, s.key, s.startY + s.h / 2 + cdy);
    if (over !== s.over) {
      s.over = over;
      buzz();
      Animated.timing(slotTop, {
        toValue: s.startY + snapOffset(s.keys, layouts.current, s.index, over),
        duration: 140,
        useNativeDriver: false,
      }).start();
      s.keys.forEach((k, i) => {
        if (k === s.key) return;
        Animated.timing(getShift(k), {
          toValue: shiftFor(i, s.index, over, s.h),
          duration: 140,
          useNativeDriver: false,
        }).start();
      });
    }
  };

  const end = () => {
    const s = drag.current;
    if (!s) return;
    drag.current = null;
    const target = snapOffset(s.keys, layouts.current, s.index, s.over);
    Animated.timing(getShift(s.key), { toValue: target, duration: 120, useNativeDriver: false }).start(() => {
      const { onReorder: reorderCb, onDragChange: odc } = latest.current;
      setActiveKey(null);
      if (odc) odc(false);
      if (s.over !== s.index) {
        // Offsets are cleared in the layout effect below, once the new order
        // has been laid out, so nothing flashes back to its old position.
        if (reorderCb) reorderCb(s.index, s.over);
      } else {
        s.keys.forEach(k => getShift(k).setValue(0));
      }
    });
  };

  const getResponder = (key) => {
    if (!responders.current[key]) {
      responders.current[key] = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => begin(key),
        onPanResponderMove: (_, g) => move(g.dy),
        onPanResponderRelease: () => end(),
        onPanResponderTerminate: () => end(),
      });
    }
    return responders.current[key];
  };

  // After the data order changes, clear every translate offset before paint.
  const orderSig = data.map(keyExtractor).join('|');
  useLayoutEffect(() => {
    Object.keys(shifts.current).forEach(k => shifts.current[k].setValue(0));
  }, [orderSig]);

  return (
    <View>
      {activeKey != null && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', left: 0, right: 0, top: slotTop, height: slotH,
            borderRadius: RADIUS.md,
            borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(9,99,126,0.5)',
            backgroundColor: 'rgba(9,99,126,0.08)',
          }}
        />
      )}
      {data.map((item, index) => {
        const key = keyExtractor(item);
        const isActive = key === activeKey;
        return (
          <Animated.View
            key={key}
            onLayout={e => { layouts.current[key] = e.nativeEvent.layout; }}
            style={{
              transform: [{ translateY: getShift(key) }, { scale: isActive ? 1.03 : 1 }],
              zIndex: isActive ? 20 : 1,
              // Lifted: a deeper shadow makes the held card read as floating above the list.
              ...(isActive ? {
                shadowColor: COLOURS.navy, shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.35, shadowRadius: 18, elevation: 14,
              } : null),
            }}
          >
            {renderItem({ item, index, isActive, handleProps: getResponder(key).panHandlers })}
          </Animated.View>
        );
      })}
    </View>
  );
}
