// A small motion toolkit, built on React Native's own Animated (no extra dependency, no native
// rebuild). Every component here checks the system's "reduce motion" setting and, when it's
// on, shows its final state immediately instead of animating.
//
//   <Pop trigger={focused}>…</Pop>          springs up when `trigger` turns on (tab icons, ratings)
//   <FadeInUp delay={ms}>…</FadeInUp>       fades and slides up into place on mount (cards)
//   <AnimatedFill fraction={0.4} style />   a bar whose width eases to its new value
//   <Rotate active>…</Rotate>               turns 45° when active (the "+" becoming a "×")
//   <PressScale …touchableProps>            a TouchableOpacity that presses down slightly
//
// Transform and opacity use the native driver; only the bar's width (a layout property) can't.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, AccessibilityInfo, Easing, TouchableOpacity } from 'react-native';
import { DURATION, clampFraction } from '../utils/motion';

let reduceCache = false;

// true when the user has asked the system to reduce motion (iOS, Android and, on web, the
// prefers-reduced-motion setting).
export function useReduceMotion() {
  const [reduce, setReduce] = useState(reduceCache);
  useEffect(() => {
    let alive = true;
    if (AccessibilityInfo.isReduceMotionEnabled) {
      AccessibilityInfo.isReduceMotionEnabled().then(v => { reduceCache = !!v; if (alive) setReduce(!!v); }).catch(() => {});
    }
    const sub = AccessibilityInfo.addEventListener
      ? AccessibilityInfo.addEventListener('reduceMotionChanged', v => { reduceCache = !!v; setReduce(!!v); })
      : null;
    return () => { alive = false; if (sub && sub.remove) sub.remove(); };
  }, []);
  return reduce;
}

export function Pop({ trigger, playOnMount = false, from = 0.6, delay = 0, style, children }) {
  const reduce = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    const isFirst = first.current;
    first.current = false;
    if (reduce || !trigger || (isFirst && !playOnMount)) return undefined;
    scale.setValue(from);
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 170, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

export function FadeInUp({ delay = 0, distance = 12, skip = false, style, children }) {
  const reduce = useReduceMotion();
  const progress = useRef(new Animated.Value(reduce || skip ? 1 : 0)).current;
  useEffect(() => {
    if (reduce || skip) { progress.setValue(1); return undefined; }
    const anim = Animated.timing(progress, {
      toValue: 1, duration: DURATION.enter, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View style={[style, {
      opacity: progress,
      transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
    }]}>
      {children}
    </Animated.View>
  );
}

export function AnimatedFill({ fraction, style }) {
  const reduce = useReduceMotion();
  const target = clampFraction(fraction);
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) { value.setValue(target); return undefined; }
    const anim = Animated.timing(value, { toValue: target, duration: DURATION.fill, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [target, reduce]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Animated.View style={[style, { width: value.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />;
}

export function Rotate({ active, degrees = 45, style, children }) {
  const reduce = useReduceMotion();
  const turn = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) { turn.setValue(active ? 1 : 0); return undefined; }
    const anim = Animated.spring(turn, { toValue: active ? 1 : 0, friction: 6, tension: 140, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [active, reduce]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View style={[style, { transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${degrees}deg`] }) }] }]}>
      {children}
    </Animated.View>
  );
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export function PressScale({ scaleTo = 0.95, onPressIn, onPressOut, style, children, ...rest }) {
  const reduce = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (toValue, friction) => {
    if (reduce) return;
    Animated.spring(scale, { toValue, friction, tension: 220, useNativeDriver: true }).start();
  };
  return (
    <AnimatedTouchable
      {...rest}
      onPressIn={e => { spring(scaleTo, 8); if (onPressIn) onPressIn(e); }}
      onPressOut={e => { spring(1, 5); if (onPressOut) onPressOut(e); }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedTouchable>
  );
}
