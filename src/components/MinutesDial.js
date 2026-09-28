import React, { useRef } from 'react';
import { View, Text, PanResponder } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLOURS } from '../theme';

const SIZE = 148;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
const CIRC = 2 * Math.PI * R;

function angleForValue(value, max) {
  return (Math.max(0, Math.min(max, value)) / max) * 360;
}

function valueForAngle(angle, max, step) {
  const raw = (angle / 360) * max;
  const stepped = Math.round(raw / step) * step;
  return Math.max(step, Math.min(max, stepped)); // never let a drag zero it out
}

// Drag-to-set dial, kitchen-timer style. Touch anywhere on the ring (or drag
// around it) to set minutes; angle 0/360 = top, clockwise.
export function MinutesDial({ value, onChange, max = 60, step = 1, label = 'min' }) {
  const viewRef = useRef(null);
  const layoutRef = useRef({ pageX: 0, pageY: 0, size: SIZE });

  function angleFromTouch(pageX, pageY) {
    const { pageX: ox, pageY: oy, size } = layoutRef.current;
    const cx = ox + size / 2;
    const cy = oy + size / 2;
    const dx = pageX - cx;
    const dy = pageY - cy;
    let deg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (deg < 0) deg += 360;
    return deg;
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { pageX, pageY } = e.nativeEvent;
        onChange(valueForAngle(angleFromTouch(pageX, pageY), max, step));
      },
      onPanResponderMove: (e) => {
        const { pageX, pageY } = e.nativeEvent;
        onChange(valueForAngle(angleFromTouch(pageX, pageY), max, step));
      },
    })
  ).current;

  const angle = angleForValue(value, max);
  const progressLen = (angle / 360) * CIRC;
  const knobRad = ((angle - 90) * Math.PI) / 180;

  return (
    <View
      ref={viewRef}
      onLayout={() => {
        viewRef.current?.measure((_x, _y, width, _height, pageX, pageY) => {
          layoutRef.current = { pageX, pageY, size: width };
        });
      }}
      {...panResponder.panHandlers}
      style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} pointerEvents="none">
        <Circle cx={CENTER} cy={CENTER} r={R} stroke="rgba(9,99,126,0.12)" strokeWidth={STROKE} fill="none" />
        <Circle
          cx={CENTER} cy={CENTER} r={R}
          stroke={COLOURS.amber} strokeWidth={STROKE} fill="none"
          strokeDasharray={`${progressLen} ${CIRC}`}
          strokeLinecap="round"
          rotation={-90}
          origin={`${CENTER}, ${CENTER}`}
        />
        <Circle
          cx={CENTER + R * Math.cos(knobRad)}
          cy={CENTER + R * Math.sin(knobRad)}
          r={STROKE / 2 + 4}
          fill="#ffffff" stroke={COLOURS.navy} strokeWidth={2}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }} pointerEvents="none">
        <Text style={{ fontFamily: 'Lato-Bold', fontSize: 26, color: COLOURS.navy }}>{value}</Text>
        <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim }}>{label}</Text>
      </View>
    </View>
  );
}
