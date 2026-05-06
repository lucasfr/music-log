import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Dimensions, Platform, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, SIZES } from '../theme';
import { LogModal } from '../components/LogModal';
import { LessonModal } from '../components/LessonModal';
import { SessionDetailModal } from '../components/SessionDetailModal';
import { LessonDetailModal } from '../components/LessonDetailModal';
import { fmtDate } from '../utils';

const DAYS   = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
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
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!dateSet.has(iso)) break;
    count++; d.setDate(d.getDate() - 1);
  }
  return count;
}
function energyOpacity(energy) {
  const bar = (energy ?? 0) + 3;
  return 0.20 + (bar / 5) * 0.80;
}

const ind = StyleSheet.create({
  wrap:   { flexDirection: 'row', justifyContent: 'center', gap: 2, marginTop: 1 },
  emoji:  { fontSize: 11, lineHeight: 13 },
  dotRow: { flexDirection: 'row', gap: 3, position: 'absolute', top: 2, alignSelf: 'center' },
  dot:    { width: 5, height: 5, borderRadius: 3 },
});

function DayIndicators({ sessions }) {
  const hasPractice  = sessions.length > 0;
  const avgEnjoyment = hasPractice
    ? sessions.filter(s => s.enjoyment).reduce((a, s, _, arr) => a + s.enjoyment / arr.length, 0)
    : 0;
  if (!hasPractice) return null;
  return (
    <View style={ind.wrap}>
      <Text style={[ind.emoji, { opacity: energyOpacity(sessions[0].energy) }]}>⚡</Text>
      {avgEnjoyment > 0 && (
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

function FAB({ onPractice, onLesson }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={{ position: 'absolute', bottom: Platform.OS === 'ios' ? 140 : 120, right: 20, alignItems: 'flex-end', gap: 10 }}>
      {expanded && (
        <>
          <TouchableOpacity onPress={() => { setExpanded(false); onLesson(); }} activeOpacity={0.85}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.50)', shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 4 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.lessonText }}>🎓 Log lesson</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setExpanded(false); onPractice(); }} activeOpacity={0.85}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.50)', shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 4 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.practiceText }}>🎹 Log practice</Text>
          </TouchableOpacity>
        </>
      )}
      <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.85}
        style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,255,255,0.58)', alignItems: 'center', justifyContent: 'center', shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 16, elevation: 8 }}>
        <Text style={{ fontSize: expanded ? 22 : 28, color: COLOURS.text, lineHeight: 32, marginTop: -2 }}>
          {expanded ? '✕' : '+'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Calendar grid component ──────────────────────────────────────────────────

function CalendarGrid({ sessions, lessons, viewYear, viewMonth, today, cellW, cellH, onDayPress, selectedDate }) {
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

  const cells = calendarDays(viewYear, viewMonth);
  const monthPrefix   = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const monthSessions = sessions.filter(s => s.date.startsWith(monthPrefix));
  const monthLessons  = (lessons || []).filter(l => l.date.startsWith(monthPrefix));
  const streak = currentStreak(sessions);

  return (
    <View>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, marginTop: 4 }}>
        <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 22, color: COLOURS.text, letterSpacing: -0.3 }}>📅 Calendar</Text>
        {streak > 0 && (
          <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)', shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:3}, shadowOpacity:1, shadowRadius:10, elevation:4 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.navy }}>{streak} day streak 🔥</Text>
          </View>
        )}
      </View>

      {/* Month stats */}
      {(monthSessions.length > 0 || monthLessons.length > 0) && (
        <BlurView intensity={36} tint="light" style={{ borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 16, shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 14, elevation: 4 }}>
          <View style={{ backgroundColor: COLOURS.glass, padding: 12, flexDirection: 'row' }}>
            {[
              { value: monthSessions.length, label: '🎹 sessions' },
              { value: monthLessons.length,  label: '🎓 lessons' },
              { value: `${Math.round(monthSessions.reduce((a, s) => a + (Number(s.duration) || 0), 0))}m`, label: '⏱ practice' },
              { value: monthSessions.length ? (monthSessions.reduce((a, s) => a + Number(s.energy), 0) / monthSessions.length).toFixed(1) : '—', label: '⚡ avg energy' },
            ].map((stat, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', borderRightWidth: i < 3 ? 1 : 0, borderRightColor: COLOURS.glassBorderSubtle }}>
                <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 20, color: COLOURS.navy }}>{stat.value}</Text>
                <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim, marginTop: 1 }}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </BlurView>
      )}

      {/* Calendar grid */}
      <BlurView intensity={32} tint="light" style={{ borderRadius: RADIUS.md, overflow: 'hidden', shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 20, elevation: 6 }}>
        <View style={{ backgroundColor: COLOURS.glass, padding: 12 }}>
          {/* Day headers */}
          <View style={{ flexDirection: 'row', marginBottom: 4 }}>
            {DAYS.map((d, i) => (
              <View key={i} style={{ width: cellW, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.tiny + 1, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6 }}>{d}</Text>
              </View>
            ))}
          </View>
          {/* Grid */}
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <View key={row} style={{ flexDirection: 'row' }}>
              {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                if (!day) return <View key={col} style={{ width: cellW, height: cellH }} />;
                const iso         = isoFor(viewYear, viewMonth, day);
                const daySessions = sessionsByDate[iso] || [];
                const dayLessons  = lessonsByDate[iso]  || [];
                const isToday     = iso === today;
                const isFuture    = iso > today;
                const hasData     = daySessions.length > 0 || dayLessons.length > 0;
                const isSelected  = iso === selectedDate;
                return (
                  <TouchableOpacity key={col} onPress={() => !isFuture && onDayPress(day, iso)}
                    activeOpacity={isFuture ? 1 : 0.7}
                    style={{ width: cellW, height: cellH, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 8, borderRadius: RADIUS.sm, position: 'relative',
                      backgroundColor: isSelected ? 'rgba(9,99,126,0.15)' : isToday ? 'rgba(9,99,126,0.08)' : 'transparent' }}>
                    <DayDots hasPractice={daySessions.length > 0} hasLesson={dayLessons.length > 0} />
                    <Text style={{ fontFamily: isToday ? 'Lato-Bold' : 'Lato', fontSize: SIZES.body,
                      color: isFuture ? COLOURS.textDim : isToday ? COLOURS.navy : hasData ? COLOURS.text : COLOURS.textMuted }}>
                      {day}
                    </Text>
                    {daySessions.length > 0 && (() => {
                      const e = daySessions[0].energy;
                      const joy = daySessions[0].enjoyment;
                      return (
                        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.red, opacity: energyOpacity(e), lineHeight: SIZES.label + 2 }}>
                            {e > 0 ? `+${e}` : e}
                          </Text>
                          {joy ? <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: '#8A2A50', opacity: 0.25 + (joy / 5) * 0.75, lineHeight: SIZES.label + 2 }}>{joy}</Text> : null}
                        </View>
                      );
                    })()}
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
        {[
          { dot: COLOURS.practiceText, label: 'Practice' },
          { dot: COLOURS.lessonText,   label: 'Lesson' },
        ].map(({ dot, label }) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} />
            <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim }}>{label}</Text>
          </View>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text style={{ fontSize: 10 }}>⚡</Text>
          <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim }}>Energy</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text style={{ fontSize: 10 }}>❤️</Text>
          <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim }}>Enjoyment</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CalendarScreen({ sessions, lessons, compositions, onSave, onSaveLesson, onDelete, onDeleteLesson, isDesktop }) {
  const today = todayISO();
  const now   = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [logModalDate,    setLogModalDate]    = useState(null);
  const [lessonModalDate, setLessonModalDate] = useState(null);
  const [detailSession,   setDetailSession]   = useState(null);
  const [detailLesson,    setDetailLesson]    = useState(null);
  const [selectedDate,    setSelectedDate]    = useState(null);

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

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function handleDayPress(day, iso) {
    const dayLessons  = lessonsByDate[iso]  || [];
    const daySessions = sessionsByDate[iso] || [];

    if (isDesktop) {
      setSelectedDate(iso);
      return;
    }
    if (dayLessons.length === 1 && daySessions.length === 0)      setDetailLesson(dayLessons[0]);
    else if (daySessions.length === 1 && dayLessons.length === 0) setDetailSession(daySessions[0]);
    else if (dayLessons.length === 0 && daySessions.length === 0) setLogModalDate(iso);
    else if (dayLessons.length > 0)                               setDetailLesson(dayLessons[0]);
    else                                                          setDetailSession(daySessions[0]);
  }

  const W     = isDesktop ? 380 : Dimensions.get('window').width;
  const cellW = Math.floor((Math.min(W, 520) - 32) / 7);
  const cellH = 58;

  // Nav bar rendered above the grid
  const navBar = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 4, paddingVertical: 8 }}>
      <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Text style={{ fontSize: 30, color: COLOURS.navy, fontWeight: '300', lineHeight: 34 }}>‹</Text>
      </TouchableOpacity>
      <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 20, color: COLOURS.text }}>
        {MONTHS[viewMonth]} {viewYear}
      </Text>
      <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Text style={{ fontSize: 30, color: COLOURS.navy, fontWeight: '300', lineHeight: 34 }}>›</Text>
      </TouchableOpacity>
    </View>
  );

  const modals = (
    <>
      <LogModal visible={!!logModalDate} initialDate={logModalDate || ''} compositions={compositions}
        onSave={s => { onSave(s); setLogModalDate(null); }} onClose={() => setLogModalDate(null)} />
      <LessonModal visible={!!lessonModalDate} initialDate={lessonModalDate || ''} compositions={compositions}
        onSave={l => { onSaveLesson(l); setLessonModalDate(null); }} onClose={() => setLessonModalDate(null)} />
      {!isDesktop && (
        <>
          <SessionDetailModal visible={!!detailSession} session={detailSession} compositions={compositions}
            onClose={() => setDetailSession(null)} onDelete={id => { onDelete(id); setDetailSession(null); }} />
          <LessonDetailModal visible={!!detailLesson} lesson={detailLesson} compositions={compositions}
            onClose={() => setDetailLesson(null)} onDelete={id => { onDeleteLesson(id); setDetailLesson(null); }} />
        </>
      )}
    </>
  );

  // ── Desktop ───────────────────────────────────────────────────────────────
  if (isDesktop) {
    const selSessions = selectedDate ? (sessionsByDate[selectedDate] || []) : [];
    const selLessons  = selectedDate ? (lessonsByDate[selectedDate]  || []) : [];
    const compName    = id => (compositions.find(c => c.id === id) || {}).title || null;

    return (
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* Left: calendar — full height card starting at left edge */}
        <View style={{
          width: 420,
          marginTop: 12,
          marginBottom: 12,
          borderRadius: 20,
          overflow: 'hidden',
          backgroundColor: 'rgba(255,255,255,0.28)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.55)',
          shadowColor: 'rgba(9,99,126,0.12)',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 1,
          shadowRadius: 24,
          elevation: 2,
        }}>
          <ScrollView contentContainerStyle={{ paddingTop: 20, paddingBottom: 40, paddingLeft: 224, paddingRight: 20 }}>
            {navBar}
            <CalendarGrid
              sessions={sessions} lessons={lessons}
              viewYear={viewYear} viewMonth={viewMonth}
              today={today} cellW={cellW} cellH={cellH}
              onDayPress={handleDayPress}
              selectedDate={selectedDate}
            />
          </ScrollView>
          <FAB onPractice={() => setLogModalDate(selectedDate || today)} onLesson={() => setLessonModalDate(selectedDate || today)} />
        </View>

        {/* Right: day detail */}
        <View style={{ flex: 1, marginLeft: 12, marginTop: 12, marginBottom: 12, marginRight: 12 }}>
          {selectedDate ? (
            <ScrollView contentContainerStyle={{ padding: 28, paddingBottom: 48 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 22, color: COLOURS.text }}>{fmtDate(selectedDate)}</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={() => setLogModalDate(selectedDate)} activeOpacity={0.8}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: COLOURS.practiceBg }}>
                    <Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.practiceText }}>🎹 Log practice</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setLessonModalDate(selectedDate)} activeOpacity={0.8}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: COLOURS.lessonBg }}>
                    <Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.lessonText }}>🎓 Log lesson</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {selSessions.length === 0 && selLessons.length === 0 && (
                <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 15, color: COLOURS.textDim }}>No sessions on this day. Use the buttons above to log one.</Text>
              )}
              {selLessons.map(l => (
                <View key={l.id} style={{ padding: 14, backgroundColor: COLOURS.accent2Light, borderRadius: RADIUS.md, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: COLOURS.amber }}>
                  <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.text, marginBottom: 4 }}>🎓 Lesson · {l.duration} min · {l.teacher}</Text>
                  {(l.pieces || []).map((p, i) => { const n = p.compositionId ? compName(p.compositionId) : p.pieceName; return n ? <Text key={i} style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 14, color: COLOURS.textMuted }}>📜 {n}</Text> : null; })}
                  {l.wins ? <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textMuted, marginTop: 6, fontStyle: 'italic' }}>✨ {l.wins}</Text> : null}
                </View>
              ))}
              {selSessions.map(s => {
                const pieces = (s.segments || []).filter(sg => sg.type === 'repertoire').map(sg => sg.compositionId ? compName(sg.compositionId) : sg.title).filter(Boolean);
                return (
                  <View key={s.id} style={{ padding: 14, backgroundColor: COLOURS.accentLight, borderRadius: RADIUS.md, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: COLOURS.red }}>
                    <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.text, marginBottom: 6 }}>🎹 Practice · {s.duration} min</Text>
                    <View style={{ flexDirection: 'row', gap: 4, marginBottom: 6 }}>
                      {[1,2,3,4,5].map(n => <Text key={n} style={{ fontSize: 14, opacity: n <= (s.energy+3) ? 1 : 0.18 }}>⚡</Text>)}
                      {s.enjoyment ? [1,2,3,4,5].map(n => <Text key={`h${n}`} style={{ fontSize: 14, opacity: n <= s.enjoyment ? 1 : 0.18 }}>❤️</Text>) : null}
                    </View>
                    {pieces.map(p => <Text key={p} style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 14, color: COLOURS.textMuted }}>📜 {p}</Text>)}
                    {s.wins ? <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textMuted, marginTop: 6, fontStyle: 'italic' }}>✨ {s.wins}</Text> : null}
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 18, color: COLOURS.textDim, opacity: 0.5 }}>Select a day to view entries</Text>
            </View>
          )}
        </View>
        {modals}
      </View>
    );
  }

  // ── Mobile ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {navBar}
        <CalendarGrid
          sessions={sessions} lessons={lessons}
          viewYear={viewYear} viewMonth={viewMonth}
          today={today} cellW={cellW} cellH={cellH}
          onDayPress={handleDayPress}
          selectedDate={null}
        />
      </ScrollView>
      <FAB onPractice={() => setLogModalDate(today)} onLesson={() => setLessonModalDate(today)} />
      {modals}
    </SafeAreaView>
  );
}
