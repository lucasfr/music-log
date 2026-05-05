import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS } from '../theme';
import { LogModal } from '../components/LogModal';
import { LessonModal } from '../components/LessonModal';
import { SessionDetailModal } from '../components/SessionDetailModal';
import { LessonDetailModal } from '../components/LessonDetailModal';
import { fmtDate } from '../utils';

// Energy: DB stores -2..+2, Zelda bar is 1..5
function energyToBar(v) { return v === null || v === undefined ? 0 : v + 3; }

function ZeldaMini({ emoji, value, total = 5 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <Text key={i} style={{ fontSize: 16, opacity: i < value ? 1 : 0.18, transform: [{ scale: i < value ? 1 : 0.88 }] }}>{emoji}</Text>
      ))}
    </View>
  );
}

const ENERGY_LABELS = { '-2': 'Very low', '-1': 'Low', '0': 'Neutral', '1': 'Good', '2': 'High' };

function todayISO() { return new Date().toISOString().slice(0, 10); }

function energyDotColour(energy) {
  if (energy >= 1)  return COLOURS.red;
  if (energy === 0) return COLOURS.tealLight;
  return 'rgba(214,40,40,0.35)';
}

// ─── Practice entry ───────────────────────────────────────────────────────────

function PracticeEntry({ session, compositions, onPress, showDate = true }) {
  const compName = id => (compositions.find(c => c.id === id) || {}).title || null;
  const techSegs  = (session.segments || []).filter(s => s.type === 'technique');
  const repSegs   = (session.segments || []).filter(s => s.type === 'repertoire');
  const techNames  = [...new Set(techSegs.map(s => s.group || s.title).filter(Boolean))];
  const pieceNames = [...new Set(repSegs.map(s => s.compositionId ? compName(s.compositionId) : s.title).filter(Boolean))];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <BlurView intensity={36} tint="light" style={{
        borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 10,
        shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 18, elevation: 5,
      }}>
        <View style={{ backgroundColor: COLOURS.accentLight, padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <View style={{ width: 3, height: 36, borderRadius: 2, backgroundColor: energyDotColour(session.energy) }} />
            <View style={{ flex: 1 }}>
              {showDate && (
                <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 14, color: COLOURS.text }}>
                  {fmtDate(session.date)}
                </Text>
              )}
              {showDate ? (
                <Text style={{ fontFamily: 'SourceSans3', fontSize: 12, color: COLOURS.textDim, marginTop: 1 }}>
                  {session.duration ? `${session.duration} min · ` : ''}⚡ {session.energy > 0 ? `+${session.energy}` : session.energy} · {ENERGY_LABELS[String(session.energy)]}{session.enjoyment ? `  ❤️ ${session.enjoyment}/5` : ''}
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}>
                  {session.duration ? <Text style={{ fontFamily: 'SourceSans3', fontSize: 12, color: COLOURS.textDim }}>{session.duration} min</Text> : null}
                  {session.duration ? <Text style={{ color: COLOURS.textDim, fontSize: 12 }}>·</Text> : null}
                  <ZeldaMini emoji="⚡" value={energyToBar(session.energy)} />
                  {session.enjoyment ? <ZeldaMini emoji="❤️" value={session.enjoyment} /> : null}
                </View>
              )}
            </View>
          </View>
          {(techNames.length > 0 || pieceNames.length > 0) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
              {techNames.map(t => (
                <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(214,40,40,0.12)', borderRadius: RADIUS.pill, shadowColor: COLOURS.accentMid, shadowOffset:{width:0,height:1}, shadowOpacity:1, shadowRadius:4, elevation:1 }}>
                  <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: '#8A1010' }}>{t}</Text>
                </View>
              ))}
              {pieceNames.map(p => (
                <View key={p} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(214,40,40,0.12)', borderRadius: RADIUS.pill, shadowColor: COLOURS.accentMid, shadowOffset:{width:0,height:1}, shadowOpacity:1, shadowRadius:4, elevation:1 }}>
                  <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: '#8A1010' }}>{p}</Text>
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

// ─── Lesson entry ─────────────────────────────────────────────────────────────

function LessonEntry({ lesson, compositions, onPress, showDate = true }) {
  const compName = id => (compositions.find(c => c.id === id) || {}).title || null;
  const pieceNames = [...new Set((lesson.pieces || []).map(p =>
    p.compositionId ? compName(p.compositionId) : p.pieceName
  ).filter(Boolean))];
  const newPieces = (lesson.pieces || []).filter(p => p.isNew);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <BlurView intensity={36} tint="light" style={{
        borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 10,
        shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 18, elevation: 5,
      }}>
        <View style={{ backgroundColor: COLOURS.accent2Light, padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <View style={{ width: 3, height: 36, borderRadius: 2, backgroundColor: COLOURS.amber }} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {showDate && (
                  <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 14, color: COLOURS.text }}>
                    {fmtDate(lesson.date)}
                  </Text>
                )}
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: 'rgba(247,127,0,0.12)', shadowColor: COLOURS.accent2Mid, shadowOffset:{width:0,height:1}, shadowOpacity:1, shadowRadius:4, elevation:1 }}>
                  <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 10, color: '#7A3A00' }}>🎓 lesson</Text>
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
                <View key={p} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(247,127,0,0.12)', borderRadius: RADIUS.pill, shadowColor: COLOURS.accent2Mid, shadowOffset:{width:0,height:1}, shadowOpacity:1, shadowRadius:4, elevation:1 }}>
                  <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: '#7A3A00' }}>{p}</Text>
                </View>
              ))}
              {newPieces.map(p => {
                const name = p.compositionId ? compName(p.compositionId) : p.pieceName;
                return name ? (
                  <View key={p.id} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(252,191,73,0.18)', borderRadius: RADIUS.pill, shadowColor: COLOURS.yellowMid, shadowOffset:{width:0,height:1}, shadowOpacity:1, shadowRadius:4, elevation:1 }}>
                    <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 11, color: '#5A3A00' }}>✦ {name}</Text>
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

// ─── FAB ─────────────────────────────────────────────────────────────────────

function FAB({ onPractice, onLesson }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={{ position: 'absolute', bottom: Platform.OS === 'ios' ? 100 : 80, right: 20, alignItems: 'flex-end', gap: 10 }}>
      {expanded && (
        <>
          <TouchableOpacity
            onPress={() => { setExpanded(false); onLesson(); }}
            activeOpacity={0.85}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.50)', shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 4 }}
          >
            <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 14, color: '#7A3A00' }}>🎓 Log lesson</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setExpanded(false); onPractice(); }}
            activeOpacity={0.85}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.50)', shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 4 }}
          >
            <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 14, color: '#8A1010' }}>🎹 Log practice</Text>
          </TouchableOpacity>
        </>
      )}
      <TouchableOpacity
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.85}
        style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,255,255,0.58)', alignItems: 'center', justifyContent: 'center', shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 16, elevation: 8 }}
      >
        <Text style={{ fontSize: expanded ? 22 : 28, color: COLOURS.text, lineHeight: 32, marginTop: -2 }}>
          {expanded ? '✕' : '+'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen({ sessions, lessons, compositions, onSave, onSaveLesson, onDelete, onDeleteLesson }) {
  const today = todayISO();
  const [logModalDate,    setLogModalDate]    = useState(null);
  const [lessonModalDate, setLessonModalDate] = useState(null);
  const [detailSession,   setDetailSession]   = useState(null);
  const [detailLesson,    setDetailLesson]    = useState(null);

  // All today's entries (can be multiple sessions + multiple lessons)
  const todaySessions = useMemo(() => sessions.filter(s => s.date === today), [sessions, today]);
  const todayLessons  = useMemo(() => (lessons || []).filter(l => l.date === today), [lessons, today]);
  const hasToday = todaySessions.length > 0 || todayLessons.length > 0;

  // Feed = everything sorted by date desc, all entries (not filtered by today)
  const feedItems = useMemo(() => {
    const s = sessions.filter(s => s.date !== today).map(s => ({ ...s, _type: 'practice' }));
    const l = (lessons || []).filter(l => l.date !== today).map(l => ({ ...l, _type: 'lesson' }));
    return [...s, ...l].sort((a, b) =>
      b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '')
    );
  }, [sessions, lessons, today]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        <View style={{ marginBottom: 20, marginTop: 4 }}>
          <Text style={{ fontFamily: 'LibreBaskerville-Italic', fontSize: 26, color: COLOURS.text, letterSpacing: -0.5 }}>music.log</Text>
          <Text style={{ fontFamily: 'SourceSans3', fontSize: 13, color: COLOURS.textDim, marginTop: 2 }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        </View>

        {/* Today card */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Today</Text>

            {hasToday ? (
              <View style={{ gap: 10 }}>
                {todayLessons.map(l => (
                  <LessonEntry key={l.id} lesson={l} compositions={compositions} onPress={() => setDetailLesson(l)} showDate={false} />
                ))}
                {todaySessions.map(s => (
                  <PracticeEntry key={s.id} session={s} compositions={compositions} onPress={() => setDetailSession(s)} showDate={false} />
                ))}
              </View>
            ) : (
              <View>
                <Text style={{ fontFamily: 'LibreBaskerville-Italic', fontSize: 15, color: COLOURS.textDim }}>No session logged yet.</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <TouchableOpacity onPress={() => setLogModalDate(today)} activeOpacity={0.8}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)', shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:3}, shadowOpacity:1, shadowRadius:10, elevation:3 }}>
                    <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 13, color: '#8A1010' }}>🎹 Log practice</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setLessonModalDate(today)} activeOpacity={0.8}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)', shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:3}, shadowOpacity:1, shadowRadius:10, elevation:3 }}>
                    <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 13, color: '#7A3A00' }}>🎓 Log lesson</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Feed */}
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
