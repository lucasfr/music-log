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

export default function StatsScreen({ sessions, compositions, isDesktop }) {

  const last30 = sessions.filter(s => {
    const d = new Date(s.date + 'T12:00:00');
    const ago = new Date(); ago.setDate(ago.getDate() - 30);
    return d >= ago;
  });

  const totalMin = last30.reduce((a, s) => a + (Number(s.duration) || 0), 0);
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
  last30.forEach(s => {
    (s.segments || []).forEach(seg => {
      if (seg.compositionId) {
        const name = (compositions.find(c => c.id === seg.compositionId) || {}).title || seg.compositionId;
        pieceFreq[name] = (pieceFreq[name] || 0) + 1;
      } else if (seg.title) {
        pieceFreq[seg.title] = (pieceFreq[seg.title] || 0) + 1;
      }
    });
  });
  const topPieces = Object.entries(pieceFreq).sort((a, b) => b[1] - a[1]).slice(0, 5);

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
    { value: Math.round(totalMin), label: 'minutes practised', emoji: '⏱' },
    { value: last30.length,        label: 'sessions',           emoji: '🎹' },
    { value: streak,               label: 'day streak',         emoji: '🔥' },
    { value: Number(avgEnergy) > 0 ? `+${avgEnergy}` : avgEnergy, label: 'avg energy', emoji: '⚡' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <SectionTitle style={{ marginTop: 4 }}>📊 Overview</SectionTitle>

        {/* Stat row — 4 equal tiles */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          {statItems.map((item, i) => (
            <View key={i} style={{ flex: 1 }}>
              <BlurView intensity={36} tint="light" style={{ borderRadius: RADIUS.md, overflow: 'hidden', shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:3}, shadowOpacity:1, shadowRadius:10, elevation:3 }}>
                <View style={{ backgroundColor: COLOURS.glass, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, marginBottom: 6 }}>{item.emoji}</Text>
                  <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 22, color: COLOURS.navy, lineHeight: 26 }}>{item.value}</Text>
                  <Text style={{ fontFamily: 'Lato', fontSize: 10, color: COLOURS.textDim, marginTop: 3, textAlign: 'center' }}>{item.label}</Text>
                </View>
              </BlurView>
            </View>
          ))}
        </View>

        <SectionTitle>📅 Last 14 days</SectionTitle>
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
            <SectionTitle style={{ marginTop: 8 }}>📜 Most practised (30 days)</SectionTitle>
            {topPieces.map(([name, count]) => (
              <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.text, marginBottom: 5 }}>📜 {name}</Text>
                  <View style={{ height: 5, backgroundColor: COLOURS.glassBorderSubtle, borderRadius: 3 }}>
                    <View style={{ height: '100%', width: `${(count / topPieces[0][1]) * 100}%`, backgroundColor: COLOURS.steel, borderRadius: 3 }} />
                  </View>
                </View>
                <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, minWidth: 24, textAlign: 'right' }}>{count}×</Text>
              </View>
            ))}
          </>
        )}

        <SectionTitle style={{ marginTop: 8 }}>🎧 Library</SectionTitle>
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
                <Text style={{ fontSize: 18, marginBottom: 4 }}>
                  {s === 'learning' ? '🌱' : s === 'consolidating' ? '💧' : '✨'}
                </Text>
                <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 30, color: STATUS_TEXT_COLOURS[s] || COLOURS.navy }}>
                  {compositions.filter(c => c.status === s).length}
                </Text>
                <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim, marginTop: 2 }}>{s}</Text>
              </View>
            </BlurView>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
