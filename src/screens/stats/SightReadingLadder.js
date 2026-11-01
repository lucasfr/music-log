// The sight-reading ladder on Stats: pick a level, play something at that level cold, and tap how it went.
// The ladder says when to step up or down (see utils/sightLadder.js). Attempts are kept in a preference.

import React, { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { COLOURS, RADIUS, SIZES, HIT_PILL } from '../../theme';
import { Tap as TouchableOpacity } from '../../components/Motion';
import { usePref } from '../../utils/usePref';
import { todayISO, fmtDate } from '../../utils';
import {
  parseAttempts, serializeAttempts, addAttempt, suggestLevel, levelLabel, MIN_LEVEL, MAX_LEVEL,
} from '../../utils/sightLadder';

const RATINGS = [
  { value: 1, label: 'Struggled' },
  { value: 2, label: 'Shaky' },
  { value: 3, label: 'Got through' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Fluent' },
];

function Pill({ label, onPress, a11y, filled }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} hitSlop={HIT_PILL}
      accessibilityRole="button" accessibilityLabel={a11y || label}
      style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderRadius: RADIUS.pill, backgroundColor: filled ? COLOURS.navy : COLOURS.navyA(0.08) }}>
      <Text style={{ fontFamily: filled ? 'Lato-Bold' : 'Lato', fontSize: SIZES.bodySmall, color: filled ? COLOURS.onNavy : COLOURS.textMuted }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SightReadingLadder() {
  const [raw, setRaw] = usePref('sightAttempts', '[]');
  const attempts = useMemo(() => parseAttempts(raw), [raw]);
  const suggestion = useMemo(() => suggestLevel(attempts), [attempts]);
  // The level for the next go: the ladder's suggestion until you pick another.
  const [picked, setPicked] = useState(null);
  const level = picked == null ? suggestion.level : picked;
  const colour = suggestion.change === 'up' ? COLOURS.success : suggestion.change === 'down' ? COLOURS.amber : COLOURS.textDim;
  const recent = attempts.slice(-5).reverse();

  const log = rating => {
    setRaw(serializeAttempts(addAttempt(attempts, todayISO(), level, rating)));
    setPicked(null);
  };

  return (
    <View>
      <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: colour, lineHeight: 19, marginBottom: 14 }}>{suggestion.reason}</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pill label={'\u2212'} a11y="A lower level" onPress={() => setPicked(Math.max(MIN_LEVEL, level - 1))} />
        <View style={{ flex: 1 }} accessible accessibilityLabel={`Level ${level}: ${levelLabel(level)}`}>
          <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.sectionTitle, color: COLOURS.text, fontVariant: ['lining-nums'] }}>Level {level}</Text>
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, marginTop: 2 }}>{levelLabel(level)}</Text>
        </View>
        <Pill label="+" a11y="A higher level" onPress={() => setPicked(Math.min(MAX_LEVEL, level + 1))} />
      </View>

      <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.text, marginTop: 16, marginBottom: 8 }}>
        You played something at level {level}. How did it go?
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {RATINGS.map(r => <Pill key={r.value} label={r.label} a11y={`Log level ${level}: ${r.label}`} onPress={() => log(r.value)} filled={r.value >= 4} />)}
      </View>

      {recent.length ? (
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Latest</Text>
          {recent.map((a, i) => (
            <Text key={`${a.date}-${i}`} style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.text, paddingVertical: 2 }}>
              {fmtDate(a.date)}  ·  level {a.level}  ·  {RATINGS.find(r => r.value === a.rating).label.toLowerCase()}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
