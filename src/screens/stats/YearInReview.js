// The year in review on Stats (see utils/yearReview.js), with a stepper to look at other years. It reads as a
// picture rather than a list: the year's hours as one big number, a bar for each month, a few stat tiles, the
// piece played most and the biggest tempo gain as feature rows, and a few of your wins as quotes.

import React, { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { COLOURS, RADIUS, SIZES } from '../../theme';
import { Ionicons } from '../../components/Icon';
import { usePref } from '../../utils/usePref';
import { fmtDate } from '../../utils';
import { tint } from '../../utils/tint';
import { parseRestDays } from '../../utils/progress';
import { yearReview } from '../../utils/yearReview';
import { TouchableYear } from './shared';

const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const BAR_AREA = 72;

const Caption = ({ children }) => (
  <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>{children}</Text>
);

// Twelve bars, January first; the busiest month is the solid one. Read aloud as one sentence.
function MonthBars({ months, busiest }) {
  const max = Math.max(...months, 0.1);
  const spoken = months
    .map((h, i) => (h > 0 ? `${MONTH_NAMES[i]} ${h} hours` : null)).filter(Boolean).join(', ');
  return (
    <View accessible accessibilityLabel={`Hours by month. ${spoken || 'Nothing practised.'}`}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: BAR_AREA }}>
        {months.map((h, i) => (
          <View key={MONTH_NAMES[i]} style={{
            flex: 1, height: Math.max(4, Math.round((h / max) * BAR_AREA)), borderRadius: 4,
            backgroundColor: i === busiest ? COLOURS.navy : h > 0 ? tint(COLOURS.navy, 0.35) : COLOURS.navyA(0.08),
          }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
        {MONTH_LETTERS.map((m, i) => (
          <Text key={MONTH_NAMES[i]} style={{ flex: 1, textAlign: 'center', fontFamily: i === busiest ? 'Lato-Bold' : 'Lato', fontSize: SIZES.labelSmall, color: i === busiest ? COLOURS.text : COLOURS.textDim }}>{m}</Text>
        ))}
      </View>
    </View>
  );
}

function Tile({ value, label }) {
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={{ flexBasis: '47%', flexGrow: 1, padding: 12, borderRadius: RADIUS.md, backgroundColor: COLOURS.w(0.45), borderWidth: 1, borderColor: COLOURS.w(0.6) }}>
      <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.display, color: COLOURS.text, fontVariant: ['lining-nums'] }}>{value}</Text>
      <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function Feature({ icon, accent, caption, main, meta }) {
  return (
    <View accessible accessibilityLabel={`${caption}: ${main}. ${meta}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: RADIUS.md, backgroundColor: COLOURS.w(0.45), borderWidth: 1, borderColor: tint(accent, 0.4) }}>
      <View style={{ width: 38, height: 38, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: tint(accent, 0.22) }}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Caption>{caption}</Caption>
        <Text numberOfLines={1} style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.cardTitle, color: COLOURS.text, marginTop: 2 }}>{main}</Text>
        <Text numberOfLines={1} style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>{meta}</Text>
      </View>
    </View>
  );
}

export function YearInReview({ sessions, lessons, compositions }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [restRaw] = usePref('restDays', '[]');
  const r = useMemo(() => yearReview(sessions, lessons, compositions, year, parseRestDays(restRaw)), [sessions, lessons, compositions, year, restRaw]);

  const tiles = [
    r.longestRun > 1 ? { value: r.longestRun, label: 'days in a row, the longest run' } : null,
    r.piecesPlayed ? { value: r.piecesPlayed, label: r.piecesPlayed === 1 ? 'piece practised' : 'pieces practised' } : null,
    r.scalesPlayed ? { value: r.scalesPlayed, label: r.scalesPlayed === 1 ? 'scale or arpeggio' : 'scales and arpeggios' } : null,
    r.lessons ? { value: r.lessons, label: r.lessons === 1 ? 'lesson' : 'lessons' } : null,
    r.memorised ? { value: r.memorised, label: r.memorised === 1 ? 'piece memorised' : 'pieces memorised' } : null,
  ].filter(Boolean);

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.display, color: COLOURS.text, fontVariant: ['lining-nums'] }}>{year}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableYear icon="chevron-back" label="Previous year" onPress={() => setYear(y => y - 1)} />
          <TouchableYear icon="chevron-forward" label="Next year" onPress={() => setYear(y => y + 1)} disabled={year >= thisYear} />
        </View>
      </View>

      {r.empty ? (
        <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.textDim }}>Nothing logged in {year}.</Text>
      ) : (
        <>
          {r.sessions ? (
            <View accessible accessibilityLabel={`${r.hours} hours over ${r.sessions} sessions on ${r.activeDays} days`}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.hero, color: COLOURS.navy, fontVariant: ['lining-nums'] }}>{r.hours}</Text>
                <Text style={{ fontFamily: 'Lato', fontSize: SIZES.body, color: COLOURS.textMuted }}>hours</Text>
              </View>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginTop: 2 }}>
                {r.sessions} {r.sessions === 1 ? 'session' : 'sessions'} on {r.activeDays} {r.activeDays === 1 ? 'day' : 'days'}
              </Text>
            </View>
          ) : null}

          {r.sessions ? (
            <View style={{ marginTop: 16 }}>
              <MonthBars months={r.months} busiest={r.busiestIndex} />
              {r.busiestMonth ? (
                <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginTop: 8 }}>
                  Busiest: {r.busiestMonth.month}, {r.busiestMonth.hours} hours
                </Text>
              ) : null}
            </View>
          ) : null}

          {tiles.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              {tiles.map(t => <Tile key={t.label} value={t.value} label={t.label} />)}
            </View>
          ) : null}

          {r.topPiece || r.biggestGain ? (
            <View style={{ gap: 8, marginTop: 8 }}>
              {r.topPiece ? (
                <Feature icon="musical-notes-outline" accent={COLOURS.gold} caption="Played most" main={r.topPiece.title}
                  meta={`${Math.round((r.topPiece.minutes / 60) * 10) / 10} hours`} />
              ) : null}
              {r.biggestGain ? (
                <Feature icon="speedometer-outline" accent={COLOURS.success} caption="Biggest tempo gain" main={r.biggestGain.name}
                  meta={`${r.biggestGain.from} to ${r.biggestGain.to} bpm, +${r.biggestGain.gain}`} />
              ) : null}
            </View>
          ) : null}
        </>
      )}

      {r.wins.length ? (
        <View style={{ marginTop: 16 }}>
          <Caption>A few wins</Caption>
          <View style={{ marginTop: 8 }}>
            {r.wins.map((w, i) => (
              <View key={`${w.date}-${i}`} style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: COLOURS.gold, marginBottom: 8 }}>
                <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>{fmtDate(w.date)}</Text>
                <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.text, lineHeight: 20 }}>{`\u201c${w.text}\u201d`}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
