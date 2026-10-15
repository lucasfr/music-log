import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLOURS, RADIUS, SIZES, TOUCH_PILL, HIT_PILL, HIT_TEXT } from '../theme';
import { RatingMini } from './UI';
import { fmtDate } from '../utils';

const energyToBar = v => (v === null || v === undefined ? 0 : v + 3);

// A bottom sheet for one calendar day on a phone: everything logged that day (a practice and a
// lesson, or several practices) as rows you can open, plus Log practice and Log lesson. Tapping
// an empty day used to open the practice form straight away, and a day with more than one entry
// only ever opened the first.
export function DaySheet({
  date, sessions = [], lessons = [], compositions = [],
  onClose, onOpenSession, onOpenLesson, onLogPractice, onLogLesson,
}) {
  const insets = useSafeAreaInsets();
  const compName = id => (compositions.find(c => c.id === id) || {}).title || null;
  const hasEntries = sessions.length > 0 || lessons.length > 0;

  const pill = (label, onPress, bg, fg, a11y) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} hitSlop={HIT_PILL}
      accessibilityRole="button" accessibilityLabel={a11y}
      style={{ ...TOUCH_PILL, flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: RADIUS.pill, backgroundColor: bg, paddingVertical: 10 }}>
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: fg }}>{label}</Text>
    </TouchableOpacity>
  );

  const row = (key, bar, kindBg, kindFg, kindLabel, meta, ratings, names, onPress, a11y) => (
    <TouchableOpacity key={key} onPress={onPress} activeOpacity={0.8}
      accessibilityRole="button" accessibilityLabel={a11y}
      style={{ flexDirection: 'row', gap: 12, padding: 12, marginBottom: 10, borderRadius: RADIUS.md, backgroundColor: COLOURS.entryWash }}>
      <View style={{ width: 4, borderRadius: 2, backgroundColor: bar, alignSelf: 'stretch' }} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, backgroundColor: kindBg }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.tiny + 1, color: kindFg }}>{kindLabel}</Text>
          </View>
          {meta ? <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>{meta}</Text> : null}
        </View>
        {ratings}
        {names.length > 0 ? (
          <Text numberOfLines={2} style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textMuted, marginTop: 6, lineHeight: 18 }}>{names.join(' \u00b7 ')}</Text>
        ) : null}
      </View>
      <Text style={{ alignSelf: 'center', fontSize: 22, color: COLOURS.textDim }}>{'\u203a'}</Text>
    </TouchableOpacity>
  );

  const ratingRow = (energy, enjoyment) => (energy != null || enjoyment) ? (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
      {energy != null ? <RatingMini emoji={'\u26a1'} value={energyToBar(energy)} size={14} /> : null}
      {enjoyment ? <RatingMini emoji={'\u2764\ufe0f'} value={enjoyment} size={14} /> : null}
    </View>
  ) : null;

  return (
    <Modal visible={!!date} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.35)' }]}
          onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={{
          backgroundColor: COLOURS.sheet, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
          maxHeight: '78%', paddingBottom: Math.max(insets.bottom, 12) + 4,
          shadowColor: COLOURS.glassShadowMd, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 1, shadowRadius: 24, elevation: 20,
        }}>
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: COLOURS.navyA(0.18) }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 }}>
            <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 24, color: COLOURS.text }}>{date ? fmtDate(date) : ''}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={HIT_TEXT} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 16, color: COLOURS.textDim }}>{'\u2715'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}>
            {!hasEntries ? (
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 16, color: COLOURS.textDim, marginBottom: 14 }}>
                Nothing logged on this day.
              </Text>
            ) : null}

            {lessons.map(l => {
              const segs = l.segments || l.pieces || [];
              const names = [...new Set(segs.map(p => (p.compositionId ? compName(p.compositionId) : (p.title || p.pieceName))).filter(Boolean))];
              const meta = [l.duration ? `${l.duration} min` : '', l.teacher || ''].filter(Boolean).join(' \u00b7 ');
              return row(l.id, COLOURS.amber, COLOURS.lessonBg, COLOURS.lessonText, '\ud83c\udf93 lesson', meta,
                ratingRow(l.energy, l.enjoyment), names, () => onOpenLesson(l), `Open the lesson on ${fmtDate(l.date)}`);
            })}

            {sessions.map(s => {
              const segs = s.segments || [];
              const tech = segs.filter(x => x.type === 'technique').map(x => x.group || x.title).filter(Boolean);
              const pieces = segs.filter(x => x.type === 'repertoire').map(x => (x.compositionId ? compName(x.compositionId) : x.title)).filter(Boolean);
              const names = [...new Set([...tech, ...pieces])];
              return row(s.id, COLOURS.red, COLOURS.practiceBg, COLOURS.practiceText, '\ud83c\udfb9 practice',
                s.duration ? `${s.duration} min` : '', ratingRow(s.energy, s.enjoyment), names,
                () => onOpenSession(s), `Open the practice on ${fmtDate(s.date)}`);
            })}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10 }}>
            {pill('\ud83c\udfb9 Log practice', onLogPractice, COLOURS.practiceBg, COLOURS.practiceText, 'Log practice for this day')}
            {pill('\ud83c\udf93 Log lesson', onLogLesson, COLOURS.lessonBg, COLOURS.lessonText, 'Log a lesson for this day')}
          </View>
        </View>
      </View>
    </Modal>
  );
}
