import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Animated,
  PanResponder, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS } from '../theme';

const SLIDES = [
  {
    emoji: '🎹',
    headline: 'Your practice,\nremembered.',
    sub: 'music.log is a quiet journal for your piano practice — tracking energy, pieces, and progress without getting in the way.',
  },
  {
    emoji: '⚡',
    headline: 'Every session\ntells a story.',
    sub: 'Log how you felt, what you played, and what clicked. Watch patterns emerge across days, weeks, and months.',
  },
  {
    emoji: '📜',
    headline: 'Your repertoire,\nin one place.',
    sub: 'Track pieces from first note to performance-ready. Keep teacher feedback, study notes, and recordings together.',
  },
  {
    emoji: '🎓',
    headline: 'Ready\nwhenever you are.',
    sub: 'Log a session in seconds before the moment fades. Your practice journal starts now.',
    isFinal: true,
  },
];

function Dots({ total, active }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{
          width: i === active ? 20 : 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: i === active ? COLOURS.navy : 'rgba(9,99,126,0.25)',
        }} />
      ))}
    </View>
  );
}

export function OnboardingScreen({ onComplete }) {
  const [index, setIndex] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity    = useRef(new Animated.Value(1)).current;

  function goTo(next) {
    if (next >= SLIDES.length) { onComplete(); return; }
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: -20, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      setIndex(next);
      translateX.setValue(20);
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  }

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10,
    onPanResponderRelease: (_, g) => {
      if (g.dx < -40) goTo(index + 1);
      if (g.dx > 40 && index > 0) goTo(index - 1);
    },
  })).current;

  const slide = SLIDES[index];
  const isDesktopWeb = Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth >= 768;

  const card = (
    <BlurView intensity={60} tint="light" style={{
      borderRadius: 24,
      overflow: 'hidden',
      width: isDesktopWeb ? 420 : '100%',
      shadowColor: 'rgba(9,99,126,0.20)',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 1,
      shadowRadius: 48,
      elevation: 20,
    }}>
      <View style={{
        backgroundColor: 'rgba(255,255,255,0.60)',
        padding: 36,
        paddingBottom: 32,
      }} {...panResponder.panHandlers}>
        <Animated.View style={{ opacity, transform: [{ translateX }] }}>
          <Text style={{ fontSize: 48, marginBottom: 20 }}>{slide.emoji}</Text>
          <Text style={{
            fontFamily: 'CormorantGaramond-Italic',
            fontSize: 38,
            lineHeight: 46,
            color: COLOURS.text,
            letterSpacing: -0.5,
            marginBottom: 16,
          }}>
            {slide.headline}
          </Text>
          <Text style={{
            fontFamily: 'Lato',
            fontSize: 15,
            lineHeight: 24,
            color: COLOURS.textMuted,
            marginBottom: 28,
          }}>
            {slide.sub}
          </Text>
        </Animated.View>

        <Dots total={SLIDES.length} active={index} />

        <TouchableOpacity
          onPress={() => goTo(index + 1)}
          activeOpacity={0.85}
          style={{
            marginTop: 20,
            paddingVertical: 16,
            borderRadius: RADIUS.pill,
            backgroundColor: COLOURS.navy,
            alignItems: 'center',
            shadowColor: 'rgba(9,99,126,0.35)',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 1, shadowRadius: 16, elevation: 6,
          }}
        >
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: 15, color: '#fff', letterSpacing: 0.3 }}>
            {slide.isFinal ? 'Start logging →' : 'Continue →'}
          </Text>
        </TouchableOpacity>

        {!slide.isFinal && (
          <TouchableOpacity onPress={onComplete} activeOpacity={0.6} style={{ alignItems: 'center', marginTop: 14 }}>
            <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim }}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </BlurView>
  );

  if (isDesktopWeb) {
    return (
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(9,40,60,0.30)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}>
        {card}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center', paddingBottom: 40 }}>
      {card}
    </View>
  );
}
