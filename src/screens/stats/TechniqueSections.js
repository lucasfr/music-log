import React, { useState, useMemo } from 'react';
import { View, Text } from 'react-native';
import { COLOURS, RADIUS, SIZES } from '../../theme';
import { staleScales, agoLabel } from '../../utils/insights';
import { scaleCoverage, techniqueBreakdown, toggleFilter, COF_KEYS, COF_MINORS, DYNAMICS_LABELS } from '../../utils/scaleStats';
import { coverageColour, coverageRamp, readableOn, COVERAGE_TEAL_SELECTED } from '../../utils/chartColours';
import { ARTICULATION_OPTIONS, ARTICULATION_LABELS } from '../../constants';
import Svg, { Path, Circle, Text as SvgText, G } from 'react-native-svg';
import { todayISO } from '../../utils';
import { ZeldaBarFractional, FilterRow } from './shared';
import { coverageSummary } from '../../utils/chartSummaries';

export function TechniqueBreakdown({ sessions }) {
  // The filters are toggles: any number can be on, and none on means everything. A segment matches if
  // it has any of the articulations that are on (in either hand) AND any of the dynamics that are on.
  const [articulationFilter, setArticulationFilter] = useState([]);
  const [dynamicsFilter, setDynamicsFilter] = useState([]);

  // The toggles only offer what is actually in this period's data, so a row doesn't appear until
  // something has been logged with one; a toggle left on that has no data after switching period is
  // simply ignored.
  const { available, activeArticulations, availableDynamics, activeDynamics, sorted } = useMemo(
    () => techniqueBreakdown(sessions, articulationFilter, ARTICULATION_OPTIONS, dynamicsFilter),
    [sessions, articulationFilter, dynamicsFilter],
  );
  const filterOptions = available.map(a => ({ key: a, label: ARTICULATION_LABELS[a] }));
  const dynamicsOptions = availableDynamics.map(k => ({ key: k, label: DYNAMICS_LABELS[k] }));
  const filtered = activeArticulations.length > 0 || activeDynamics.length > 0;
  // With nothing on, no segments means no technique at all this period. With a filter on it can just
  // mean nothing matches, and then the toggles must stay so it can be changed.
  if (sorted.length === 0 && !filtered) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.textDim }}>No technique segments logged in this period.</Text>
  );

  const maxCount = sorted.length ? sorted[0][1].count : 1;
  const timeStr  = m => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;

  return (
    <View>
      {filterOptions.length > 0 && (
        <FilterRow
          label="Articulation" options={filterOptions} selected={activeArticulations}
          onToggle={k => setArticulationFilter(f => toggleFilter(f, k))} onClear={() => setArticulationFilter([])}
        />
      )}
      {dynamicsOptions.length > 0 && (
        <FilterRow
          label="Dynamics" options={dynamicsOptions} selected={activeDynamics}
          onToggle={k => setDynamicsFilter(f => toggleFilter(f, k))} onClear={() => setDynamicsFilter([])}
        />
      )}
      {sorted.length === 0 && (
        <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.textDim }}>Nothing this period matches those filters.</Text>
      )}
      {sorted.map(([name, data]) => {
        const avgDiff = data.difficulty.length
          ? data.difficulty.reduce((a, v) => a + v, 0) / data.difficulty.length
          : null;
        return (
          <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.text, flex: 1 }} numberOfLines={1}>{name}</Text>
            <View style={{ flex: 1, height: 14, backgroundColor: COLOURS.bg2, borderRadius: RADIUS.pill }}>
              <View style={{ height: '100%', width: `${(data.count / maxCount) * 100}%`, backgroundColor: COLOURS.steel, borderRadius: RADIUS.pill }} />
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4, width: 80, flexShrink: 0 }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.textDim }}>{data.count}×{data.minutes > 0 ? `  ⏱${timeStr(data.minutes)}` : ''}</Text>
              {avgDiff !== null && <View style={{ marginTop: 8 }}><ZeldaBarFractional emoji="🎵" fill={avgDiff} size={13} /></View>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Scale coverage — circle of fifths ───────────────────────────────────────

// Segment colours follow the theme, and each key name takes whichever of near-black or white reads
// on its segment (utils/chartColours.js).
function amberForCount(n, max) { return coverageColour('amber', n, max, COLOURS.isDark); }

function tealForCount(n, max) { return coverageColour('teal', n, max, COLOURS.isDark); }

function cofArcPath(cx, cy, r1, r2, startDeg, endDeg) {
  const s = startDeg * Math.PI / 180;
  const e = endDeg   * Math.PI / 180;
  const x1 = cx + r1 * Math.cos(s), y1 = cy + r1 * Math.sin(s);
  const x2 = cx + r1 * Math.cos(e), y2 = cy + r1 * Math.sin(e);
  const x3 = cx + r2 * Math.cos(e), y3 = cy + r2 * Math.sin(e);
  const x4 = cx + r2 * Math.cos(s), y4 = cy + r2 * Math.sin(s);
  return `M${x1},${y1} A${r1},${r1} 0 0,1 ${x2},${y2} L${x3},${y3} A${r2},${r2} 0 0,0 ${x4},${y4} Z`;
}

const MOTION_FILTER_OPTIONS = [
  { key: 'parallel', label: 'Parallel' },
  { key: 'contrary', label: 'Contrary' },
];

const OCTAVE_FILTER_OPTIONS = [
  { key: 1, label: '1 oct' },
  { key: 2, label: '2 oct' },
  { key: 3, label: '3 oct' },
  { key: 4, label: '4 oct' },
];

const INTERVAL_FILTER_OPTIONS = [
  { key: 'unison', label: 'Unison' },
  { key: 'third', label: '3rds' },
  { key: 'sixth', label: '6ths' },
  { key: 'tenth', label: '10ths' },
];

// Motion, octave and interval filters for scale coverage — lets Lucas isolate how much
// contrary-motion, 2-octave, or double-interval (3rds/6ths/10ths) practice he's actually logged,
// since these are specifically examined from around Grade 5–6. Each is a row of toggles: any number
// can be on (parallel and contrary, 1 and 2 octaves), and none on means everything.
function ScaleCoverageFilters({ motionFilter, setMotionFilter, octaveFilter, setOctaveFilter, intervalFilter, setIntervalFilter }) {
  return (
    <View style={{ marginBottom: 2 }}>
      <FilterRow label="Motion" options={MOTION_FILTER_OPTIONS} selected={motionFilter}
        onToggle={k => setMotionFilter(f => toggleFilter(f, k))} onClear={() => setMotionFilter([])} />
      <FilterRow label="Octaves" options={OCTAVE_FILTER_OPTIONS} selected={octaveFilter}
        onToggle={k => setOctaveFilter(f => toggleFilter(f, k))} onClear={() => setOctaveFilter([])} />
      <FilterRow label="Interval" options={INTERVAL_FILTER_OPTIONS} selected={intervalFilter}
        onToggle={k => setIntervalFilter(f => toggleFilter(f, k))} onClear={() => setIntervalFilter([])} />
    </View>
  );
}

export function ScaleCoverage({ sessions }) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState(null);
  const [motionFilter, setMotionFilter] = useState([]);   // the motions switched on: 'parallel', 'contrary'
  const [octaveFilter, setOctaveFilter] = useState([]);    // the octave counts switched on: 1, 2, 3, 4
  const [intervalFilter, setIntervalFilter] = useState([]); // the intervals on: 'unison', 'third', 'sixth', 'tenth'

  const {
    counts: scaleCounts, majorCounts, minorCounts, maxCount, totalMinutes: totalScaleMins,
    totalSessions: totalScaleSess, keysVisited, anyTechnique,
  } = useMemo(
    () => scaleCoverage(sessions, { motion: motionFilter, octaves: octaveFilter, interval: intervalFilter }),
    [sessions, motionFilter, octaveFilter, intervalFilter],
  );
  const timeStr        = m => { const r = Math.round(m); return r >= 60 ? `${Math.floor(r / 60)}h ${r % 60}m` : `${r}m`; };

  const size = width || 300;
  const cx = size / 2, cy = size / 2;
  const R1 = size * 0.46, R2 = size * 0.315, R3 = size * 0.18;

  const sel = selected;
  const selKey  = sel ? (sel.ring === 'major' ? COF_KEYS[sel.index] : COF_MINORS[sel.index]) : null;
  const selData = selKey ? scaleCounts[selKey] : null;
  const selAvgDiff = selData?.difficulty?.length
    ? selData.difficulty.reduce((a, v) => a + v, 0) / selData.difficulty.length
    : null;

  if (totalScaleSess === 0 && !anyTechnique) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.textDim }}>No scales logged in this period.</Text>
  );

  const summary = coverageSummary({ majorCounts, minorCounts, totalSessions: totalScaleSess, totalMinutes: totalScaleMins });
  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <ScaleCoverageFilters motionFilter={motionFilter} setMotionFilter={setMotionFilter} octaveFilter={octaveFilter} setOctaveFilter={setOctaveFilter} intervalFilter={intervalFilter} setIntervalFilter={setIntervalFilter} />
      {width > 0 && (
        <View style={{ position: 'relative', width: size, height: size }}>
        <View accessible accessibilityRole="image" accessibilityLabel={summary}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {COF_KEYS.map((key, i) => {
            const startDeg = -90 + i * 30 - 15;
            const endDeg   = startDeg + 30;
            const midDeg   = startDeg + 15;
            const midRad   = midDeg * Math.PI / 180;
            const majorSel = sel?.ring === 'major' && sel?.index === i;
            const minorSel = sel?.ring === 'minor' && sel?.index === i;
            const majorFill = majorSel ? COLOURS.gold : amberForCount(majorCounts[i], maxCount);
            const minorFill = minorSel ? COVERAGE_TEAL_SELECTED : tealForCount(minorCounts[i], maxCount);
            return (
              <G key={key}>
                <Path
                  d={cofArcPath(cx, cy, R1, R2, startDeg, endDeg)}
                  fill={majorFill}
                  stroke={COLOURS.bg} strokeWidth={2}
                  onPress={() => setSelected(majorSel ? null : { ring: 'major', index: i })}
                />
                <Path
                  d={cofArcPath(cx, cy, R2, R3, startDeg, endDeg)}
                  fill={minorFill}
                  stroke={COLOURS.bg} strokeWidth={1.5}
                  onPress={() => setSelected(minorSel ? null : { ring: 'minor', index: i })}
                />
                <SvgText
                  x={cx + (R1 + R2) / 2 * Math.cos(midRad)}
                  y={cy + (R1 + R2) / 2 * Math.sin(midRad)}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={size * 0.048} fontWeight="500"
                  fill={readableOn(majorFill, COLOURS.bg)} fontFamily="Lato"
                >{key === 'F#' ? 'F#/Gb' : key}</SvgText>
                <SvgText
                  x={cx + (R2 + R3) / 2 * Math.cos(midRad)}
                  y={cy + (R2 + R3) / 2 * Math.sin(midRad)}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={size * 0.038}
                  fill={readableOn(minorFill, COLOURS.bg)} fillOpacity={0.85} fontFamily="Lato"
                >{COF_MINORS[i]}</SvgText>
              </G>
            );
          })}

          {/* Centre circle */}
          <Circle cx={cx} cy={cy} r={R3 - 1}
            fill={COLOURS.glass} stroke={COLOURS.glassBorderSubtle} strokeWidth={1}
          />

          {/* Centre stats */}
          {!sel ? (
            <G>
              <SvgText x={cx} y={cy - size*0.074} textAnchor="middle" dominantBaseline="central"
                fontSize={size*0.040} fontWeight="500" fill={COLOURS.text} fontFamily="Lato">{timeStr(totalScaleMins)}</SvgText>
              <SvgText x={cx} y={cy - size*0.028} textAnchor="middle" dominantBaseline="central"
                fontSize={size*0.036} fill={COLOURS.textDim} fontFamily="Lato">total scale time</SvgText>
              <SvgText x={cx} y={cy + size*0.022} textAnchor="middle" dominantBaseline="central"
                fontSize={size*0.036} fontWeight="500" fill={COLOURS.text} fontFamily="Lato">{totalScaleSess} sessions</SvgText>
              <SvgText x={cx} y={cy + size*0.072} textAnchor="middle" dominantBaseline="central"
                fontSize={size*0.036} fontWeight="500" fill={COLOURS.text} fontFamily="Lato">{keysVisited}/24 keys</SvgText>

            </G>
          ) : (
            <G>
              <SvgText x={cx} y={cy - size*0.092} textAnchor="middle" dominantBaseline="central"
                fontSize={size*0.054} fontWeight="500" fill={COLOURS.text} fontFamily="CormorantGaramond">{selKey}</SvgText>
              <SvgText x={cx} y={cy - size*0.040} textAnchor="middle" dominantBaseline="central"
                fontSize={size*0.038} fill={COLOURS.textDim} fontFamily="Lato">{sel.ring === 'major' ? 'major' : 'minor'}</SvgText>
              <SvgText x={cx} y={cy + size*0.012} textAnchor="middle" dominantBaseline="central"
                fontSize={size*0.036} fontWeight="500" fill={COLOURS.text} fontFamily="Lato">{selData?.sessions || 0} sessions</SvgText>
              <SvgText x={cx} y={cy + size*0.058} textAnchor="middle" dominantBaseline="central"
                fontSize={size*0.038} fill={COLOURS.textDim} fontFamily="Lato">{timeStr(selData?.minutes || 0)}</SvgText>

            </G>
          )}
        </Svg>
        </View>
        {/* Avg diff Zelda bar — selected key only */}
        {sel && (
          <View style={{
            position: 'absolute',
            top: cy + size * 0.088,
            left: cx - size * 0.14,
            width: size * 0.28,
            alignItems: 'center',
          }}>
            {selAvgDiff !== null
              ? <ZeldaBarFractional emoji="🎵" fill={selAvgDiff} size={size * 0.038} />
              : <Text style={{ fontFamily: 'Lato', fontSize: size * 0.036, color: COLOURS.textDim, fontStyle: 'italic' }}>no difficulty data</Text>
            }
          </View>
        )}
        </View>
      )}

      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: coverageRamp('amber', COLOURS.isDark)[2] }} />
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>major</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: coverageRamp('teal', COLOURS.isDark)[2] }} />
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>minor</Text>
        </View>
        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, fontStyle: 'italic' }}>tap for details</Text>
      </View>
    </View>
  );
}

export function StaleScales({ sessions }) {
  const today = todayISO();
  const stale = useMemo(() => staleScales(sessions, today), [sessions, today]);
  const hasAny = sessions.some(s => (s.segments || []).some(g => (g.group === 'Scales' || g.group === 'Arpeggios') && (g.scales || []).length > 0));
  if (!hasAny) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.textDim }}>
      Scales and arpeggios you log will show up here once they have been left for two weeks.
    </Text>
  );
  if (stale.length === 0) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.textDim }}>
      Every scale and arpeggio you have logged was played in the last two weeks.
    </Text>
  );
  const urgency = d => (d >= 42 ? COLOURS.red : d >= 28 ? COLOURS.amber : COLOURS.steel);
  const shown = stale.slice(0, 6);
  return (
    <View>
      {shown.map(x => (
        <View key={`${x.kind}|${x.name}`} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 }}>
          <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: urgency(x.daysSince) }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.text }} numberOfLines={1}>{x.name}</Text>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: urgency(x.daysSince), marginTop: 2 }}>
              {x.kind === 'Arpeggios' ? 'Arpeggio' : 'Scale'} · {agoLabel(x.daysSince)}
            </Text>
          </View>
        </View>
      ))}
      {stale.length > shown.length ? (
        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>and {stale.length - shown.length} more</Text>
      ) : null}
    </View>
  );
}
