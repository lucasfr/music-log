import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Rect, Pattern, Defs } from 'react-native-svg';
import { COLOURS } from '../theme';

export function AppBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: COLOURS.bg }]} />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <Pattern id="dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
              <Circle cx="1" cy="1" r="1" fill="rgba(33,60,81,0.12)" />
            </Pattern>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#dots)" />
        </Svg>
      </View>
    </View>
  );
}
