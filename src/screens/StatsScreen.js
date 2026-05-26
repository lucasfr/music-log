import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, STATUS_COLOURS } from '../theme';
import { GlassCard, SectionTitle } from '../components/UI';
import { STATUS_OPTIONS } from '../constants';

const STATUS_EMOJI = {
  new:                 '🌿',
  learning:            '🌱',
  consolidating:       '💧',
  'performance-ready': '✨',
  shelved:             '📦',
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

function ActivityGrid({ sessions, lessons }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [width, setWidth] = useState(0);

  const dateMap = {};
  sessions.forEach(s => {
    dateMap[s.date] = (dateMap[s.date] || 0) + (Number(s.duration) || 0);
  });

  const lessonDates = new Set((lessons || []).map(l => l.date));

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
          <TouchableYear onPress={() => setYear(y => y - 1)} label="‹" />
          {year < currentYear && <TouchableYear onPress={() => setYear(y => y + 1)} label="›" />}
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
                        const isLesson = lessonDates.has(day.iso);
                        const isToday = day.iso === new Date().toISOString().slice(0, 10);
                        const color = day.isFuture
                          ? 'rgba(0,0,0,0.05)'
                          : isLesson
                            ? day.duration > 0
                              ? `rgba(247,127,0,${0.45 + Math.min(0.55, day.duration / 120)})`
                              : 'rgba(247,127,0,0.45)'
                            : cellColor(day.duration) || 'rgba(140,32,69,0.07)';
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
        <Text style={{ fontFamily: 'Lato', fontSize: 9, color: COLOURS.textDim, marginLeft: 2, marginRight: 8 }}>More</Text>
        <View style={{ width: cell, height: cell, borderRadius: Math.max(1, cell * 0.2), backgroundColor: 'rgba(247,127,0,0.55)' }} />
        <Text style={{ fontFamily: 'Lato', fontSize: 9, color: COLOURS.textDim }}>Lesson</Text>
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

export default function StatsScreen({ sessions, compositions, lessons, isDesktop }) {
  const [period, setPeriod] = useState('30d');

  const PERIODS = [
    { key: '7d',  label: '7 days' },
    { key: '30d', label: '30 days' },
    { key: 'all', label: 'All time' },
  ];

  function filterByPeriod(items, days) {
    if (period === 'all') return items;
    const ago = new Date();
    ago.setDate(ago.getDate() - days);
    return items.filter(s => new Date(s.date + 'T12:00:00') >= ago);
  }

  const days = period === '7d' ? 7 : 30;
  const periodSessions = filterByPeriod(sessions, days);
  const periodLessons  = filterByPeriod(lessons || [], days);

  const totalMin    = periodSessions.reduce((a, s) => a + (Number(s.duration) || 0), 0);
  const allTimeMin  = sessions.reduce((a, s) => a + (Number(s.duration) || 0), 0);
  const avgEnergy   = periodSessions.length
    ? (periodSessions.reduce((a, s) => a + Number(s.energy), 0) / periodSessions.length).toFixed(1)
    : '—';

  const streak = (() => {
    const dateSet = new Set(periodSessions.map(s => s.date));
    if (dateSet.size === 0) return 0;
    // Walk every day in the period, find the longest consecutive run
    const start = period === 'all'
      ? new Date(Math.min(...periodSessions.map(s => new Date(s.date + 'T12:00:00'))))
      : (() => { const d = new Date(); d.setDate(d.getDate() - days); return d; })();
    const end = new Date();
    let best = 0, current = 0, d = new Date(start);
    while (d <= end) {
      const iso = d.toISOString().slice(0, 10);
      if (dateSet.has(iso)) { current++; best = Math.max(best, current); }
      else { current = 0; }
      d.setDate(d.getDate() + 1);
    }
    return best;
  })();

  const pieceFreq = {};
  const pieceEnjoyment = {};
  const pieceMinutes = {};
  periodSessions.forEach(s => {
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
    const hasLesson = (lessons || []).some(l => l.date === iso);
    return {
      iso,
      label: d.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 1),
      duration: s ? (Number(s.duration) || 30) : 0,
      practiced: !!s,
      hasLesson,
    };
  });
  const maxDur = Math.max(...last14.map(d => d.duration), 1);
  const barH = 72;

  const periodLabel = period === 'all' ? 'all time' : period === '7d' ? '7d' : '30d';

  const statItems = [
    { value: totalMin >= 60 ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}m` : `${Math.round(totalMin)}m`, label: `practice (${periodLabel})`, emoji: '⏱' },
    { value: periodSessions.length, label: `sessions (${periodLabel})`,  emoji: '🎹' },
    { value: periodLessons.length,  label: `lessons (${periodLabel})`,   emoji: '🎓' },
    { value: streak,                label: 'longest streak',              emoji: '🔥' },
    { value: Number(avgEnergy) > 0 ? `+${avgEnergy}` : avgEnergy, label: `avg energy (${periodLabel})`, emoji: '⚡' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingLeft: isDesktop ? 226 : 16, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 }}>
          <SectionTitle style={{ marginBottom: 0 }}>Overview</SectionTitle>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {PERIODS.map(p => {
              const active = period === p.key;
              return (
                <TouchableOpacity key={p.key} onPress={() => setPeriod(p.key)} activeOpacity={0.75}
                  style={{
                    paddingHorizontal: 11, paddingVertical: 5, borderRadius: RADIUS.pill,
                    backgroundColor: active ? COLOURS.navy : 'rgba(255,255,255,0.55)',
                    shadowColor: active ? COLOURS.glassShadowMd : COLOURS.glassShadow,
                    shadowOffset: { width: 0, height: active ? 3 : 1 },
                    shadowOpacity: 1, shadowRadius: active ? 8 : 4, elevation: active ? 3 : 1,
                  }}>
                  <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: 12, color: active ? '#fff' : COLOURS.textMuted }}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Stat tiles — wrap into two rows on narrow screens */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {statItems.map((item, i) => (
            <View key={i} style={{ flexBasis: '18%', flexGrow: 1 }}>
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
          <ActivityGrid sessions={sessions} lessons={lessons} />
        </GlassCard>

        <SectionTitle>Last 14 days</SectionTitle>
        <GlassCard style={{ paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontFamily: 'Lato', fontSize: 9, color: COLOURS.textDim }}>{maxDur}m</Text>
            <Text style={{ fontFamily: 'Lato', fontSize: 9, color: COLOURS.textDim }}>min</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: barH + 18, gap: 3 }}>
            {last14.map(d => (
              <View key={d.iso} style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ height: 6, justifyContent: 'center', alignItems: 'center', marginBottom: 2 }}>
                  {d.hasLesson ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: COLOURS.amber }} /> : null}
                </View>
                <View style={{
                  width: '100%',
                  height: d.practiced ? Math.max((d.duration / maxDur) * barH, 5) : 5,
                  backgroundColor: d.practiced ? COLOURS.navy : 'rgba(140,32,69,0.10)',
                  borderRadius: 4,
                }} />
                <Text style={{ fontFamily: 'Lato', fontSize: 9, color: COLOURS.textDim, marginTop: 4 }}>{d.label}</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        {topPieces.length > 0 && (
          <>
            <SectionTitle style={{ marginTop: 8 }}>Most practised ({periodLabel})</SectionTitle>
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
          {STATUS_OPTIONS.map(s => {
            const sc = STATUS_COLOURS[s] || {};
            const count = compositions.filter(c => c.status === s).length;
            return (
              <BlurView
                key={s}
                intensity={32}
                tint="light"
                style={{
                  flex: 1, borderRadius: RADIUS.md, overflow: 'hidden',
                  shadowColor: sc.border || COLOURS.accentMid,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.6, shadowRadius: 14, elevation: 3,
                }}
              >
                <View style={{ backgroundColor: sc.bg || COLOURS.glass, padding: 14 }}>
                  <Text style={{ fontSize: 32, lineHeight: 38, marginBottom: 6 }}>
                    {STATUS_EMOJI[s] || '🎵'}
                  </Text>
                  <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 26, color: sc.text || COLOURS.navy, lineHeight: 28 }}>
                    {count}
                  </Text>
                  <Text style={{ fontFamily: 'Lato', fontSize: 13, color: sc.text || COLOURS.textDim, marginTop: 3, letterSpacing: 0.2, opacity: 0.8 }}>{s}</Text>
                </View>
              </BlurView>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
