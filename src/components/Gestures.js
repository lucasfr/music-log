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
import { View, Text, Animated, PanResponder, TouchableOpacity, StyleSheet, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLOURS, RADIUS, TOUCH } from '../theme';
import { overIndex, shiftFor, snapOffset, clampDy, toSlot } from '../utils/reorder';
import { getLocalPref, setLocalPref } from '../utils';

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

// The first swipeable row on screen nudges itself open and shut once, ever, so
// people discover the gesture. Remembered across launches.
let hintShownThisSession = false;

export function SwipeRow({
  children,
  onDelete,
  label = 'Delete',
  bottomInset = 0,        // match the child's marginBottom so the red action lines up with the card
  radius = RADIUS.md,
  fullSwipe = true,       // swipe most of the way across to delete without tapping the button
  disabled = false,
  hint = false,           // peek the action once, on first ever use, to teach the gesture
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

  useEffect(() => {
    if (!hint || hintShownThisSession) return undefined;
    hintShownThisSession = true;
    if (getLocalPref('swipeHintSeen') === '1') return undefined;
    const t = setTimeout(() => {
      setLocalPref('swipeHintSeen', '1');
      Animated.sequence([
        Animated.timing(x, { toValue: -44, duration: 320, useNativeDriver: false }),
        Animated.delay(450),
        Animated.timing(x, { toValue: 0, duration: 260, useNativeDriver: false }),
      ]).start();
    }, 900);
    return () => clearTimeout(t);
  }, [hint, x]);

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

export function ReorderList({ data, keyExtractor, renderItem, onReorder, onDragChange, itemGap = 10, scrollRef, scrollOffset }) {
  const layouts    = useRef({});   // key -> { y, h } (original, un-shifted)
  const shifts     = useRef({});   // key -> Animated.Value (translateY)
  const responders = useRef({});   // key -> PanResponder
  const drag       = useRef(null); // { key, index, keys, h, startY, over }
  const latest     = useRef({});
  latest.current = { data, keyExtractor, onReorder, onDragChange, itemGap, scrollRef, scrollOffset };
  const [activeKey, setActiveKey] = useState(null);
  // The dashed "drop here" placeholder that glides to wherever the card will land.
  const [slotH, setSlotH] = useState(0);
  const slotTop = useRef(new Animated.Value(0)).current;
  const [overIdx, setOverIdx] = useState(0);   // slot the held card is currently over, for the "2 of 4" label

  const getShift = (key) => {
    if (!shifts.current[key]) shifts.current[key] = new Animated.Value(0);
    return shifts.current[key];
  };

  const begin = (key) => {
    const { data: d, keyExtractor: kx, onDragChange: odc } = latest.current;
    const keys = d.map(kx);
    const index = keys.indexOf(key);
    const L = layouts.current[key];
    if (index < 0 || !L || !(L.h > 0)) return;
    const so = latest.current.scrollOffset;
    drag.current = {
      key, index, keys, h: L.h, startY: L.y, over: index,
      startScroll: so ? so.current : 0, rawDy: 0, moveY: 0, timer: null,
    };
    // While a card is held near the top or bottom of the screen, keep scrolling.
    if (latest.current.scrollRef) drag.current.timer = setInterval(autoScroll, 16);
    slotTop.setValue(L.y);
    setSlotH(Math.max(0, L.h - latest.current.itemGap));
    setOverIdx(index);
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
      setOverIdx(over);
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

  // Finger position -> list position, allowing for how far the list has scrolled
  // since the drag began.
  const moveRaw = (g) => {
    const s = drag.current;
    if (!s) return;
    s.rawDy = g.dy;
    s.moveY = g.moveY;
    const so = latest.current.scrollOffset;
    move(g.dy + (so ? so.current - s.startScroll : 0));
  };

  const autoScroll = () => {
    const s = drag.current;
    const { scrollRef: ref, scrollOffset: so } = latest.current;
    if (!s || !ref || !ref.current || !so || !s.moveY) return;
    const H = Dimensions.get('window').height;
    const TOP = 150;      // below the modal header
    const ZONE = 90;      // how close to the edge before scrolling starts
    const BOTTOM = H - 40;
    let v = 0;
    if (s.moveY < TOP + ZONE) v = -Math.min(16, (TOP + ZONE - s.moveY) / 5);
    else if (s.moveY > BOTTOM - ZONE) v = Math.min(16, (s.moveY - (BOTTOM - ZONE)) / 4);
    if (v === 0) return;
    const next = Math.max(0, so.current + v);
    ref.current.scrollTo({ y: next, animated: false });
    move(s.rawDy + (next - s.startScroll));
  };

  const end = () => {
    const s = drag.current;
    if (!s) return;
    if (s.timer) clearInterval(s.timer);
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
        onPanResponderMove: (_, g) => moveRaw(g),
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
    // While a card is held, lift the whole list above whatever follows it (like the Start
    // button), otherwise the held card slides underneath its siblings.
    <View style={{ zIndex: activeKey != null ? 100 : 0 }}>
      {data.map((item, index) => {
        const key = keyExtractor(item);
        const isActive = key === activeKey;
        return (
          <Animated.View
            key={key}
            // React Native reports { x, y, width, height }; the reorder maths wants { y, h }.
            onLayout={e => { layouts.current[key] = toSlot(e.nativeEvent.layout); }}
            style={{
              transform: [{ translateY: getShift(key) }, { scale: isActive ? 1.02 : 1 }],
              zIndex: isActive ? 20 : 1,
              // Slightly see-through, so the drop outline stays visible where they overlap.
              opacity: isActive ? 0.92 : 1,
              ...(isActive ? {
                borderRadius: RADIUS.md,   // so the shadow follows the card's corners, not a square
                shadowColor: COLOURS.navy, shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.35, shadowRadius: 18, elevation: 14,
              } : null),
            }}
          >
            {renderItem({ item, index, isActive, handleProps: getResponder(key).panHandlers })}
          </Animated.View>
        );
      })}
      {/* Drop slot: drawn last and above everything, so it's visible even under the held card. */}
      {activeKey != null && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', left: 0, right: 0, top: slotTop, height: slotH, zIndex: 30,
            borderRadius: RADIUS.md,
            borderWidth: 3, borderStyle: 'dashed', borderColor: COLOURS.navy,
            backgroundColor: COLOURS.navyA(0.06),
            alignItems: 'center',
          }}
        >
          <View style={{ position: 'absolute', top: -14, paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navy }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: '#fff' }}>
              Drop here · {overIdx + 1} of {data.length}
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
