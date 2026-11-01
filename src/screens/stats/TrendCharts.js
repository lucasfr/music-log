import React, { useState, useMemo } from 'react';
import { View, Text } from 'react-native';
import { COLOURS, SIZES } from '../../theme';
import { volumeBuckets, trendBuckets, dayOfWeekBuckets } from '../../utils/statsCalc';
import { labelIndices, labelAnchor } from '../../utils/chartLabels';
import { energyColours, LIKING_LINE } from '../../utils/chartColours';
import Svg, { Path, Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { todayISO } from '../../utils';
import { weekLabel, diamondPath } from './shared';
import { volumeSummary, trendSummary, scatterSummary, dayOfWeekSummary } from '../../utils/chartSummaries';

export function PracticeVolumeChart({ sessions, period }) {
  const [width, setWidth] = useState(0);
  const isDaily = period === '7d';

  const today = todayISO();
  const { visible, mins } = useMemo(() => volumeBuckets(sessions, period, today), [sessions, period, today]);

  if (mins.every(v => v === 0)) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.textDim }}>Not enough data yet.</Text>
  );

  const maxMin = Math.max(...mins, 1);
  const activeMins = mins.filter(v => v > 0);
  const avgMin = activeMins.length ? Math.round(activeMins.reduce((a, v) => a + v, 0) / activeMins.length) : 0;
  const totalMin = mins.reduce((a, v) => a + v, 0);
  const timeStr = m => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;

  const H = 160;
  const padT = 16, padB = 20;
  const barGap = 2;
  const barW = width > 0 ? Math.min(36, Math.max(4, Math.floor((width - (visible.length - 1) * barGap) / visible.length))) : 0;
  const maxBarH = H - padT - padB;
  const avgY = padT + (1 - avgMin / maxMin) * maxBarH;

  const labelSet = isDaily ? null : labelIndices(visible.length, visible.length * (barW + barGap));
  function xLabel(key, i) {
    if (isDaily) return new Date(key + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' });
    return labelSet.has(i) ? weekLabel(key) : null;
  }

  const summary = volumeSummary({ mins, period });
  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginBottom: 8, fontStyle: 'italic' }}>
        avg {timeStr(avgMin)} / {isDaily ? 'day' : 'week'} · {timeStr(totalMin)} total
      </Text>
      {width > 0 && (
        <View accessible accessibilityRole="image" accessibilityLabel={summary}>
          <Svg width={width} height={H} viewBox={`0 0 ${width} ${H}`}>
          {mins.map((m, i) => {
            const barH = maxBarH * (m / maxMin);
            const x = i * (barW + barGap);
            const y = padT + maxBarH - barH;
            const isMax = m === maxMin && m > 0;
            return (
              <G key={i}>
                <Path
                  d={`M${x},${y} h${barW} v${barH} h${-barW} Z`}
                  fill={isMax ? COLOURS.steel : COLOURS.steelA(0.38)}
                />
                {isMax && (
                  <SvgText x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize="11" fill={COLOURS.text} fontFamily="Lato">
                    {timeStr(m)}
                  </SvgText>
                )}
              </G>
            );
          })}
          <Line x1={0} y1={avgY} x2={width} y2={avgY} stroke={COLOURS.amber} strokeWidth="1" strokeDasharray="3,3" />
          <SvgText x={width - 2} y={avgY - 3} textAnchor="end" fontSize="10" fill={COLOURS.amber} fontFamily="Lato">avg</SvgText>
          {visible.map((key, i) => {
            const label = xLabel(key, i);
            if (!label) return null;
            const x = i * (barW + barGap) + barW / 2;
            return (
              <SvgText key={key} x={x} y={H - 4} textAnchor={labelAnchor(x, width)} fontSize="11" fill={COLOURS.textDim} fontFamily="Lato">{label}</SvgText>
            );
          })}
        </Svg>
        </View>
      )}
      {!isDaily && visible.length < 2 && (
        <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.textDim, marginTop: 6 }}>
          Bars build up week by week; trends appear once there's a second week of data.
        </Text>
      )}
    </View>
  );
}

export function WeeklyTrendChart({ sessions, period }) {
  const [width, setWidth] = useState(0);
  const isDaily = period === '7d';

  const today = todayISO();
  const { visible, energyPts, likingPts } = useMemo(() => trendBuckets(sessions, period, today), [sessions, period, today]);

  const hasData = energyPts.some(v => v !== null) || likingPts.some(v => v !== null);
  if (!hasData) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.textDim }}>Not enough data yet.</Text>
  );

  const H = 160;
  const padL = 28, padR = 28, padT = 10, padB = 24;
  // x for point i. With a single point there is no (n - 1) to divide by, which used to
  // give NaN and draw the dot and its label clipped at the left edge; centre it instead.
  const xAt = i => (visible.length < 2
    ? padL + (width - padL - padR) / 2
    : padL + (i / (visible.length - 1)) * (width - padL - padR));

  // Each series normalised independently to the same pixel range
  function toYEnergy(val) {
    if (val === null) return null;
    return padT + (1 - (val - (-2)) / (2 - (-2))) * (H - padT - padB);
  }
  function toYLiking(val) {
    if (val === null) return null;
    return padT + (1 - (val - 1) / (5 - 1)) * (H - padT - padB);
  }

  function buildPath(pts, toY) {
    const validPts = pts.map((v, i) => ({ v, i })).filter(p => p.v !== null);
    if (validPts.length < 2) return '';
    return validPts.map(({ v, i }, idx) => {
      const x = xAt(i);
      const y = toY(v);
      return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  const energyPath = buildPath(energyPts, toYEnergy);
  const likingPath = buildPath(likingPts, toYLiking);

  const labelSet = isDaily ? null : labelIndices(visible.length, width - padL - padR);
  function xLabel(key, i) {
    if (isDaily) {
      return new Date(key + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' });
    }
    return labelSet.has(i) ? weekLabel(key) : null;
  }

  const summary = trendSummary({ energyPts, likingPts, period });
  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 20, height: 2, backgroundColor: COLOURS.amber, borderRadius: 1 }} />
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>⚡ Energy</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 20, height: 2, backgroundColor: LIKING_LINE, borderRadius: 1 }} />
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>❤️ Liking</Text>
        </View>
      </View>

      {width > 0 && (
        <View accessible accessibilityRole="image" accessibilityLabel={summary}>
          <Svg width={width} height={H} viewBox={`0 0 ${width} ${H}`}>
          {/* Left axis — energy (−2…+2) */}
          {[-2, -1, 0, 1, 2].map(v => (
            <SvgText key={v} x={padL - 4} y={toYEnergy(v) + 3} textAnchor="end" fontSize="11" fill={COLOURS.amber} fontFamily="Lato">{v > 0 ? `+${v}` : v}</SvgText>
          ))}
          {/* Right axis — liking (1…5) */}
          {[1, 2, 3, 4, 5].map(v => (
            <SvgText key={v} x={width - padR + 4} y={toYLiking(v) + 3} textAnchor="start" fontSize="11" fill={LIKING_LINE} fontFamily="Lato">{v}</SvgText>
          ))}
          {/* Zero line for energy */}
          <Line x1={padL} y1={toYEnergy(0)} x2={width - padR} y2={toYEnergy(0)} stroke={COLOURS.glassBorderSubtle} strokeWidth="1" strokeDasharray="3,3" />
          {energyPath ? <Path d={energyPath} fill="none" stroke={COLOURS.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {energyPts.map((v, i) => {
            if (v === null) return null;
            const x = xAt(i);
            return <Circle key={`e${i}`} cx={x} cy={toYEnergy(v)} r={3} fill={COLOURS.amber} />;
          })}
          {likingPath ? <Path d={likingPath} fill="none" stroke={LIKING_LINE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {likingPts.map((v, i) => {
            if (v === null) return null;
            const x = xAt(i);
            return <Path key={`l${i}`} d={diamondPath(x, toYLiking(v))} fill={LIKING_LINE} />;
          })}
          {visible.map((key, i) => {
            const label = xLabel(key, i);
            if (!label) return null;
            const x = xAt(i);
            return (
              <SvgText key={key} x={x} y={H - 4} textAnchor={labelAnchor(x, width)} fontSize="11" fill={COLOURS.textDim} fontFamily="Lato">{label}</SvgText>
            );
          })}
        </Svg>
        </View>
      )}
      {!isDaily && visible.length < 2 && (
        <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.textDim, marginTop: 6 }}>
          A trend line appears once you have a second week of data.
        </Text>
      )}
    </View>
  );
}

// ─── Energy vs Duration scatter plot ───────────────────────────────

export function ScatterPlot({ sessions }) {
  const [width, setWidth] = useState(0);
  const H = 160;
  const padL = 24, padR = 10, padT = 8, padB = 24;

  const pts = sessions
    .filter(s => s.duration && s.energy != null)
    .map(s => ({ x: Number(s.duration), y: Number(s.energy) }));

  if (pts.length < 3) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.textDim }}>Not enough data yet.</Text>
  );

  const maxDur = Math.max(...pts.map(p => p.x), 1);
  const toX = v => padL + ((v / maxDur) * (width - padL - padR));
  const toY = v => padT + ((1 - (v + 2) / 4) * (H - padT - padB));

  // Simple linear regression
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  const num = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const den = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  const slope = den ? num / den : 0;
  const intercept = my - slope * mx;
  const trend = slope > 0.005 ? 'longer sessions → higher energy ↗' :
                slope < -0.005 ? 'longer sessions → lower energy ↘' :
                'no clear correlation';

  const summary = scatterSummary(pts, slope);
  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginBottom: 8, fontStyle: 'italic' }}>{trend}</Text>
      {width > 0 && (
        <View accessible accessibilityRole="image" accessibilityLabel={summary}>
          <Svg width={width} height={H} viewBox={`0 0 ${width} ${H}`}>
          {/* Y-axis labels */}
          {[-2, -1, 0, 1, 2].map(v => (
            <SvgText key={v} x={padL - 4} y={toY(v) + 3} textAnchor="end" fontSize="10" fill={COLOURS.textDim} fontFamily="Lato">{v > 0 ? `+${v}` : v}</SvgText>
          ))}
          {/* Zero line */}
          <Line x1={padL} y1={toY(0)} x2={width - padR} y2={toY(0)} stroke={COLOURS.glassBorderSubtle} strokeWidth="1" strokeDasharray="3,3" />
          {/* Trend line */}
          {den > 0 && (
            <Line
              x1={toX(0)} y1={toY(intercept)}
              x2={toX(maxDur)} y2={toY(slope * maxDur + intercept)}
              stroke={COLOURS.navy} strokeWidth="1" strokeDasharray="4,3" opacity={0.4}
            />
          )}
          {/* Dots */}
          {pts.map((p, i) => (
            <Circle key={i} cx={toX(p.x)} cy={toY(p.y)} r={4}
              fill={energyColours(COLOURS.isDark)[String(Math.round(p.y))] || COLOURS.steel}
              opacity={0.75}
            />
          ))}
          {/* X-axis label */}
          <SvgText x={width / 2} y={H - 2} textAnchor="middle" fontSize="11" fill={COLOURS.textDim} fontFamily="Lato">duration (min)</SvgText>
        </Svg>
        </View>
      )}
      {/* Legend */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {['-2','-1','0','1','2'].map(v => (
          <View key={v} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: energyColours(COLOURS.isDark)[v] }} />
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>{v > 0 ? `+${v}` : v}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function DayOfWeekChart({ sessions }) {
  const [width, setWidth] = useState(0);
  const { byDay, maxCount, bestDay } = useMemo(() => dayOfWeekBuckets(sessions), [sessions]);

  if (sessions.length < 7) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.textDim }}>Not enough data yet.</Text>
  );

  const H = 160;
  const padL = 0, padR = 0, padT = 16, padB = 36;
  const barW = width > 0 ? Math.floor((width - padL - padR) / 7) : 0;
  const maxBarH = H - padT - padB;

  const summary = dayOfWeekSummary(byDay, bestDay);
  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginBottom: 10, fontStyle: 'italic' }}>
        Most active: {DOW_LABELS[bestDay]} ({byDay[bestDay].count} sessions)
      </Text>
      {width > 0 && (
        <View accessible accessibilityRole="image" accessibilityLabel={summary}>
          <Svg width={width} height={H} viewBox={`0 0 ${width} ${H}`}>
          {byDay.map((d, i) => {
            const barH  = maxBarH * (d.count / maxCount);
            const x     = padL + i * barW;
            const y     = padT + maxBarH - barH;
            const avgE  = d.energy.length ? d.energy.reduce((a, v) => a + v, 0) / d.energy.length : null;
            const alpha = 0.35 + 0.65 * (d.count / maxCount);
            const fill  = i === bestDay
              ? COLOURS.amber
              : COLOURS.steelA(alpha.toFixed(2));
            return (
              <G key={i}>
                {/* Bar */}
                <Path
                  d={`M${x + 4},${y} h${barW - 8} v${barH} h${-(barW - 8)} Z`}
                  fill={fill}
                  opacity={0.9}
                />
                {/* Session count above bar */}
                {d.count > 0 && (
                  <SvgText
                    x={x + barW / 2} y={y - 3}
                    textAnchor="middle" fontSize="11"
                    fill={COLOURS.text} fontFamily="Lato"
                  >{d.count}</SvgText>
                )}
                {/* Avg energy number — row 1 below bars */}
                {avgE !== null && (
                  <SvgText
                    x={x + barW / 2} y={H - padB + 14}
                    textAnchor="middle" fontSize="11"
                    fill={avgE >= 0 ? COLOURS.amber : COLOURS.red}
                    fontFamily="Lato"
                  >{avgE >= 0 ? `+${avgE.toFixed(1)}` : avgE.toFixed(1)}</SvgText>
                )}
                {/* Day label — row 2, always visible */}
                <SvgText
                  x={x + barW / 2} y={H - 4}
                  textAnchor="middle" fontSize="12"
                  fill={i === bestDay ? COLOURS.navy : COLOURS.textDim}
                  fontWeight={i === bestDay ? '700' : '400'}
                  fontFamily="Lato"
                >{DOW_LABELS[i]}</SvgText>
              </G>
            );
          })}
        </Svg>
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: COLOURS.amber }} />
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>most active day</Text>
        </View>
        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, fontStyle: 'italic' }}>numbers = avg energy</Text>
      </View>
    </View>
  );
}
