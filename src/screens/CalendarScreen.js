import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS } from '../theme';
import { LogModal } from '../components/LogModal';
import { SessionDetailModal } from '../components/SessionDetailModal';

const DAYS   = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function todayISO() { return new Date().toISOString().slice(0, 10); }

function calendarDays(year, month) {
  const firstDay   = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (firstDay + 6) % 7; // Mon = 0
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function isoFor(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function energyColour(energy) {
  if (energy >= 1)  return COLOURS.navy;
  if (energy === 0) return COLOURS.steel;
  return 'rgba(101,148,177,0.50)';
}

// Mini streak counter
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

export default function CalendarScreen({ sessions, compositions, onSave, onDelete }) {
  const today = todayISO();
  const now   = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [logModalDate,  setLogModalDate]  = useState(null);
  const [detailSession, setDetailSession] = useState(null);

  const sessionMap = useMemo(() => {
    const m = {};
    sessions.forEach(s => { m[s.date] = s; });
    return m;
  }, [sessions]);

  const cells  = calendarDays(viewYear, viewMonth);
  const streak = currentStreak(sessions);

  // Sessions in this view month
  const monthSessions = sessions.filter(s => {
    const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
    return s.date.startsWith(prefix);
  });

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function handleDayPress(day) {
    const iso = isoFor(viewYear, viewMonth, day);
    const existing = sessionMap[iso];
    if (existing) setDetailSession(existing);
    else setLogModalDate(iso);
  }

  const W        = Dimensions.get('window').width;
  const cellSize = Math.floor((Math.min(W, 520) - 32 - 24) / 7);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* Header row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, marginTop: 4 }}>
          <Text style={{ fontFamily: 'LibreBaskerville-Italic', fontSize: 22, color: COLOURS.text, letterSpacing: -0.3 }}>Calendar</Text>
          {streak > 0 && (
            <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navy }}>
              <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 12, color: '#fff' }}>
                {streak} day streak 🔥
              </Text>
            </View>
          )}
        </View>

        {/* Month stats bar */}
        {monthSessions.length > 0 && (
          <BlurView intensity={28} tint="light" style={{
            borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLOURS.glassBorder,
            overflow: 'hidden', marginBottom: 16,
            shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
          }}>
            <View style={{ backgroundColor: COLOURS.glass, padding: 12, flexDirection: 'row', gap: 0 }}>
              {[
                { value: monthSessions.length, label: 'sessions' },
                { value: `${Math.round(monthSessions.reduce((a, s) => a + (Number(s.duration) || 0), 0))}m`, label: 'practice' },
                { value: (monthSessions.reduce((a, s) => a + Number(s.energy), 0) / monthSessions.length).toFixed(1), label: 'avg energy' },
              ].map((stat, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center', borderRightWidth: i < 2 ? 1 : 0, borderRightColor: COLOURS.glassBorder }}>
                  <Text style={{ fontFamily: 'LibreBaskerville', fontSize: 22, color: COLOURS.navy }}>{stat.value}</Text>
                  <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: COLOURS.textDim, marginTop: 1 }}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </BlurView>
        )}

        {/* Calendar grid */}
        <BlurView intensity={32} tint="light" style={{
          borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLOURS.glassBorder,
          overflow: 'hidden',
          shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 14, elevation: 4,
        }}>
          <View style={{ backgroundColor: COLOURS.glass, padding: 12 }}>

            {/* Month nav */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 4 }}>
              <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={{ fontSize: 22, color: COLOURS.navy, fontWeight: '300' }}>‹</Text>
              </TouchableOpacity>
              <Text style={{ fontFamily: 'LibreBaskerville', fontSize: 17, color: COLOURS.text }}>
                {MONTHS[viewMonth]} {viewYear}
              </Text>
              <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={{ fontSize: 22, color: COLOURS.navy, fontWeight: '300' }}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Day headers */}
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              {DAYS.map((d, i) => (
                <View key={i} style={{ width: cellSize, alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 11, color: COLOURS.textDim }}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Grid rows */}
            {Array.from({ length: cells.length / 7 }, (_, row) => (
              <View key={row} style={{ flexDirection: 'row', marginBottom: 2 }}>
                {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                  if (!day) return <View key={col} style={{ width: cellSize, height: cellSize + 6 }} />;

                  const iso      = isoFor(viewYear, viewMonth, day);
                  const session  = sessionMap[iso];
                  const isToday  = iso === today;
                  const isFuture = iso > today;
                  const colour   = session ? energyColour(session.energy) : null;

                  return (
                    <TouchableOpacity
                      key={col}
                      onPress={() => !isFuture && handleDayPress(day)}
                      activeOpacity={isFuture ? 1 : 0.7}
                      style={{ width: cellSize, height: cellSize + 6, alignItems: 'center', justifyContent: 'center' }}
                    >
                      {/* Practiced fill */}
                      {session && (
                        <View style={{
                          position: 'absolute',
                          width: cellSize - 6,
                          height: cellSize - 6,
                          borderRadius: (cellSize - 6) / 2,
                          backgroundColor: colour,
                          opacity: 0.15,
                        }} />
                      )}
                      {/* Today ring */}
                      {isToday && (
                        <View style={{
                          position: 'absolute',
                          width: cellSize - 4,
                          height: cellSize - 4,
                          borderRadius: (cellSize - 4) / 2,
                          borderWidth: 1.5,
                          borderColor: COLOURS.navy,
                        }} />
                      )}

                      <Text style={{
                        fontFamily: isToday ? 'SourceSans3-Bold' : 'SourceSans3',
                        fontSize: 14,
                        color: isFuture ? COLOURS.textDim : isToday ? COLOURS.navy : session ? COLOURS.navy : COLOURS.text,
                      }}>
                        {day}
                      </Text>

                      {/* Dot */}
                      {session && (
                        <View style={{
                          position: 'absolute', bottom: 2,
                          width: 4, height: 4, borderRadius: 2,
                          backgroundColor: colour,
                        }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </BlurView>

      </ScrollView>

      {/* FAB */}
      <View style={{
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 100 : 80,
        right: 20,
        shadowColor: COLOURS.navy,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.40,
        shadowRadius: 16,
        elevation: 8,
      }}>
        <TouchableOpacity
          onPress={() => setLogModalDate(today)}
          activeOpacity={0.85}
          style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: COLOURS.navy, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 28, color: '#fff', lineHeight: 32, marginTop: -2 }}>+</Text>
        </TouchableOpacity>
      </View>

      <LogModal
        visible={!!logModalDate}
        initialDate={logModalDate || ''}
        compositions={compositions}
        onSave={s => { onSave(s); setLogModalDate(null); }}
        onClose={() => setLogModalDate(null)}
      />

      <SessionDetailModal
        visible={!!detailSession}
        session={detailSession}
        compositions={compositions}
        onClose={() => setDetailSession(null)}
        onDelete={id => { onDelete(id); setDetailSession(null); }}
      />
    </SafeAreaView>
  );
}
