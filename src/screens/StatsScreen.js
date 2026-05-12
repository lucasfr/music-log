import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS } from '../theme';
import { GlassCard, SectionTitle } from '../components/UI';
import { STATUS_OPTIONS } from '../constants';

const STATUS_TEXT_COLOURS = {
  learning:            COLOURS.steel,
  consolidating:       '#7A4FA0',
  'performance-ready': COLOURS.success,
};

// ─── Activity grid (Jan–Dec calendar year) ──────────────────────────────────

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS   = ['M','T','W','T','F','S','S'];
const GAP = 2;

function cellColor(duration) {
  if (!duration)      return null; // empty — handled by caller
  if (duration < 20)  return 'rgba(140,32,69,0.25)';
  if (duration < 40)  return 'rgba(140,32,69,0.50)';
  if (duration < 60)  return 'rgba(140,32,69,0.75)';
  return '#8C2045';
}

function buildYear(year, dateMap) {
  // Returns array of 12 months, each an array of weeks, each an array of 7 days (Mon–Sun)
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const months = [];

  for (let m = 0; m < 12; m++) {
    const firstDay = new Date(year, m, 1);
    const lastDay  = new Date(year, m + 1, 0);
    // offset so week starts on Monday
    const startOffset = (firstDay.getDay() + 6) % 7;
    const weeks = [];
    let week = Array(startOffset).fill(null);

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, m, d);
      const iso  = date.toISOString().slice(0, 10);
      const isFuture = iso > todayISO;
      week.push({ iso, duration: isFuture ? -1 : (dateMap[iso] || 0), isFuture });
      if (week.length === 7) { weeks.push(week); week = []; }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    months.push(weeks);
  }
  return months;
}

function ActivityGrid({ sessions }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [width, setWidth] = useState(0);

  const dateMap = {};
  sessions.forEach(s => {
    dateMap[s.date] = (dateMap[s.date] || 0) + (Number(s.duration) || 0);
  });

  const months = buildYear(year, dateMap);

  // Cell size: fit 12 months × (max 6 weeks) + 11 gaps between months into width
  // Each month takes (weeks * (cell+GAP) - GAP), but we size by max weeks = 6
  // Total = 12 * (6*cell + 5*GAP) + 11 * monthGap
  const MONTH_GAP = 6;
  const maxWeeks  = 6;
  // cell = (width - 11*MONTH_GAP - 12*(5*GAP)) / (12 * 6)
  const cell = width > 0
    ? Math.max(4, Math.floor((width - 11 * MONTH_GAP - 12 * 5 * GAP) / (12 * maxWeeks)))
    : 11;

  const totalHeight = 7 * (cell + GAP) - GAP;
  const dayLabelW   = cell + 2;

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {/* Year picker */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 18, color: COLOURS.text }}>{year}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableYear onPress={() => setYear(y => y - 1)} label={‹} />
          {year < currentYear && <TouchableYear onPress={() => setYear(y => y + 1)} label={›} />}
        </View>
      </View>

      {width > 0 && (
        <View style={{ flexDirection: 'row', gap: MONTH_GAP }}>
          {months.map((weeks, mi) => {
            const monthW = weeks.length * (cell + GAP) - GAP;
            return (
              <View key={mi} style={{ width: monthW }}>
                {/* Month label */}
                <Text style={{
                  fontFamily: 'Lato-Bold', fontSize: Math.max(7, cell - 2),
                  color: COLOURS.textDim, letterSpacing: 0.2,
                  marginBottom: 4, textAlign: 'center',
                }}>{MONTHS_SHORT[mi]}</Text>

                {/* Week columns */}
                <View style={{ flexDirection: 'row', gap: GAP }}>
                  {weeks.map((week, wi) => (
                    <View key={wi} style={{ gap: GAP }}>
                      {week.map((day, di) => {
                        if (!day) return <View key={di} style={{ width: cell, height: cell }} />;
                        const color = day.isFuture
                          ? 'rgba(0,0,0,0.05)'
                          : cellColor(day.duration) || 'rgba(140,32,69,0.07)';
                        const isToday = day.iso === new Date().toISOString().slice(0, 10);
                        return (
                          <View key={di} style={{
                            width: cell, height: cell,
                            borderRadius: Math.max(1, cell * 0.2),
                            backgroundColor: color,
                            borderWidth: isToday ? 1 : 0,
                            borderColor: COLOURS.navy,
                          }} />
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Legend */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, justifyContent: 'flex-end' }}>
        <Text style={{ fontFamily: 'Lato', fontSize: 9, color: COLOURS.textDim, marginRight: 2 }}>Less</Text>
        {[0, 15, 35, 55, 75].map(d => (
          <View key={d} style={{
            width: cell, height: cell,
            borderRadius: Math.max(1, cell * 0.2),
            backgroundColor: d === 0 ? 'rgba(140,32,69,0.07)' : cellColor(d),
          }} />
        ))}
        <Text style={{ fontFamily: 'Lato', fontSize: 9, color: COLOURS.textDim, marginLeft: 2 }}>More</Text>
      </View>
    </View>
  );
}

function TouchableYear({ onPress, label }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}
      style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)' }}>
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.navy }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function StatsScreen({ sessions, compositions, isDesktop }) {

  const last30 = sessions.filter(s => {
    const d = new Date(s.date + 'T12:00:00');
    const ago = new Date(); ago.setDate(ago.getDate() - 30);
    return d >= ago;
  });

  const totalMin = last30.reduce((a, s) => a + (Number(s.duration) || 0), 0);
  const allTimeMin = sessions.reduce((a, s) => a + (Number(s.duration) || 0), 0);
  const avgEnergy = last30.length
    ? (last30.reduce((a, s) => a + Number(s.energy), 0) / last30.length).toFixed(1)
    : '—';

  const streak = (() => {
    let count = 0, d = new Date();
    const dateSet = new Set(sessions.map(s => s.date));
    while (true) {
      const iso = d.toISOString().slice(0, 10);
      if (!dateSet.has(iso)) break;
      count++; d.setDate(d.getDate() - 1);
    }
    return count;
  })();

  const pieceFreq = {};
  const pieceEnjoyment = {};
  const pieceMinutes = {};
  last30.forEach(s => {
    (s.segments || []).forEach(seg => {
      if (seg.type !== 'repertoire') return;
      const name = seg.compositionId
        ? (compositions.find(c => c.id === seg.compositionId) || {}).title || seg.compositionId
        : seg.title;
      if (!name) return;
      pieceFreq[name] = (pieceFreq[name] || 0) + 1;
      pieceMinutes[name] = (pieceMinutes[name] || 0) + (Number(seg.duration) || 0);
      if (seg.liking) {
        if (!pieceEnjoyment[name]) pieceEnjoyment[name] = [];
        pieceEnjoyment[name].push(seg.liking);
      }
    });
  });
  const topPieces = Object.entries(pieceFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => {
      const joys = pieceEnjoyment[name] || [];
      const avgLiking = joys.length ? joys.reduce((a, v) => a + v, 0) / joys.length : null;
      const mins = pieceMinutes[name] || 0;
      return { name, count, avgLiking, mins };
    });

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    const iso = d.toISOString().slice(0, 10);
    const s = sessions.find(s => s.date === iso);
    return {
      iso,
      label: d.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 1),
      duration: s ? (Number(s.duration) || 30) : 0,
      practiced: !!s,
    };
  });
  const maxDur = Math.max(...last14.map(d => d.duration), 1);
  const barH = 72;

  const statItems = [
    { value: allTimeMin >= 60 ? `${Math.floor(allTimeMin / 60)}h ${allTimeMin % 60}m` : `${Math.round(allTimeMin)}m`, label: 'total practice', emoji: '⏱' },
    { value: last30.length,        label: 'sessions (30d)',      emoji: '🎹' },
    { value: streak,               label: 'day streak',          emoji: '🔥' },
    { value: Number(avgEnergy) > 0 ? `+${avgEnergy}` : avgEnergy, label: 'avg energy (30d)', emoji: '⚡' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingLeft: isDesktop ? 226 : 16, paddingBottom: 40 }}>
        <SectionTitle style={{ marginTop: 4 }}>Overview</SectionTitle>

        {/* Stat row — 4 equal tiles */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          {statItems.map((item, i) => (
            <View key={i} style={{ flex: 1 }}>
              <BlurView intensity={36} tint="light" style={{ borderRadius: RADIUS.md, overflow: 'hidden', shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:3}, shadowOpacity:1, shadowRadius:10, elevation:3 }}>
                <View style={{ backgroundColor: COLOURS.glass, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center' }}>
                  <Text style={{ fontSize: 32, lineHeight: 38, marginBottom: 6 }}>{item.emoji}</Text>
                  <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 26, color: COLOURS.navy, lineHeight: 28 }}>{item.value}</Text>
                  <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginTop: 3, textAlign: 'center', letterSpacing: 0.2 }}>{item.label}</Text>
                </View>
              </BlurView>
            </View>
          ))}
        </View>

        <SectionTitle>Activity</SectionTitle>
        <GlassCard>
          <ActivityGrid sessions={sessions} />
        </GlassCard>

        <SectionTitle>Last 14 days</SectionTitle>
        <GlassCard style={{ paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: barH + 18, gap: 3 }}>
            {last14.map(d => (
              <View key={d.iso} style={{ flex: 1, alignItems: 'center' }}>
                <View style={{
                  width: '100%',
                  height: d.practiced ? Math.max((d.duration / maxDur) * barH, 5) : 5,
                  backgroundColor: d.practiced ? COLOURS.navy : COLOURS.glassBorder,
                  borderRadius: 4,
                }} />
                <Text style={{ fontFamily: 'Lato', fontSize: 9, color: COLOURS.textDim, marginTop: 4 }}>{d.label}</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        {topPieces.length > 0 && (
          <>
            <SectionTitle style={{ marginTop: 8 }}>Most practised (30 days)</SectionTitle>
        {topPieces.map(({ name, count, avgLiking, mins }) => (
              <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                    <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.text }}>📜 {name}</Text>
                    {avgLiking !== null && (
                      <View style={{ flexDirection: 'row', gap: 1 }}>
                        {[1,2,3,4,5].map(n => (
                          <Text key={n} style={{ fontSize: 11, opacity: n <= Math.round(avgLiking) ? 1 : 0.18 }}>⭐</Text>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={{ height: 5, backgroundColor: COLOURS.glassBorderSubtle, borderRadius: 3 }}>
                    <View style={{ height: '100%', width: `${(count / topPieces[0].count) * 100}%`, backgroundColor: COLOURS.steel, borderRadius: 3 }} />
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim }}>{count}×</Text>
                  {mins > 0 && (
                    <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim }}>⏱ {mins}m</Text>
                  )}
                </View>
              </View>
            ))}
          </>
        )}

        <SectionTitle style={{ marginTop: 8 }}>Library</SectionTitle>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {STATUS_OPTIONS.map(s => (
            <BlurView
              key={s}
              intensity={32}
              tint="light"
              style={{
                flex: 1, borderRadius: RADIUS.md, overflow: 'hidden',
                shadowColor: COLOURS.glassShadow,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 1, shadowRadius: 8, elevation: 3,
              }}
            >
              <View style={{ backgroundColor: COLOURS.glass, padding: 14 }}>
                <Text style={{ fontSize: 32, lineHeight: 38, marginBottom: 6 }}>
                  {s === 'learning' ? '🌱' : s === 'consolidating' ? '💧' : '✨'}
                </Text>
                <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 26, color: STATUS_TEXT_COLOURS[s] || COLOURS.navy, lineHeight: 28 }}>
                  {compositions.filter(c => c.status === s).length}
                </Text>
                <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginTop: 3, letterSpacing: 0.2 }}>{s}</Text>
              </View>
            </BlurView>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
