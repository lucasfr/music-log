// The practice and lesson cards in Home's feed. Moved out of HomeScreen.js unchanged.

import React from 'react';
import { View, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, SIZES } from '../../theme';
import { Tap as TouchableOpacity } from '../../components/Motion';
import { fmtDate } from '../../utils';
import { relativeDay } from '../../utils/planning';
import { energyToBar, ZeldaMini, todayISO } from './helpers';

// ─── Practice entry card ──────────────────────────────────────────────────────

export function PracticeEntry({ session, compositions, onPress, showDate = true, isSelected = false }) {
  const compName = id => (compositions.find(c => c.id === id) || {}).title || null;
  const techSegs  = (session.segments || []).filter(s => s.type === 'technique');
  const repSegs   = (session.segments || []).filter(s => s.type === 'repertoire');
  const techNames  = [...new Set(techSegs.map(s => s.group || s.title).filter(Boolean))];
  const pieceNames = [...new Set(repSegs.map(s => s.compositionId ? compName(s.compositionId) : s.title).filter(Boolean))];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <BlurView intensity={isSelected ? 50 : 36} tint={COLOURS.blurTint} style={{
        borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 10, backgroundColor: COLOURS.entryWash,
        shadowColor: isSelected ? COLOURS.accentMid : COLOURS.glowPractice,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: isSelected ? 0.7 : 0.45,
        shadowRadius: isSelected ? 20 : 14,
        elevation: isSelected ? 8 : 5,
      }}>
        <View style={{ padding: 14, flexDirection: 'row', alignItems: 'stretch', gap: 12, backgroundColor: COLOURS.entryWash }}>
          <View style={{ width: 4, borderRadius: 2, backgroundColor: COLOURS.red, alignSelf: 'stretch' }} />
          <View style={{ flex: 1 }}>
            {showDate && (
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.text, marginBottom: 4 }}>
                {relativeDay(session.date, todayISO()) || fmtDate(session.date)}
                {relativeDay(session.date, todayISO()) ? <Text style={{ fontFamily: 'Lato', color: COLOURS.textDim }}>{`  ·  ${fmtDate(session.date)}`}</Text> : null}
              </Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: COLOURS.practiceBg }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.tiny + 1, color: COLOURS.practiceText }}>🎹 practice</Text>
              </View>
              {session.duration ? (
                <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>{session.duration} min</Text>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <ZeldaMini emoji="⚡" value={energyToBar(session.energy)} />
              {session.enjoyment ? <ZeldaMini emoji="❤️" value={session.enjoyment} /> : null}
            </View>
            {(techNames.length > 0 || pieceNames.length > 0) && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {techNames.map(t => (
                  <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: COLOURS.navyA(0.08), borderRadius: RADIUS.pill }}>
                    <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textMuted }}>{t}</Text>
                  </View>
                ))}
                {pieceNames.map(p => (
                  <View key={p} style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: COLOURS.tealAccent, borderRadius: RADIUS.pill }}>
                    <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.steel }}>{p}</Text>
                  </View>
                ))}
              </View>
            )}
            {session.wins ? (
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.label, color: COLOURS.textMuted, marginTop: 8, lineHeight: 19 }} numberOfLines={2}>
                "{session.wins}"
              </Text>
            ) : null}
          </View>
        </View>
      </BlurView>
    </TouchableOpacity>
  );
}

// ─── Lesson entry card ────────────────────────────────────────────────────────

export function LessonEntry({ lesson, compositions, onPress, showDate = true, isSelected = false }) {
  const compName = id => (compositions.find(c => c.id === id) || {}).title || null;
  const pieceNames = [...new Set((lesson.segments || lesson.pieces || []).map(p =>
    p.compositionId ? compName(p.compositionId) : (p.title || p.pieceName)
  ).filter(Boolean))];
  const newPieces = (lesson.segments || lesson.pieces || []).filter(p => p.isNew);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <BlurView intensity={isSelected ? 50 : 36} tint={COLOURS.blurTint} style={{
        borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 10, backgroundColor: COLOURS.entryWash,
        shadowColor: isSelected ? COLOURS.accent2Mid : COLOURS.glowLesson,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: isSelected ? 0.7 : 0.45,
        shadowRadius: isSelected ? 20 : 14,
        elevation: isSelected ? 8 : 5,
      }}>
        <View style={{ padding: 14, flexDirection: 'row', alignItems: 'stretch', gap: 12, backgroundColor: COLOURS.entryWash }}>
          <View style={{ width: 4, borderRadius: 2, backgroundColor: COLOURS.amber, alignSelf: 'stretch' }} />
          <View style={{ flex: 1 }}>
            {showDate && (
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.text, marginBottom: 4 }}>
                {relativeDay(lesson.date, todayISO()) || fmtDate(lesson.date)}
                {relativeDay(lesson.date, todayISO()) ? <Text style={{ fontFamily: 'Lato', color: COLOURS.textDim }}>{`  ·  ${fmtDate(lesson.date)}`}</Text> : null}
              </Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: COLOURS.lessonBg }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.tiny + 1, color: COLOURS.lessonText }}>🎓 lesson</Text>
              </View>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>{lesson.duration} min · {lesson.teacher}</Text>
            </View>
            {(lesson.energy || lesson.enjoyment) ? (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                {lesson.energy ? <ZeldaMini emoji="⚡" value={energyToBar(lesson.energy)} /> : null}
                {lesson.enjoyment ? <ZeldaMini emoji="❤️" value={lesson.enjoyment} /> : null}
              </View>
            ) : null}
            {pieceNames.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {pieceNames.map(p => (
                  <View key={p} style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: COLOURS.tealAccent, borderRadius: RADIUS.pill }}>
                    <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.steel }}>{p}</Text>
                  </View>
                ))}
                {newPieces.map(p => {
                  const name = p.compositionId ? compName(p.compositionId) : p.pieceName;
                  return name ? (
                    <View key={p.id} style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: COLOURS.yellowLight, borderRadius: RADIUS.pill }}>
                      <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.lessonText }}>✦ {name}</Text>
                    </View>
                  ) : null;
                })}
              </View>
            )}
            {lesson.wins ? (
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.label, color: COLOURS.textMuted, marginTop: 8, lineHeight: 19 }} numberOfLines={2}>
                "{lesson.wins}"
              </Text>
            ) : null}
          </View>
        </View>
      </BlurView>
    </TouchableOpacity>
  );
}
