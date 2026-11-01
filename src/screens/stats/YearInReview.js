// The year in review on Stats: a summary of one calendar year from what is already logged (see utils/yearReview.js),
// with a stepper to look at other years.

import React, { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { COLOURS, SIZES } from '../../theme';
import { usePref } from '../../utils/usePref';
import { fmtDate } from '../../utils';
import { parseRestDays } from '../../utils/progress';
import { yearReview } from '../../utils/yearReview';
import { TouchableYear } from './shared';

export function YearInReview({ sessions, lessons, compositions }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [restRaw] = usePref('restDays', '[]');
  const r = useMemo(() => yearReview(sessions, lessons, compositions, year, parseRestDays(restRaw)), [sessions, lessons, compositions, year, restRaw]);

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.cardTitle, color: COLOURS.text, fontVariant: ['lining-nums'] }}>{year}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableYear icon="chevron-back" label="Previous year" onPress={() => setYear(y => y - 1)} />
          <TouchableYear icon="chevron-forward" label="Next year" onPress={() => setYear(y => y + 1)} disabled={year >= thisYear} />
        </View>
      </View>

      {r.empty ? (
        <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.textDim }}>Nothing logged in {year}.</Text>
      ) : (
        <View accessible accessibilityLabel={`${year} in review. ${r.highlights.join(' ')}`}>
          {r.highlights.map((line, i) => (
            <Text key={`${i}-${line}`} style={{ fontFamily: i === 0 ? 'Lato-Bold' : 'Lato', fontSize: i === 0 ? SIZES.body : SIZES.bodySmall, color: COLOURS.text, lineHeight: 22, marginBottom: 4 }}>{line}</Text>
          ))}
        </View>
      )}

      {r.wins.length ? (
        <View style={{ marginTop: 14 }}>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>A few wins</Text>
          {r.wins.map((w, i) => (
            <View key={`${w.date}-${i}`} style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: COLOURS.gold, marginBottom: 8 }}>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>{fmtDate(w.date)}</Text>
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.text, lineHeight: 20 }}>{`\u201c${w.text}\u201d`}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
