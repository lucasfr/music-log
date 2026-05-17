import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, SIZES } from '../theme';
import { SectionTitle, EmptyState } from '../components/UI';
import { SessionDetailModal } from '../components/SessionDetailModal';
import { LessonDetailModal } from '../components/LessonDetailModal';
import { fmtDate } from '../utils';

function energyToBar(v) { return v === null || v === undefined ? 0 : v + 3; }

function ZeldaMini({ emoji, value, total = 5 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <Text key={i} style={{ fontSize: 14, opacity: i < value ? 1 : 0.18 }}>{emoji}</Text>
      ))}
    </View>
  );
}

function PracticeEntry({ session, compositions, onPress }) {
  const compName = id => (compositions.find(c => c.id === id) || {}).title || null;
  const techSegs  = (session.segments || []).filter(s => s.type === 'technique');
  const repSegs   = (session.segments || []).filter(s => s.type === 'repertoire');
  const techNames  = [...new Set(techSegs.map(s => s.title || s.group).filter(Boolean))];
  const pieceNames = [...new Set(repSegs.map(s => s.compositionId ? compName(s.compositionId) : s.title).filter(Boolean))];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <BlurView intensity={36} tint="light" style={{
        borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 10,
        shadowColor: COLOURS.glassShadow,
        shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 18, elevation: 5,
      }}>
        <View style={{ backgroundColor: COLOURS.accentLight, padding: 14, flexDirection: 'row', alignItems: 'stretch', gap: 12 }}>
          <View style={{ width: 4, borderRadius: 2, backgroundColor: COLOURS.red, alignSelf: 'stretch' }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.text, marginBottom: 4 }}>
              {fmtDate(session.date)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, backgroundColor: COLOURS.practiceBg }}>
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
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                {techNames.map(t => (
                  <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLOURS.practiceBg, borderRadius: RADIUS.pill }}>
                    <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.practiceText }}>{t}</Text>
                  </View>
                ))}
                {pieceNames.map(p => (
                  <View key={p} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLOURS.practiceBg, borderRadius: RADIUS.pill }}>
                    <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.practiceText }}>{p}</Text>
                  </View>
                ))}
              </View>
            )}
            {session.wins ? (
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 13, color: COLOURS.textMuted, marginTop: 8, lineHeight: 19 }} numberOfLines={2}>
                "{session.wins}"
              </Text>
            ) : null}
          </View>
        </View>
      </BlurView>
    </TouchableOpacity>
  );
}

function LessonEntry({ lesson, compositions, onPress }) {
  const compName = id => (compositions.find(c => c.id === id) || {}).title || null;
  const allSegs = lesson.segments || lesson.pieces || [];
  const pieceNames = [...new Set(allSegs
    .filter(p => p.type === 'repertoire' || !p.type)
    .map(p => p.compositionId ? compName(p.compositionId) : (p.title || p.pieceName))
    .filter(Boolean)
  )];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <BlurView intensity={36} tint="light" style={{
        borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 10,
        shadowColor: COLOURS.glassShadow,
        shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 18, elevation: 5,
      }}>
        <View style={{ backgroundColor: COLOURS.accent2Light, padding: 14, flexDirection: 'row', alignItems: 'stretch', gap: 12 }}>
          <View style={{ width: 4, borderRadius: 2, backgroundColor: COLOURS.amber, alignSelf: 'stretch' }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.text, marginBottom: 4 }}>
              {fmtDate(lesson.date)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, backgroundColor: COLOURS.lessonBg }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.tiny + 1, color: COLOURS.lessonText }}>🎓 lesson</Text>
              </View>
              {(lesson.duration || lesson.teacher) ? (
                <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>
                  {[lesson.duration ? `${lesson.duration} min` : null, lesson.teacher].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
            </View>
            {(lesson.energy != null || lesson.enjoyment) ? (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                {lesson.energy != null ? <ZeldaMini emoji="⚡" value={energyToBar(lesson.energy)} /> : null}
                {lesson.enjoyment ? <ZeldaMini emoji="❤️" value={lesson.enjoyment} /> : null}
              </View>
            ) : null}
            {pieceNames.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 }}>
                {pieceNames.map(p => (
                  <View key={p} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLOURS.lessonBg, borderRadius: RADIUS.pill }}>
                    <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.lessonText }}>{p}</Text>
                  </View>
                ))}
              </View>
            )}
            {lesson.wins ? (
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 13, color: COLOURS.textMuted, marginTop: 8, lineHeight: 19 }} numberOfLines={2}>
                "{lesson.wins}"
              </Text>
            ) : null}
          </View>
        </View>
      </BlurView>
    </TouchableOpacity>
  );
}

export default function HistoryScreen({ sessions, lessons, compositions, onDelete, onDeleteLesson, isDesktop }) {
  const [detailSession, setDetailSession] = useState(null);
  const [detailLesson,  setDetailLesson]  = useState(null);

  const feedItems = useMemo(() => {
    const s = (sessions  || []).map(s => ({ ...s, _type: 'practice' }));
    const l = (lessons   || []).map(l => ({ ...l, _type: 'lesson'   }));
    return [...s, ...l].sort((a, b) =>
      b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '')
    );
  }, [sessions, lessons]);

  if (feedItems.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <EmptyState icon="📖" text="No sessions logged yet." />
      </SafeAreaView>
    );
  }

  // Group by month label
  const grouped = useMemo(() => {
    const groups = [];
    let current = null;
    feedItems.forEach(item => {
      const [y, m] = item.date.split('-');
      const label = new Date(Number(y), Number(m) - 1, 1)
        .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      if (!current || current.label !== label) {
        current = { label, items: [] };
        groups.push(current);
      }
      current.items.push(item);
    });
    return groups;
  }, [feedItems]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingLeft: isDesktop ? 226 : 16, paddingBottom: 120 }}>
        <SectionTitle style={{ marginTop: 4 }}>History</SectionTitle>
        {grouped.map(group => (
          <View key={group.label} style={{ marginBottom: 8 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              {group.label}
            </Text>
            {group.items.map(item =>
              item._type === 'lesson' ? (
                <LessonEntry key={item.id} lesson={item} compositions={compositions}
                  onPress={() => setDetailLesson(item)} />
              ) : (
                <PracticeEntry key={item.id} session={item} compositions={compositions}
                  onPress={() => setDetailSession(item)} />
              )
            )}
          </View>
        ))}
      </ScrollView>

      <SessionDetailModal
        visible={!!detailSession}
        session={detailSession}
        compositions={compositions}
        onClose={() => setDetailSession(null)}
        onDelete={id => { onDelete(id); setDetailSession(null); }}
      />
      <LessonDetailModal
        visible={!!detailLesson}
        lesson={detailLesson}
        compositions={compositions}
        onClose={() => setDetailLesson(null)}
        onDelete={id => { onDeleteLesson(id); setDetailLesson(null); }}
      />
    </SafeAreaView>
  );
}
