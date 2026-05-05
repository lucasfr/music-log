import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Dimensions, Platform, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS } from '../theme';
import { LogModal } from '../components/LogModal';
import { LessonModal } from '../components/LessonModal';
import { SessionDetailModal } from '../components/SessionDetailModal';
import { LessonDetailModal } from '../components/LessonDetailModal';

const DAYS   = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function todayISO() { return new Date().toISOString().slice(0, 10); }

function isoFor(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function calendarDays(year, month) {
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (firstDay + 6) % 7;
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function currentStreak(sessions) {
  const dateSet = new Set(sessions.map(s => s.date));
  let count = 0;
  const d = new Date();
  while (true) {
    const iso = d.toISOString().slice(0, 10);
    if (!dateSet.has(iso)) break;
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

// Energy 1–5 → opacity 0.25..1.0
function energyOpacity(energy) {
  // energy stored as -2..+2, convert to 1..5
  const bar = (energy ?? 0) + 3;
  return 0.20 + (bar / 5) * 0.80;
}

const ind = StyleSheet.create({
  wrap:   { flexDirection: 'row', justifyContent: 'center', gap: 1, marginTop: 1 },
  emoji:  { fontSize: 9, lineHeight: 12 },
  dotRow: { flexDirection: 'row', gap: 3, position: 'absolute', top: 3, alignSelf: 'center' },
  dot:    { width: 4, height: 4, borderRadius: 2 },
});

// ─── Day indicators (BearWithMe style) ────────────────────────────────────────
// Dots above the number (practice = red, lesson = amber)
// Emojis below: ⚡ at energy opacity, ❤️ at enjoyment opacity, 🎓 for lessons

function DayIndicators({ sessions, lessons }) {
  const hasPractice = sessions.length > 0;
  const hasLesson   = lessons.length > 0;

  const maxEnergy    = hasPractice ? Math.max(...sessions.map(s => (s.energy ?? 0) + 3)) : 0;
  const avgEnjoyment = hasPractice
    ? sessions.filter(s => s.enjoyment).reduce((a, s, _, arr) => a + s.enjoyment / arr.length, 0)
    : 0;

  if (!hasPractice && !hasLesson) return null;

  return (
    <View style={ind.wrap}>
      {hasPractice && (
        <Text style={[ind.emoji, { opacity: energyOpacity(sessions[0].energy) }]}>⚡</Text>
      )}
      {hasPractice && avgEnjoyment > 0 && (
        <Text style={[ind.emoji, { opacity: 0.25 + (avgEnjoyment / 5) * 0.75 }]}>❤️</Text>
      )}
    </View>
  );
}

function DayDots({ hasPractice, hasLesson }) {
  if (!hasPractice && !hasLesson) return null;
  return (
    <View style={ind.dotRow}>
      {hasPractice && <View style={[ind.dot, { backgroundColor: COLOURS.red }]} />}
      {hasLesson   && <View style={[ind.dot, { backgroundColor: COLOURS.amber }]} />}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CalendarScreen({ sessions, lessons, compositions, onSave, onSaveLesson, onDelete, onDeleteLesson }) {
  const today = todayISO();
  const now   = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [logModalDate,    setLogModalDate]    = useState(null);
  const [lessonModalDate, setLessonModalDate] = useState(null);
  const [detailSession,   setDetailSession]   = useState(null);
  const [detailLesson,    setDetailLesson]    = useState(null);

  // Index sessions and lessons by date (multiple per day)
  const sessionsByDate = useMemo(() => {
    const m = {};
    sessions.forEach(s => { if (!m[s.date]) m[s.date] = []; m[s.date].push(s); });
    return m;
  }, [sessions]);

  const lessonsByDate = useMemo(() => {
    const m = {};
    (lessons || []).forEach(l => { if (!m[l.date]) m[l.date] = []; m[l.date].push(l); });
    return m;
  }, [lessons]);

  const cells  = calendarDays(viewYear, viewMonth);
  const streak = currentStreak(sessions);

  const monthPrefix   = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const monthSessions = sessions.filter(s => s.date.startsWith(monthPrefix));
  const monthLessons  = (lessons || []).filter(l => l.date.startsWith(monthPrefix));

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function handleDayPress(day) {
    const iso      = isoFor(viewYear, viewMonth, day);
    const dayLessons  = lessonsByDate[iso]  || [];
    const daySessions = sessionsByDate[iso] || [];
    if (dayLessons.length === 1 && daySessions.length === 0) {
      setDetailLesson(dayLessons[0]);
    } else if (daySessions.length === 1 && dayLessons.length === 0) {
      setDetailSession(daySessions[0]);
    } else if (dayLessons.length === 0 && daySessions.length === 0) {
      setLogModalDate(iso);
    }
    // multiple entries: for now open the first — could show a picker in future
    else if (dayLessons.length > 0) {
      setDetailLesson(dayLessons[0]);
    } else {
      setDetailSession(daySessions[0]);
    }
  }

  const W        = Dimensions.get('window').width;
  const cellSize = Math.floor((Math.min(W, 520) - 32) / 7);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, marginTop: 4 }}>
          <Text style={{ fontFamily: 'LibreBaskerville-Italic', fontSize: 22, color: COLOURS.text, letterSpacing: -0.3 }}>Calendar</Text>
          {streak > 0 && (
            <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)', shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:3}, shadowOpacity:1, shadowRadius:10, elevation:4 }}>
              <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 12, color: COLOURS.navy }}>{streak} day streak 🔥</Text>
            </View>
          )}
        </View>

        {/* Month stats */}
        {(monthSessions.length > 0 || monthLessons.length > 0) && (
          <BlurView intensity={36} tint="light" style={{
            borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 16,
            shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 14, elevation: 4,
          }}>
            <View style={{ backgroundColor: COLOURS.glass, padding: 12, flexDirection: 'row' }}>
              {[
                { value: monthSessions.length, label: 'sessions' },
                { value: monthLessons.length,  label: 'lessons' },
                { value: `${Math.round(monthSessions.reduce((a, s) => a + (Number(s.duration) || 0), 0))}m`, label: 'practice' },
                { value: monthSessions.length
                    ? (monthSessions.reduce((a, s) => a + Number(s.energy), 0) / monthSessions.length).toFixed(1)
                    : '—', label: 'avg ⚡' },
              ].map((stat, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center', borderRightWidth: i < 3 ? 1 : 0, borderRightColor: COLOURS.glassBorderSubtle }}>
                  <Text style={{ fontFamily: 'LibreBaskerville', fontSize: 20, color: COLOURS.navy }}>{stat.value}</Text>
                  <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: COLOURS.textDim, marginTop: 1 }}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </BlurView>
        )}

        {/* Calendar grid */}
        <BlurView intensity={32} tint="light" style={{
          borderRadius: RADIUS.md, overflow: 'hidden',
          shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 20, elevation: 6,
        }}>
          <View style={{ backgroundColor: COLOURS.glass, padding: 12 }}>

            {/* Nav */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 4 }}>
              <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={{ fontSize: 24, color: COLOURS.navy, fontWeight: '300', lineHeight: 28 }}>‹</Text>
              </TouchableOpacity>
              <Text style={{ fontFamily: 'LibreBaskerville', fontSize: 17, color: COLOURS.text }}>
                {MONTHS[viewMonth]} {viewYear}
              </Text>
              <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={{ fontSize: 24, color: COLOURS.navy, fontWeight: '300', lineHeight: 28 }}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Day headers */}
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              {DAYS.map((d, i) => (
                <View key={i} style={{ width: cellSize, alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 10, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6 }}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Grid */}
            {Array.from({ length: cells.length / 7 }, (_, row) => (
              <View key={row} style={{ flexDirection: 'row' }}>
                {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                  if (!day) return <View key={col} style={{ width: cellSize, height: cellSize + 18 }} />;

                  const iso        = isoFor(viewYear, viewMonth, day);
                  const daySessions = sessionsByDate[iso] || [];
                  const dayLessons  = lessonsByDate[iso]  || [];
                  const isToday    = iso === today;
                  const isFuture   = iso > today;
                  const hasData    = daySessions.length > 0 || dayLessons.length > 0;

                  return (
                    <TouchableOpacity
                      key={col}
                      onPress={() => !isFuture && handleDayPress(day)}
                      activeOpacity={isFuture ? 1 : 0.7}
                      style={{
                        width: cellSize,
                        height: cellSize + 18,
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        paddingTop: 10,
                        borderRadius: RADIUS.sm,
                        position: 'relative',
                        backgroundColor: isToday ? 'rgba(9,99,126,0.08)' : 'transparent',
                      }}
                    >
                      {/* Dots above number */}
                      <DayDots hasPractice={daySessions.length > 0} hasLesson={dayLessons.length > 0} />

                      {/* Day number */}
                      <Text style={{
                        fontFamily: isToday ? 'SourceSans3-Bold' : 'SourceSans3',
                        fontSize: 14,
                        color: isFuture ? COLOURS.textDim
                          : isToday ? COLOURS.navy
                          : hasData  ? COLOURS.text
                          : COLOURS.textMuted,
                      }}>
                        {day}
                      </Text>

                      {/* Score numbers below day */}
                      {daySessions.length > 0 && (() => {
                        const e = daySessions[0].energy;
                        const joy = daySessions[0].enjoyment;
                        return (
                          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                            <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 8, color: COLOURS.red, opacity: energyOpacity(e), lineHeight: 10 }}>
                              {e > 0 ? `+${e}` : e}
                            </Text>
                            {joy ? (
                              <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 8, color: '#8A2A50', opacity: 0.25 + (joy / 5) * 0.75, lineHeight: 10 }}>
                                {joy}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })()}

                      {/* Indicators below number */}
                      <DayIndicators sessions={daySessions} lessons={dayLessons} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </BlurView>

        {/* Legend */}
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 12, paddingHorizontal: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLOURS.red }} />
            <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: COLOURS.textDim }}>Practice</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLOURS.amber }} />
            <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: COLOURS.textDim }}>Lesson</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 10, color: COLOURS.red }}>+1</Text>
            <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: COLOURS.textDim }}>Energy score</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ fontSize: 10 }}>❤️</Text>
            <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: COLOURS.textDim }}>Enjoyment</Text>
          </View>
        </View>

      </ScrollView>

      {/* FAB */}
      <View style={{ position: 'absolute', bottom: Platform.OS === 'ios' ? 100 : 80, right: 20 }}>
        <TouchableOpacity
          onPress={() => setLogModalDate(today)}
          activeOpacity={0.85}
          style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,255,255,0.58)', alignItems: 'center', justifyContent: 'center', shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 16, elevation: 8 }}
        >
          <Text style={{ fontSize: 28, color: COLOURS.text, lineHeight: 32, marginTop: -2 }}>+</Text>
        </TouchableOpacity>
      </View>

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
