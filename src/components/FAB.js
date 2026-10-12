import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { COLOURS, RADIUS } from '../theme';
import { Rotate, FadeInUp, PressScale } from './Motion';

// Shared look of the three option pills; only the glow colour differs.
const optionStyle = glow => ({
  minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10,
  paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.pill,
  backgroundColor: COLOURS.float, borderWidth: 1, borderColor: COLOURS.w(0.9),
  shadowColor: glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 4,
});

export function FAB({ onPractice, onLesson, onTimer, isDesktop }) {
  const [expanded, setExpanded] = useState(false);
  // The +100 bump (from the original 24) only matters on mobile web, to
  // clear the floating pill nav bar — desktop uses the sidebar instead and
  // never had a pill to clear, so bumping it there just left the FAB
  // sitting oddly high for no reason.
  const bottom = isDesktop ? 24 : Platform.OS === 'web' ? 100 : Platform.OS === 'ios' ? 140 : 120;
  return (
    <View style={{ position: 'absolute', bottom, right: 20, alignItems: 'flex-end', gap: 10 }}>
      {expanded && (
        <>
          {/* The options fade up one after another, nearest the button first. */}
          {onTimer && (
            <FadeInUp delay={100}>
              <TouchableOpacity onPress={() => { setExpanded(false); onTimer(); }} activeOpacity={0.85}
                style={optionStyle(COLOURS.glowTeal)}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.steel }}>{'⏱ Start timer'}</Text>
              </TouchableOpacity>
            </FadeInUp>
          )}
          <FadeInUp delay={50}>
            <TouchableOpacity onPress={() => { setExpanded(false); onLesson(); }} activeOpacity={0.85}
              style={optionStyle(COLOURS.glowLesson)}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.lessonText }}>{'🎓 Log lesson'}</Text>
            </TouchableOpacity>
          </FadeInUp>
          <FadeInUp>
            <TouchableOpacity onPress={() => { setExpanded(false); onPractice(); }} activeOpacity={0.85}
              style={optionStyle(COLOURS.glowPractice)}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.practiceText }}>{'🎹 Log practice'}</Text>
            </TouchableOpacity>
          </FadeInUp>
        </>
      )}
      <PressScale onPress={() => setExpanded(e => !e)} activeOpacity={0.85} scaleTo={0.92}
        accessibilityRole="button" accessibilityLabel={expanded ? 'Close menu' : 'Add session, lesson or timer'}
        style={{
          width: 58, height: 58, borderRadius: 29, backgroundColor: COLOURS.float, borderWidth: 1, borderColor: COLOURS.w(0.9),
          alignItems: 'center', justifyContent: 'center',
          shadowColor: COLOURS.glowPractice, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 16, elevation: 8,
        }}>
        {/* A "+" that turns 45° into a "×" when the menu opens. */}
        <Rotate active={expanded}>
          <Text style={{ fontSize: 28, color: COLOURS.text, lineHeight: 32, marginTop: -2 }}>+</Text>
        </Rotate>
      </PressScale>
    </View>
  );
}
