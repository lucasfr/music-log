import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, SIZES, TOUCH_PILL, HIT_PILL } from '../theme';
import { SectionTitle, EmptyState } from '../components/UI';
import { SwipeRow } from '../components/Gestures';
import { TextF } from '../components/Form';
import { useUndoableDelete } from '../components/Undo';
import { fmtDate, formatScaleEntry, formatArticulation, formatTempo } from '../utils';

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

function StarRow({ value, total = 5, emoji = '🎵' }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center', marginTop: 6 }}>
      {Array.from({ length: total }, (_, i) => (
        <Text key={i} style={{ fontSize: 14, opacity: i < value ? 1 : 0.18 }}>{emoji}</Text>
      ))}
    </View>
  );
}

function SegDetail({ seg, compName, accentColor }) {
  const isTech = seg.type === 'technique';
  const name = isTech
    ? (seg.title || seg.group || 'Technical work')
    : (seg.compositionId ? compName(seg.compositionId) : (seg.title || seg.pieceName || 'Piece'));
  return (
    <View style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: accentColor, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {isTech
          ? <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.text }}>{name}</Text>
          : <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 16, color: COLOURS.text }}>{'📜 ' + name}</Text>
        }
        {(isTech && seg.group && seg.title)
          ? <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)' }}><Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim }}>{seg.group}</Text></View>
          : null}
        {seg.duration
          ? <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)' }}><Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim }}>{'⏱ ' + seg.duration + ' min'}</Text></View>
          : null}
      </View>
      {isTech && (formatArticulation(seg) || formatTempo(seg)) ? <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.steel, marginTop: 3 }}>{[formatArticulation(seg), formatTempo(seg)].filter(Boolean).join(' · ')}</Text> : null}
      {(seg.scales && seg.scales.length > 0) ? <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textMuted, marginTop: 3 }}>{seg.scales.map(s => formatScaleEntry(s, seg.octaves || 1)).join(' · ')}</Text> : null}
      {seg.section ? <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginTop: 2 }}>{seg.section}</Text> : null}
      {seg.feltDifficulty ? <View style={{ marginTop: 4 }}><Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginBottom: 2 }}>Difficulty</Text><StarRow value={seg.feltDifficulty} emoji="🎵" /></View> : null}
      {seg.liking ? <View style={{ marginTop: 4 }}><Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginBottom: 2 }}>Liking</Text><StarRow value={seg.liking} emoji="⭐" /></View> : null}
      {seg.feedback ? <View style={{ marginTop: 6, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: COLOURS.steel }}><Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>Feedback</Text><Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textMuted, lineHeight: 19 }}>{seg.feedback}</Text></View> : null}
      {seg.assignment ? <View style={{ marginTop: 6, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: COLOURS.navy }}><Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>Assignment</Text><Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textMuted, lineHeight: 19 }}>{seg.assignment}</Text></View> : null}
      {seg.notes ? <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textMuted, marginTop: 4, lineHeight: 20 }}>{seg.notes}</Text> : null}
      {(seg.challenges && seg.challenges.length > 0) ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>{seg.challenges.map(t => (<View key={t} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(221,174,211,0.15)', borderRadius: RADIUS.pill }}><Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textMuted }}>{t}</Text></View>))}</View> : null}
      {(seg.progress && seg.progress.length > 0) ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>{seg.progress.map(t => (<View key={t} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLOURS.accentLight, borderRadius: RADIUS.pill }}><Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.navy }}>{t}</Text></View>))}</View> : null}
    </View>
  );
}

function DeleteBtn({ onPress }) {
  return (
    <View style={{ alignItems: 'flex-end', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLOURS.glassBorderSubtle }}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.75} hitSlop={HIT_PILL} style={{ ...TOUCH_PILL, paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: COLOURS.dangerLight, shadowColor: 'rgba(192,57,43,0.18)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 }}>
        <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.danger }}>Delete</Text>
      </TouchableOpacity>
    </View>
  );
}

function PracticeEntry({ session, compositions, onDelete }) {
  const compName = id => (compositions.find(c => c.id === id) || {}).title || null;
  const techSegs = (session.segments || []).filter(s => s.type === 'technique');
  const repSegs  = (session.segments || []).filter(s => s.type === 'repertoire');

  return (
    <BlurView intensity={36} tint="light" style={{ borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 10, shadowColor: COLOURS.accentMid, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 16, elevation: 6 }}>
      <View style={{ padding: 14, flexDirection: 'row', alignItems: 'stretch', gap: 12 }}>
        <View style={{ width: 4, borderRadius: 2, backgroundColor: COLOURS.red, alignSelf: 'stretch' }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.text, marginBottom: 4 }}>{fmtDate(session.date)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, backgroundColor: COLOURS.practiceBg }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.tiny + 1, color: COLOURS.practiceText }}>{'🎹 practice'}</Text>
            </View>
            {session.duration ? <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>{session.duration + ' min'}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <ZeldaMini emoji="⚡" value={energyToBar(session.energy)} />
            {session.enjoyment ? <ZeldaMini emoji="❤️" value={session.enjoyment} /> : null}
          </View>
        </View>
      </View>
      <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
        {techSegs.length > 0 ? <View style={{ marginBottom: repSegs.length > 0 ? 14 : 0 }}><Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>{'🎹 Technique'}</Text>{techSegs.map(seg => <SegDetail key={seg.id} seg={seg} compName={compName} accentColor={COLOURS.steel} />)}</View> : null}
        {repSegs.length > 0 ? <View style={{ marginBottom: 8 }}><Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>{'📜 Repertoire'}</Text>{repSegs.map(seg => <SegDetail key={seg.id} seg={seg} compName={compName} accentColor={COLOURS.navy} />)}</View> : null}
        {session.wins ? <View style={{ marginBottom: 8, padding: 12, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: RADIUS.md }}><Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{'✨ Wins'}</Text><Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 14, color: COLOURS.textMuted, lineHeight: 21 }}>{session.wins}</Text></View> : null}
        {session.tomorrowFocus ? <View style={{ marginBottom: 8, padding: 12, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: RADIUS.md }}><Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{'🎯 Next focus'}</Text><Text style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.textMuted, lineHeight: 21 }}>{session.tomorrowFocus}</Text></View> : null}
        <DeleteBtn onPress={() => onDelete(session.id)} />
      </View>
    </BlurView>
  );
}

function LessonEntry({ lesson, compositions, onDeleteLesson }) {
  const compName = id => (compositions.find(c => c.id === id) || {}).title || null;
  const allSegs  = lesson.segments || lesson.pieces || [];
  const techSegs = allSegs.filter(s => s.type === 'technique');
  const repSegs  = allSegs.filter(s => s.type === 'repertoire' || !s.type);

  return (
    <BlurView intensity={36} tint="light" style={{ borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 10, shadowColor: COLOURS.accent2Mid, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 16, elevation: 6 }}>
      <View style={{ padding: 14, flexDirection: 'row', alignItems: 'stretch', gap: 12 }}>
        <View style={{ width: 4, borderRadius: 2, backgroundColor: COLOURS.amber, alignSelf: 'stretch' }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.text, marginBottom: 4 }}>{fmtDate(lesson.date)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, backgroundColor: COLOURS.lessonBg }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.tiny + 1, color: COLOURS.lessonText }}>{'🎓 lesson'}</Text>
            </View>
            {(lesson.duration || lesson.teacher) ? <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>{[lesson.duration ? lesson.duration + ' min' : null, lesson.teacher].filter(Boolean).join(' · ')}</Text> : null}
          </View>
          {(lesson.energy != null || lesson.enjoyment) ? <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>{lesson.energy != null ? <ZeldaMini emoji="⚡" value={energyToBar(lesson.energy)} /> : null}{lesson.enjoyment ? <ZeldaMini emoji="❤️" value={lesson.enjoyment} /> : null}</View> : null}
        </View>
      </View>
      <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
        {techSegs.length > 0 ? <View style={{ marginBottom: repSegs.length > 0 ? 14 : 0 }}><Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>{'🎹 Technique'}</Text>{techSegs.map(seg => <SegDetail key={seg.id} seg={seg} compName={compName} accentColor={COLOURS.steel} />)}</View> : null}
        {repSegs.length > 0 ? <View style={{ marginBottom: 8 }}><Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>{'📜 Repertoire'}</Text>{repSegs.map(seg => <SegDetail key={seg.id} seg={seg} compName={compName} accentColor={COLOURS.amber} />)}</View> : null}
        {lesson.overallNotes ? <View style={{ marginBottom: 8, padding: 12, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: RADIUS.md }}><Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{'✨ Lesson notes'}</Text><Text style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.textMuted, lineHeight: 21 }}>{lesson.overallNotes}</Text></View> : null}
        {lesson.wins ? <View style={{ marginBottom: 8, padding: 12, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: RADIUS.md }}><Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{'🌟 Wins'}</Text><Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 14, color: COLOURS.textMuted, lineHeight: 21 }}>{lesson.wins}</Text></View> : null}
        {lesson.nextFocus ? <View style={{ marginBottom: 8, padding: 12, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: RADIUS.md }}><Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{'🎯 Focus before next lesson'}</Text><Text style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.textMuted, lineHeight: 21 }}>{lesson.nextFocus}</Text></View> : null}
        <DeleteBtn onPress={() => onDeleteLesson(lesson.id)} />
      </View>
    </BlurView>
  );
}

export default function HistoryScreen({ sessions, lessons, compositions, onDelete, onDeleteLesson, isDesktop }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');   // all | practice | lesson
  // Deletes are hidden at once but only committed after the undo window closes.
  const undo = useUndoableDelete({ bottom: isDesktop ? 24 : 100 });

  const feedItems = useMemo(() => {
    const s = (sessions  || []).map(s => ({ ...s, _type: 'practice' }));
    const l = (lessons   || []).map(l => ({ ...l, _type: 'lesson'   }));
    return [...s, ...l].sort((a, b) =>
      b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '')
    );
  }, [sessions, lessons]);

  // Search across everything someone might remember an entry by.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const names = new Map((compositions || []).map(c => [c.id, c.title]));
    return feedItems.filter(item => {
      if (kind !== 'all' && item._type !== kind) return false;
      if (!q) return true;
      const text = [item.date, fmtDate(item.date), item.wins, item.tomorrowFocus, item.overallNotes, item.nextFocus, item.teacher]
        .concat((item.segments || []).flatMap(s => [s.title, s.group, s.section, s.notes, s.feedback, s.assignment, names.get(s.compositionId)]))
        .filter(Boolean).join(' ').toLowerCase();
      return text.includes(q);
    });
  }, [feedItems, query, kind, compositions]);

  // Flatten into month headers + entries so the list can be virtualised.
  const rows = [];
  let lastLabel = null;
  filtered.forEach(item => {
    if (undo.isPending(item.id)) return;
    const [y, m] = item.date.split('-');
    const label = new Date(Number(y), Number(m) - 1, 1)
      .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    if (label !== lastLabel) { rows.push({ type: 'header', key: 'h-' + label, label }); lastLabel = label; }
    rows.push({ type: 'entry', key: item.id, item });
  });
  const firstEntryKey = (rows.find(r => r.type === 'entry') || {}).key;

  if (feedItems.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <EmptyState icon="📖" text="No sessions logged yet." />
      </SafeAreaView>
    );
  }

  const renderRow = ({ item: row }) => {
    if (row.type === 'header') {
      return (
        <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10, marginTop: 12 }}>
          {row.label}
        </Text>
      );
    }
    const item = row.item;
    const isLesson = item._type === 'lesson';
    const remove = isLesson
      ? () => undo.schedule(item.id, 'Lesson', () => onDeleteLesson(item.id))
      : () => undo.schedule(item.id, 'Session', () => onDelete(item.id));
    return (
      <SwipeRow bottomInset={12} hint={row.key === firstEntryKey} onDelete={remove}>
        {isLesson
          ? <LessonEntry lesson={item} compositions={compositions} onDeleteLesson={remove} />
          : <PracticeEntry session={item} compositions={compositions} onDelete={remove} />}
      </SwipeRow>
    );
  };

  const header = (
    <View>
      <SectionTitle style={{ marginTop: 4 }}>History</SectionTitle>
      <TextF value={query} onChange={setQuery} placeholder="Search pieces, notes, dates…" />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 4 }}>
        {[['all', 'All'], ['practice', 'Practice'], ['lesson', 'Lessons']].map(([k, label]) => {
          const active = kind === k;
          return (
            <TouchableOpacity key={k} onPress={() => setKind(k)} activeOpacity={0.75}
              hitSlop={HIT_PILL}
              style={{ ...TOUCH_PILL, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: active ? COLOURS.navy : 'rgba(255,255,255,0.55)' }}>
              <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: 13, color: active ? '#fff' : COLOURS.textMuted }}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <FlatList
        data={rows}
        keyExtractor={r => r.key}
        renderItem={renderRow}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState icon="🔎" text="Nothing matches that search." />}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
        contentContainerStyle={{ padding: 16, paddingLeft: isDesktop ? 226 : 16, paddingBottom: 120 }}
      />
      {undo.toast}
    </SafeAreaView>
  );
}
