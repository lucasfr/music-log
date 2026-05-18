import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { COLOURS, RADIUS } from '../theme';

export function FAB({ onPractice, onLesson }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={{ position: 'absolute', bottom: Platform.OS === 'web' ? 24 : Platform.OS === 'ios' ? 140 : 120, right: 20, alignItems: 'flex-end', gap: 10 }}>
      {expanded && (
        <>
          <TouchableOpacity onPress={() => { setExpanded(false); onLesson(); }} activeOpacity={0.85}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', shadowColor: COLOURS.accent2Mid, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 4 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.lessonText }}>{'🎓 Log lesson'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setExpanded(false); onPractice(); }} activeOpacity={0.85}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', shadowColor: COLOURS.accentMid, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 4 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.practiceText }}>{'🎹 Log practice'}</Text>
          </TouchableOpacity>
        </>
      )}
      <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.85}
        style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', shadowColor: COLOURS.accentMid, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 16, elevation: 8 }}>
        <Text style={{ fontSize: expanded ? 22 : 28, color: COLOURS.text, lineHeight: 32, marginTop: -2 }}>
          {expanded ? '✕' : '+'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
