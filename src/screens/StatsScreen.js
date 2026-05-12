import React from 'react';
import { View, Text, ScrollView } from 'react-native';
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

// ─── Activity grid (GitHub-style) ───────────────────────────────────────────

const WEEKS = 18;
const CELL  = 11;
const GAP   = 3;

function cellColor(duration) {
  if (!duration) return 'rgba(9,99,126,0.07)';
  if (duration < 20)  return 'rgba(9,99,126,0.20)';
  if (duration < 40)  return 'rgba(9,99,126,0.42)';
  if (duration < 60)  return 'rgba(9,99,126,0.65)';
  return '#09637E';
}

function ActivityGrid({ sessions }) {
  const dateMap = {};
  sessions.forEach(s => { dateMap[s.date] = (dateMap[s.date] || 0) + (Number(s.duration) || 0); });

  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7; // 0=Mon, 6=Sun
  const gridEnd = new Date(today);
  gridEnd.setDate(today.getDate() + (6 - dayOfWeek));

  const gridStart = new Date(gridEnd);
  gridStart.setDate(gridEnd.getDate() - WEEKS * 7 + 1);

  const cells = Array.from({ length: WEEKS }, (_, col) =>
    Array.from({ length: 7 }, (_, row) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + col * 7 + row);
      const iso = d.toISOString().slice(0, 10);
      const isFuture = d > today;
      return { iso, duration: isFuture ? null : (dateMap[iso] || 0), isFuture };
    })
  );

  const monthLabels = [];
  const seen = new Set();
  cells.forEach((col, ci) => {
    const month = col[0].iso.slice(0, 7);
    if (!seen.has(month)) {
      seen.add(month);
      const d = new Date(col[0].iso + 'T12:00:00');
      monthLabels.push({ col: ci, label: d.toLocaleDateString('en-GB', { month: 'short' }) });
    }
  });

  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const gridW = WEEKS * (CELL + GAP) - GAP;

  return (
    <View>
      {/* Month labels */}
      <View style={{ marginLeft: 18, marginBottom: 4, height: 12, position: 'relative' }}>
        {monthLabels.map(({ col, label }) => (
          <Text key={label + col} style={{
            position: 'absolute', left: col * (CELL + GAP),
            fontFamily: 'Lato', fontSize: 9, color: COLOURS.textDim, letterSpacing: 0.3,
          }}>{label}</Text>
        ))}
      </View>

      {/* Grid + day labels */}
      <View style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-start' }}>
        <View style={{ gap: GAP, marginTop: 1 }}>
          {DAY_LABELS.map((l, i) => (
            <View key={i} style={{ width: 10, height: CELL, justifyContent: 'center' }}>
              <Text style={{ fontFamily: 'Lato', fontSize: 8, color: i % 2 === 0 ? COLOURS.textDim : 'transparent', textAlign: 'right' }}>{l}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: GAP }}>
          {cells.map((col, ci) => (
            <View key={ci} style={{ gap: GAP }}>
              {col.map(({ iso, duration, isFuture }) => (
                <View key={iso} style={{
                  width: CELL, height: CELL, borderRadius: 2,
                  backgroundColor: isFuture ? 'transparent' : cellColor(duration),
                }} />
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* Legend */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, justifyContent: 'flex-end' }}>
        <Text style={{ fontFamily: 'Lato', fontSize: 9, color: COLOURS.textDim, marginRight: 2 }}>Less</Text>
        {[0, 15, 35, 55, 75].map(d => (
          <View key={d} style={{ width: CELL, height: CELL, borderRadius: 2, backgroundColor: cellColor(d) }} />
        ))}
        <Text style={{ fontFamily: 'Lato', fontSize: 9, color: COLOURS.textDim, marginLeft: 2 }}>More</Text>
      </View>
    </View>
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
