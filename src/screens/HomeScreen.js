import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Dimensions, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS } from '../theme';
import { LogModal } from '../components/LogModal';
import { LessonModal } from '../components/LessonModal';
import { SessionDetailModal } from '../components/SessionDetailModal';
import { LessonDetailModal } from '../components/LessonDetailModal';
import { fmtDate } from '../utils';

const ENERGY_LABELS = { '-2': 'Very low', '-1': 'Low', '0': 'Neutral', '1': 'Good', '2': 'High' };

function todayISO() { return new Date().toISOString().slice(0, 10); }

function energyDotColour(energy) {
  if (energy >= 1)  return COLOURS.navy;
  if (energy === 0) return COLOURS.steel;
  return 'rgba(101,148,177,0.45)';
}

function PracticeEntry({ session, compositions, onPress }) {
  const compName = id => (compositions.find(c => c.id === id) || {}).title || null;
  const techSegs = (session.segments || []).filter(s => s.type === 'technique');
  const repSegs  = (session.segments || []).filter(s => s.type === 'repertoire');
  const techNames  = [...new Set(techSegs.map(s => s.group || s.title).filter(Boolean))];
  const pieceNames = [...new Set(repSegs.map(s => s.compositionId ? compName(s.compositionId) : s.title).filter(Boolean))];
  const isToday = session.date === todayISO();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <BlurView intensity={28} tint="light" style={{
        borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLOURS.glassBorder,
        overflow: 'hidden', marginBottom: 10,
        shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3,
      }}>
        <View style={{ backgroundColor: COLOURS.glass, padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <View style={{ width: 3, height: 36, borderRadius: 2, backgroundColor: energyDotColour(session.energy) }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 14, color: COLOURS.text }}>
                {isToday ? 'Today' : fmtDate(session.date)}
              </Text>
              <Text style={{ fontFamily: 'SourceSans3', fontSize: 12, color: COLOURS.textDim, marginTop: 1 }}>
                {session.duration ? `${session.duration} min · ` : ''}
                Energy {session.energy > 0 ? `+${session.energy}` : session.energy} · {ENERGY_LABELS[String(session.energy)]}
                {session.enjoyment ? ` · ❤️ ${session.enjoyment}/5` : ''}
              </Text>
            </View>
          </View>
          {(techNames.length > 0 || pieceNames.length > 0) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
              {techNames.map(t => (
                <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLOURS.accent2Light, borderRadius: RADIUS.pill }}>
                  <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: COLOURS.navy }}>{t}</Text>
                </View>
              ))}
              {pieceNames.map(p => (
                <View key={p} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLOURS.accentLight, borderRadius: RADIUS.pill }}>
                  <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: COLOURS.navy }}>{p}</Text>
                </View>
              ))}
            </View>
          )}
          {session.wins ? (
            <Text style={{ fontFamily: 'LibreBaskerville-Italic', fontSize: 13, color: COLOURS.textMuted, marginTop: 8, lineHeight: 19 }} numberOfLines={2}>
              "{session.wins}"
            </Text>
          ) : null}
        </View>
      </BlurView>
    </TouchableOpacity>
  );
}

function LessonEntry({ lesson, compositions, onPress }) {
  const compName = id => (compositions.find(c => c.id === id) || {}).title || null;
  const pieceNames = [...new Set((lesson.pieces || []).map(p =>
    p.compositionId ? compName(p.compositionId) : p.pieceName
  ).filter(Boolean))];
  const newPieces = (lesson.pieces || []).filter(p => p.isNew);
  const isToday = lesson.date === todayISO();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <BlurView intensity={28} tint="light" style={{
        borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(221,174,211,0.45)',
        overflow: 'hidden', marginBottom: 10,
        shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3,
      }}>
        <View style={{ backgroundColor: 'rgba(221,174,211,0.10)', padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <View style={{ width: 3, height: 36, borderRadius: 2, backgroundColor: COLOURS.pink }} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 14, color: COLOURS.text }}>
                  {isToday ? 'Today' : fmtDate(lesson.date)}
                </Text>
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLOURS.pinkLight }}>
                  <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 10, color: '#5C2D6E' }}>🎓 lesson</Text>
                </View>
              </View>
              <Text style={{ fontFamily: 'SourceSans3', fontSize: 12, color: COLOURS.textDim, marginTop: 1 }}>
                {lesson.duration} min · {lesson.teacher}
              </Text>
            </View>
          </View>
          {pieceNames.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
              {pieceNames.map(p => (
                <View key={p} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLOURS.accentLight, borderRadius: RADIUS.pill }}>
                  <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: COLOURS.navy }}>{p}</Text>
                </View>
              ))}
              {newPieces.map(p => {
                const name = p.compositionId ? compName(p.compositionId) : p.pieceName;
                return name ? (
                  <View key={p.id} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLOURS.pinkLight, borderRadius: RADIUS.pill }}>
                    <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 11, color: '#5C2D6E' }}>✦ {name}</Text>
                  </View>
                ) : null;
              })}
            </View>
          )}
          {lesson.wins ? (
            <Text style={{ fontFamily: 'LibreBaskerville-Italic', fontSize: 13, color: COLOURS.textMuted, marginTop: 8, lineHeight: 19 }} numberOfLines={2}>
              "{lesson.wins}"
            </Text>
          ) : null}
        </View>
      </BlurView>
    </TouchableOpacity>
  );
}

function FAB({ onPractice, onLesson }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={{ position: 'absolute', bottom: Platform.OS === 'ios' ? 100 : 80, right: 20, alignItems: 'flex-end', gap: 10 }}>
      {expanded && (
        <>
          <TouchableOpacity
            onPress={() => { setExpanded(false); onLesson(); }}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.pill,
              backgroundColor: COLOURS.pinkLight, borderWidth: 1, borderColor: 'rgba(221,174,211,0.50)',
              shadowColor: 'rgba(221,174,211,0.5)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 5,
            }}
          >
            <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 14, color: '#5C2D6E' }}>🎓 Log lesson</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setExpanded(false); onPractice(); }}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.pill,
              backgroundColor: COLOURS.accentLight, borderWidth: 1, borderColor: COLOURS.glassBorder,
              shadowColor: COLOURS.navy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 5,
            }}
          >
            <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 14, color: COLOURS.navy }}>🎹 Log practice</Text>
          </TouchableOpacity>
        </>
      )}
      <TouchableOpacity
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.85}
        style={{
          width: 58, height: 58, borderRadius: 29, backgroundColor: COLOURS.navy,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: COLOURS.navy, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.40, shadowRadius: 16, elevation: 8,
        }}
      >
        <Text style={{ fontSize: expanded ? 22 : 28, color: '#fff', lineHeight: 32, marginTop: -2 }}>
          {expanded ? '✕' : '+'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function HomeScreen({ sessions, lessons, compositions, onSave, onSaveLesson, onDelete, onDeleteLesson }) {
  const today = todayISO();
  const [logModalDate,    setLogModalDate]    = useState(null);
  const [lessonModalDate, setLessonModalDate] = useState(null);
  const [detailSession,   setDetailSession]   = useState(null);
  const [detailLesson,    setDetailLesson]    = useState(null);

  const sessionMap = useMemo(() => {
    const m = {};
    sessions.forEach(s => { m[s.date] = s; });
    return m;
  }, [sessions]);

  const todaySession = sessionMap[today];
  const todayLesson  = (lessons || []).find(l => l.date === today);

  const feedItems = useMemo(() => {
    const s = sessions.filter(s => s.date !== today).map(s => ({ ...s, _type: 'practice' }));
    const l = (lessons || []).filter(l => l.date !== today).map(l => ({ ...l, _type: 'lesson' }));
    return [...s, ...l].sort((a, b) => b.date.localeCompare(a.date));
  }, [sessions, lessons, today]);

  const todayPieces = todaySession ? [...new Set((todaySession.segments || [])
    .filter(s => s.type === 'repertoire')
    .map(s => s.compositionId ? (compositions.find(c => c.id === s.compositionId) || {}).title || s.title : s.title)
    .filter(Boolean))] : [];
  const todayTech = todaySession ? [...new Set((todaySession.segments || []).filter(s => s.type === 'technique').map(s => s.group || s.title).filter(Boolean))] : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        <View style={{ marginBottom: 20, marginTop: 4 }}>
          <Text style={{ fontFamily: 'LibreBaskerville-Italic', fontSize: 26, color: COLOURS.text, letterSpacing: -0.5 }}>music.log</Text>
          <Text style={{ fontFamily: 'SourceSans3', fontSize: 13, color: COLOURS.textDim, marginTop: 2 }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        </View>

        <BlurView intensity={36} tint="light" style={{
          borderRadius: RADIUS.md, borderWidth: 1,
          borderColor: todayLesson ? 'rgba(221,174,211,0.45)' : COLOURS.glassBorder,
          overflow: 'hidden', marginBottom: 24,
          shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16, elevation: 4,
        }}>
          <View style={{ backgroundColor: todayLesson ? 'rgba(221,174,211,0.10)' : COLOURS.glass, padding: 16 }}>
            <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Today</Text>

            {todayLesson ? (
              <TouchableOpacity activeOpacity={0.8} onPress={() => setDetailLesson(todayLesson)}>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: COLOURS.pinkLight, borderWidth: 1, borderColor: 'rgba(221,174,211,0.40)' }}>
                    <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 13, color: '#5C2D6E' }}>🎓 Lesson · {todayLesson.duration} min</Text>
                  </View>
                </View>
                {(todayLesson.pieces || []).length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                    {todayLesson.pieces.map(p => {
                      const name = p.compositionId ? (compositions.find(c => c.id === p.compositionId) || {}).title : p.pieceName;
                      return name ? (
                        <View key={p.id} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLOURS.accentLight, borderRadius: RADIUS.pill }}>
                          <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: COLOURS.navy }}>{name}</Text>
                        </View>
                      ) : null;
                    })}
                  </View>
                )}
              </TouchableOpacity>
            ) : todaySession ? (
              <TouchableOpacity activeOpacity={0.8} onPress={() => setDetailSession(todaySession)}>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: todayPieces.length || todayTech.length ? 10 : 0 }}>
                  {todaySession.duration ? (
                    <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: COLOURS.accentLight, borderWidth: 1, borderColor: COLOURS.glassBorder }}>
                      <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 13, color: COLOURS.navy }}>{todaySession.duration} min</Text>
                    </View>
                  ) : null}
                  <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navy }}>
                    <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 13, color: '#fff' }}>
                      {todaySession.energy > 0 ? `+${todaySession.energy}` : todaySession.energy} · {ENERGY_LABELS[String(todaySession.energy)]}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                  {todayTech.map(t => (
                    <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLOURS.accent2Light, borderRadius: RADIUS.pill }}>
                      <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: COLOURS.navy }}>{t}</Text>
                    </View>
                  ))}
                  {todayPieces.map(p => (
                    <View key={p} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLOURS.accentLight, borderRadius: RADIUS.pill }}>
                      <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: COLOURS.navy }}>{p}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            ) : (
              <View>
                <Text style={{ fontFamily: 'LibreBaskerville-Italic', fontSize: 15, color: COLOURS.textDim }}>No session logged yet.</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <TouchableOpacity onPress={() => setLogModalDate(today)} activeOpacity={0.8}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navy }}>
                    <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 13, color: '#fff' }}>🎹 Log practice</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setLessonModalDate(today)} activeOpacity={0.8}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLOURS.pinkLight, borderWidth: 1, borderColor: 'rgba(221,174,211,0.40)' }}>
                    <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 13, color: '#5C2D6E' }}>🎓 Log lesson</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </BlurView>

        {feedItems.length > 0 && (
          <>
            <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
              Previous sessions
            </Text>
            {feedItems.map(item =>
              item._type === 'lesson' ? (
                <LessonEntry key={item.id} lesson={item} compositions={compositions} onPress={() => setDetailLesson(item)} />
              ) : (
                <PracticeEntry key={item.id} session={item} compositions={compositions} onPress={() => setDetailSession(item)} />
              )
            )}
          </>
        )}

        {sessions.length === 0 && (lessons || []).length === 0 && (
          <View style={{ alignItems: 'center', padding: 32 }}>
            <Text style={{ fontFamily: 'LibreBaskerville-Italic', fontSize: 16, color: COLOURS.textDim, textAlign: 'center', lineHeight: 24 }}>
              Your practice journal starts here.{'\n'}Log your first session above.
            </Text>
          </View>
        )}
      </ScrollView>

      <FAB
        onPractice={() => setLogModalDate(today)}
        onLesson={() => setLessonModalDate(today)}
      />

      <LogModal
        visible={!!logModalDate}
        initialDate={logModalDate || ''}
        compositions={compositions}
        onSave={s => { onSave(s); setLogModalDate(null); }}
        onClose={() => setLogModalDate(null)}
      />

      <LessonModal
        visible={!!lessonModalDate}
        initialDate={lessonModalDate || ''}
        compositions={compositions}
        onSave={l => { onSaveLesson(l); setLessonModalDate(null); }}
        onClose={() => setLessonModalDate(null)}
      />

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
