import React from 'react';
import { View, Text, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, RADIUS } from '../theme';
import { SectionTitle, Card } from '../components/UI';
import { STATUS_OPTIONS } from '../constants';
import { fmtDateShort } from '../utils';

const STATUS_COLORS = {
  learning:            '#92400E',
  consolidating:       '#1E40AF',
  'performance-ready': '#166534',
};

export default function StatsScreen({ sessions, compositions }) {
  const C = useTheme();
  const W = Dimensions.get('window').width - 32; // screen minus padding

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
    let count = 0;
    let d = new Date();
    const dateSet = new Set(sessions.map(s => s.date));
    while (true) {
      const iso = d.toISOString().slice(0, 10);
      if (!dateSet.has(iso)) break;
      count++;
      d.setDate(d.getDate() - 1);
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
  const barHeight = 72;

  const statItems = [
    { value: Math.round(totalMin), label: 'minutes this month' },
    { value: last30.length, label: 'sessions this month' },
    { value: streak, label: 'day streak' },
    { value: Number(avgEnergy) > 0 ? `+${avgEnergy}` : avgEnergy, label: 'avg energy' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.surface }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <SectionTitle>Overview</SectionTitle>

        {/* Stat grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
          {statItems.map((item, i) => (
            <View key={i} style={{ width: (W - 10) / 2, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md, padding: 14 }}>
              <Text style={{ fontFamily: 'serif', fontSize: 28, color: C.accent }}>{item.value}</Text>
              <Text style={{ fontSize: 12, color: C.ink3, marginTop: 2 }}>{item.label}</Text>
            </View>
          ))}
        </View>

        <SectionTitle>Last 14 days</SectionTitle>
        <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md, padding: 16, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: barHeight + 18, gap: 3 }}>
            {last14.map(d => (
              <View key={d.iso} style={{ flex: 1, alignItems: 'center' }}>
                <View style={{
                  width: '100%',
                  height: d.practiced ? Math.max((d.duration / maxDur) * barHeight, 4) : 4,
                  backgroundColor: d.practiced ? C.accent : C.border,
                  borderRadius: 3,
                }} />
                <Text style={{ fontSize: 9, color: C.ink3, marginTop: 4 }}>{d.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {topPieces.length > 0 && (
          <>
            <SectionTitle>Most practiced (30 days)</SectionTitle>
            {topPieces.map(([name, count]) => (
              <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: C.ink, marginBottom: 4 }}>{name}</Text>
                  <View style={{ height: 5, backgroundColor: C.border, borderRadius: 3 }}>
                    <View style={{ height: '100%', width: `${(count / topPieces[0][1]) * 100}%`, backgroundColor: C.accent, borderRadius: 3 }} />
                  </View>
                </View>
                <Text style={{ fontSize: 13, color: C.ink3, minWidth: 24, textAlign: 'right' }}>{count}×</Text>
              </View>
            ))}
          </>
        )}

        <SectionTitle style={{ marginTop: 8 }}>Library</SectionTitle>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {STATUS_OPTIONS.map(s => (
            <View key={s} style={{ flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md, padding: 14 }}>
              <Text style={{ fontFamily: 'serif', fontSize: 28, color: STATUS_COLORS[s] }}>
                {compositions.filter(c => c.status === s).length}
              </Text>
              <Text style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>{s}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
