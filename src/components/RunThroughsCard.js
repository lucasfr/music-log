// Run-throughs for Stats: how many times each piece has been played right through without stopping
// (see runThroughStats in utils/insights.js). Practice minutes don't show this, and it is what an
// exam asks for.

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { COLOURS } from '../theme';
import { AnimatedFill } from './Motion';
import { todayISO } from '../utils';
import { runThroughStats, describeRunThroughs, shortDate } from '../utils/insights';

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function RunThroughsCard({ sessions, compositions }) {
  const today = todayISO();
  const items = useMemo(() => runThroughStats(sessions, compositions, today), [sessions, compositions, today]);

  if (!items.length) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 14, color: COLOURS.textDim, lineHeight: 20 }}>
      Note how many times you played a piece right through without stopping when you log practice, and they show up here.
    </Text>
  );

  const shown = items.slice(0, 8);
  const most = Math.max(...shown.map(p => p.total), 1);
  const total = items.reduce((t, p) => t + p.total, 0);
  const recent = items.reduce((t, p) => t + p.recent, 0);

  return (
    <View>
      <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginBottom: 12 }}>
        {count(recent, 'run-through', 'run-throughs')} in the last month, {total} in all, across {count(items.length, 'piece', 'pieces')}
      </Text>
      {shown.map(p => (
        <View key={p.key} style={{ marginBottom: 12 }} accessible accessibilityLabel={`${p.name}: ${describeRunThroughs(p)}, last on ${shortDate(p.lastDate)}`}>
          <Text numberOfLines={1} style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 16, color: COLOURS.text }}>{p.name}</Text>
          <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginTop: 2 }}>
            {describeRunThroughs(p)} {'\u00b7'} last {shortDate(p.lastDate)}
          </Text>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: COLOURS.bg2, marginTop: 6, overflow: 'hidden' }}>
            <AnimatedFill fraction={p.total / most} style={{ height: '100%', borderRadius: 2, backgroundColor: COLOURS.steel }} />
          </View>
        </View>
      ))}
      {items.length > shown.length ? (
        <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim }}>and {items.length - shown.length} more</Text>
      ) : null}
    </View>
  );
}
