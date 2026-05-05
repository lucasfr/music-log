import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS } from '../theme';
import { LogModal } from '../components/LogModal';
import { SessionDetailModal } from '../components/SessionDetailModal';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const ENERGY_LABELS = { '-2': 'Very low', '-1': 'Low', '0': 'Neutral', '1': 'Good', '2': 'High' };

function todayISO() { return new Date().toISOString().slice(0, 10); }

function calendarDays(year, month) {
  // month is 0-indexed
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Shift so week starts Monday: Sun becomes 6, Mon becomes 0
  const offset = (firstDay + 6) % 7;
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function isoFor(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Energy → dot colour
function energyDotColour(energy) {
  if (energy >= 1)  return COLOURS.navy;
  if (energy === 0) return COLOURS.steel;
  return 'rgba(101,148,177,0.45)';
}

export default function HomeScreen({ sessions, compositions, onSave, onDelete }) {
  const today = todayISO();
  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [logModalDate,    setLogModalDate]    = useState(null);
  const [detailSession,   setDetailSession]   = useState(null);

  // Build a date → session map
  const sessionMap = useMemo(() => {
    const m = {};
    sessions.forEach(s => { m[s.date] = s; });
    return m;
  }, [sessions]);

  const todaySession = sessionMap[today];
  const cells = calendarDays(viewYear, viewMonth);

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

  // Today's pieces for the summary card
  const todayPieces = todaySession
    ? [...new Set((todaySession.segments || [])
        .filter(s => s.type === 'repertoire')
        .map(s => s.compositionId
          ? (compositions.find(c => c.id === s.compositionId) || {}).title || s.title
          : s.title
        ).filter(Boolean)
      )]
    : [];

  const todayTech = todaySession
    ? (todaySession.segments || []).filter(s => s.type === 'technique').map(s => s.group || s.title).filter(Boolean)
    : [];

  const W = Dimensions.get('window').width;
  const cellSize = Math.floor((Math.min(W, 520) - 32 - 24) / 7); // 16px padding each side, 12px card padding each side

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, marginTop: 4 }}>
          <View>
            <Text style={{ fontFamily: 'LibreBaskerville-Italic', fontSize: 26, color: COLOURS.text, letterSpacing: -0.5 }}>music.log</Text>
            <Text style={{ fontFamily: 'SourceSans3', fontSize: 13, color: COLOURS.textDim, marginTop: 2 }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
        </View>

        {/* Today's summary card */}
        <BlurView intensity={36} tint="light" style={{
          borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLOURS.glassBorder,
          overflow: 'hidden', marginBottom: 20,
          shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16, elevation: 4,
        }}>
          <View style={{ backgroundColor: COLOURS.glass, padding: 16 }}>
            {todaySession ? (
              <TouchableOpacity activeOpacity={0.8} onPress={() => setDetailSession(todaySession)}>
                <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Today</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: todayPieces.length || todayTech.length ? 12 : 0 }}>
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
                {todayTech.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
                    {todayTech.map(t => (
                      <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLOURS.accent2Light, borderRadius: RADIUS.pill }}>
                        <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: COLOURS.navy }}>{t}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {todayPieces.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                    {todayPieces.map(p => (
                      <View key={p} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLOURS.accentLight, borderRadius: RADIUS.pill }}>
                        <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: COLOURS.navy }}>{p}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            ) : (
              <View>
                <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Today</Text>
                <Text style={{ fontFamily: 'LibreBaskerville-Italic', fontSize: 15, color: COLOURS.textDim }}>No session logged yet.</Text>
                <TouchableOpacity
                  onPress={() => setLogModalDate(today)}
                  activeOpacity={0.8}
                  style={{ marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navy }}
                >
                  <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 13, color: '#fff' }}>Log today</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </BlurView>

        {/* Calendar */}
        <BlurView intensity={32} tint="light" style={{
          borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLOURS.glassBorder,
          overflow: 'hidden',
          shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 14, elevation: 4,
        }}>
          <View style={{ backgroundColor: COLOURS.glass, padding: 12 }}>

            {/* Month nav */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingHorizontal: 4 }}>
              <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 18, color: COLOURS.navy, fontWeight: '300' }}>‹</Text>
              </TouchableOpacity>
              <Text style={{ fontFamily: 'LibreBaskerville', fontSize: 16, color: COLOURS.text }}>
                {MONTHS[viewMonth]} {viewYear}
              </Text>
              <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 18, color: COLOURS.navy, fontWeight: '300' }}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Day-of-week headers */}
            <View style={{ flexDirection: 'row', marginBottom: 6 }}>
              {DAYS.map((d, i) => (
                <View key={i} style={{ width: cellSize, alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 11, color: COLOURS.textDim }}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Grid */}
            {Array.from({ length: cells.length / 7 }, (_, row) => (
              <View key={row} style={{ flexDirection: 'row', marginBottom: 4 }}>
                {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                  if (!day) return <View key={col} style={{ width: cellSize, height: cellSize }} />;
                  const iso = isoFor(viewYear, viewMonth, day);
                  const session = sessionMap[iso];
                  const isToday = iso === today;
                  const isFuture = iso > today;

                  return (
                    <TouchableOpacity
                      key={col}
                      onPress={() => !isFuture && handleDayPress(day)}
                      activeOpacity={isFuture ? 1 : 0.7}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
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
                      {/* Practiced fill */}
                      {session && (
                        <View style={{
                          position: 'absolute',
                          width: cellSize - 8,
                          height: cellSize - 8,
                          borderRadius: (cellSize - 8) / 2,
                          backgroundColor: energyDotColour(session.energy),
                          opacity: 0.18,
                        }} />
                      )}
                      <Text style={{
                        fontFamily: isToday ? 'SourceSans3-Bold' : 'SourceSans3',
                        fontSize: 14,
                        color: isFuture ? COLOURS.textDim : isToday ? COLOURS.navy : COLOURS.text,
                      }}>
                        {day}
                      </Text>
                      {/* Practice dot */}
                      {session && (
                        <View style={{
                          position: 'absolute',
                          bottom: 3,
                          width: 4,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: energyDotColour(session.energy),
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
          style={{
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: COLOURS.navy,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 28, color: '#fff', lineHeight: 32, marginTop: -2 }}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Log modal */}
      <LogModal
        visible={!!logModalDate}
        initialDate={logModalDate || ''}
        compositions={compositions}
        onSave={s => { onSave(s); setLogModalDate(null); }}
        onClose={() => setLogModalDate(null)}
      />

      {/* Session detail modal */}
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
