// The "What your energy predicts" card on Stats: plain sentences about where high-energy and low-energy
// sessions differ, then the averages behind them. Nothing is shown until there is enough to compare (see
// utils/energyInsight.js, which also words the sentences).

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { COLOURS, SIZES } from '../../theme';
import { energyInsight } from '../../utils/energyInsight';

const one = v => (v === null || v === undefined ? '\u2014' : (Math.round(v * 10) / 10).toFixed(1));

// What the table shows per row: its label, how to write a group's value, and how a screen reader says it.
const ROWS = [
  { key: 'sessions',  label: 'Sessions',          show: g => String(g.sessions) },
  { key: 'minutes',   label: 'Minutes a session', show: g => (g.minutes === null ? '\u2014' : String(Math.round(g.minutes))) },
  { key: 'progress',  label: 'Progress tags',     show: g => one(g.progress) },
  { key: 'enjoyment', label: 'Enjoyment',         show: g => one(g.enjoyment) },
  { key: 'felt',      label: 'Felt difficulty',   show: g => one(g.felt) },
];

export function EnergyInsight({ sessions }) {
  const result = useMemo(() => energyInsight(sessions), [sessions]);

  if (!result.ready) {
    return (
      <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.textDim, lineHeight: 22 }}>{result.reason}</Text>
    );
  }

  return (
    <View>
      {result.lines.map(line => (
        <Text key={line} style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.text, lineHeight: 21, marginBottom: 8 }}>{line}</Text>
      ))}

      <View style={{ marginTop: 8 }}>
        <View style={{ flexDirection: 'row', paddingBottom: 6 }}>
          <View style={{ flex: 1.6 }} />
          {result.groups.map(g => (
            <Text key={g.key} style={{ flex: 1, textAlign: 'center', fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6 }}>{g.label}</Text>
          ))}
        </View>
        {ROWS.map(row => (
          <View key={row.key} accessible
            accessibilityLabel={`${row.label}: ${result.groups.map(g => `${g.label.toLowerCase()} ${row.show(g)}`).join(', ')}`}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: COLOURS.glassBorderSubtle }}>
            <Text style={{ flex: 1.6, fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textMuted }}>{row.label}</Text>
            {result.groups.map(g => (
              <Text key={g.key} style={{ flex: 1, textAlign: 'center', fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.text, fontVariant: ['tabular-nums'] }}>{row.show(g)}</Text>
            ))}
          </View>
        ))}
      </View>

      <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, lineHeight: 18, marginTop: 12 }}>
        {result.note} Based on {result.rated} sessions with an energy rating, all time.
      </Text>
    </View>
  );
}
