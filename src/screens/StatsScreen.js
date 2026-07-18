import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, STATUS_COLOURS } from '../theme';
import { GlassCard, SectionTitle, Label, Divider } from '../components/UI';
import { STATUS_OPTIONS } from '../constants';
import Svg, { Path, Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { scaleName } from '../utils';

const STATUS_EMOJI = {
  new:                 '🌿',
  learning:            '🌱',
  consolidating:       '💧',
  'performance-ready': '✨',
  shelved:             '📦',
  ambition:            '🌟',
};

// ─── Activity grid (Jan–Dec calendar year) ──────────────────────────────────

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS   = ['M','T','W','T','F','S','S'];
const GAP = 2;

function cellColor(duration) {
  if (!duration)      return null; // empty — handled by caller
  if (duration < 20)  return 'rgba(140,32,69,0.25)';
  if (duration < 40)  return 'rgba(140,32,69,0.50)';
  if (duration < 60)  return 'rgba(140,32,69,0.75)';
  return '#8C2045';
}

function buildYear(year, dateMap) {
  // Returns array of 12 months, each an array of weeks, each an array of 7 days (Mon–Sun)
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const months = [];

  for (let m = 0; m < 12; m++) {
    const firstDay = new Date(year, m, 1);
    const lastDay  = new Date(year, m + 1, 0);
    // offset so week starts on Monday
    const startOffset = (firstDay.getDay() + 6) % 7;
    const weeks = [];
    let week = Array(startOffset).fill(null);

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, m, d);
      const iso  = date.toISOString().slice(0, 10);
      const isFuture = iso > todayISO;
      week.push({ iso, duration: isFuture ? -1 : (dateMap[iso] || 0), isFuture });
      if (week.length === 7) { weeks.push(week); week = []; }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    months.push(weeks);
  }
  return months;
}

function ActivityGrid({ sessions, lessons }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [width, setWidth] = useState(0);
  const [mode, setMode] = useState('both'); // 'both' | 'practice' | 'lessons'

  // Gate each dataset on the selected mode so the grid can isolate one type
  const dateMap = {};
  if (mode !== 'lessons') {
    sessions.forEach(s => {
      dateMap[s.date] = (dateMap[s.date] || 0) + (Number(s.duration) || 0);
    });
  }

  const lessonDates = mode !== 'practice' ? new Set((lessons || []).map(l => l.date)) : new Set();

  const months = buildYear(year, dateMap);

  // Cell size: fit 12 months × (max 6 weeks) + 11 gaps between months into width
  // Each month takes (weeks * (cell+GAP) - GAP), but we size by max weeks = 6
  // Total = 12 * (6*cell + 5*GAP) + 11 * monthGap
  const MONTH_GAP = 6;
  const maxWeeks  = 6;
  // cell = (width - 11*MONTH_GAP - 12*(5*GAP)) / (12 * 6)
  const cell = width > 0
    ? Math.max(4, Math.floor((width - 11 * MONTH_GAP - 12 * 5 * GAP) / (12 * maxWeeks)))
    : 11;

  const totalHeight = 7 * (cell + GAP) - GAP;
  const dayLabelW   = cell + 2;

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {/* View mode toggle */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
        {[
          { key: 'both', label: 'Both' },
          { key: 'practice', label: '🎹 Practice' },
          { key: 'lessons', label: '🎓 Lessons' },
        ].map(m => {
          const active = mode === m.key;
          return (
            <TouchableOpacity key={m.key} onPress={() => setMode(m.key)} activeOpacity={0.75}
              style={{
                paddingHorizontal: 11, paddingVertical: 5, borderRadius: RADIUS.pill,
                backgroundColor: active ? COLOURS.navy : 'rgba(255,255,255,0.55)',
                shadowColor: active ? COLOURS.glassShadowMd : COLOURS.glassShadow,
                shadowOffset: { width: 0, height: active ? 3 : 1 },
                shadowOpacity: 1, shadowRadius: active ? 8 : 4, elevation: active ? 3 : 1,
              }}>
              <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: 12, color: active ? '#fff' : COLOURS.textMuted }}>{m.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Year picker */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 18, color: COLOURS.text }}>{year}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableYear onPress={() => setYear(y => y - 1)} label="‹" />
          {year < currentYear && <TouchableYear onPress={() => setYear(y => y + 1)} label="›" />}
        </View>
      </View>

      {width > 0 && (
        <View style={{ flexDirection: 'row', gap: MONTH_GAP }}>
          {months.map((weeks, mi) => {
            const monthW = weeks.length * (cell + GAP) - GAP;
            return (
              <View key={mi} style={{ width: monthW }}>
                {/* Month label */}
                <Text style={{
                  fontFamily: 'Lato-Bold', fontSize: Math.max(7, cell - 2),
                  color: COLOURS.textDim, letterSpacing: 0.2,
                  marginBottom: 4, textAlign: 'center',
                }}>{MONTHS_SHORT[mi]}</Text>

                {/* Week columns */}
                <View style={{ flexDirection: 'row', gap: GAP }}>
                  {weeks.map((week, wi) => (
                    <View key={wi} style={{ gap: GAP }}>
                      {week.map((day, di) => {
                        if (!day) return <View key={di} style={{ width: cell, height: cell }} />;
                        const isLesson = lessonDates.has(day.iso);
                        const isToday = day.iso === new Date().toISOString().slice(0, 10);
                        const color = day.isFuture
                          ? 'rgba(0,0,0,0.05)'
                          : isLesson
                            ? day.duration > 0
                              ? `rgba(247,127,0,${0.45 + Math.min(0.55, day.duration / 120)})`
                              : 'rgba(247,127,0,0.45)'
                            : cellColor(day.duration) || 'rgba(140,32,69,0.07)';
                        return (
                          <View key={di} style={{
                            width: cell, height: cell,
                            borderRadius: Math.max(1, cell * 0.2),
                            backgroundColor: color,
                            borderWidth: isToday ? 1 : 0,
                            borderColor: COLOURS.navy,
                          }} />
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Legend */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, justifyContent: 'flex-end' }}>
        {mode !== 'lessons' && (
          <>
            <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim, marginRight: 2 }}>Less</Text>
            {[0, 15, 35, 55, 75].map(d => (
              <View key={d} style={{
                width: cell, height: cell,
                borderRadius: Math.max(1, cell * 0.2),
                backgroundColor: d === 0 ? 'rgba(140,32,69,0.07)' : cellColor(d),
              }} />
            ))}
            <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim, marginLeft: 2, marginRight: mode !== 'practice' ? 8 : 0 }}>More</Text>
          </>
        )}
        {mode !== 'practice' && (
          <>
            <View style={{ width: cell, height: cell, borderRadius: Math.max(1, cell * 0.2), backgroundColor: 'rgba(247,127,0,0.55)' }} />
            <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim }}>Lesson</Text>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Half-fill Zelda bar ─────────────────────────────────────────────────────
// Renders emoji icons with precise fractional fill using overlapping clipped text.
// `fill` is 0–5 (can be fractional, e.g. 3.5)

function ZeldaBarFractional({ emoji, fill, total = 5, size = 22 }) {
  return (
    <View style={{ flexDirection: 'row', position: 'relative' }}>
      {/* Dim base row */}
      {Array.from({ length: total }, (_, i) => (
        <Text key={i} style={{ fontSize: size, opacity: 0.18 }}>{emoji}</Text>
      ))}
      {/* Filled overlay — clipped to fill width */}
      <View style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${(fill / total) * 100}%`,
        overflow: 'hidden',
        flexDirection: 'row',
      }}>
        {Array.from({ length: total }, (_, i) => (
          <Text key={i} style={{ fontSize: size }}>{emoji}</Text>
        ))}
      </View>
    </View>
  );
}

// ─── Trend chart (daily for 7d, weekly for 30d/all) ──────────────────────────

function getISOWeek(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function weekLabel(isoWeek) {
  const [year, w] = isoWeek.split('-W');
  const jan4 = new Date(Number(year), 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1) + (Number(w) - 1) * 7);
  return monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Practice volume chart ───────────────────────────────────────────────────

function PracticeVolumeChart({ sessions, period }) {
  const [width, setWidth] = useState(0);
  const isDaily = period === '7d';

  const cutoff = (() => {
    if (period === 'all') return null;
    const d = new Date();
    d.setDate(d.getDate() - (isDaily ? 7 : 30));
    return d.toISOString().slice(0, 10);
  })();

  const buckets = {};
  if (isDaily) {
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      buckets[d.toISOString().slice(0, 10)] = 0;
    }
  }
  sessions.forEach(s => {
    if (cutoff && s.date < cutoff) return;
    const key = isDaily ? s.date : getISOWeek(s.date);
    buckets[key] = (buckets[key] || 0) + (Number(s.duration) || 0);
  });

  const keys = Object.keys(buckets).sort();
  const MAX_WEEKS = period === 'all' ? keys.length : 12;
  const visible = isDaily ? keys : keys.slice(-MAX_WEEKS);
  const mins = visible.map(k => buckets[k] || 0);

  if (mins.every(v => v === 0)) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 14, color: COLOURS.textDim }}>Not enough data yet.</Text>
  );

  const maxMin = Math.max(...mins, 1);
  const activeMins = mins.filter(v => v > 0);
  const avgMin = activeMins.length ? Math.round(activeMins.reduce((a, v) => a + v, 0) / activeMins.length) : 0;
  const totalMin = mins.reduce((a, v) => a + v, 0);
  const timeStr = m => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;

  const H = 160;
  const padT = 16, padB = 20;
  const barGap = 2;
  const barW = width > 0 ? Math.max(4, Math.floor((width - (visible.length - 1) * barGap) / visible.length)) : 0;
  const maxBarH = H - padT - padB;
  const avgY = padT + (1 - avgMin / maxMin) * maxBarH;

  function xLabel(key, i) {
    if (isDaily) return new Date(key + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' });
    const step = visible.length > 8 ? 3 : 2;
    if (i % step !== 0 && i !== visible.length - 1) return null;
    return weekLabel(key);
  }

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginBottom: 8, fontStyle: 'italic' }}>
        avg {timeStr(avgMin)} / {isDaily ? 'day' : 'week'} · {timeStr(totalMin)} total
      </Text>
      {width > 0 && (
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
                  fill={isMax ? COLOURS.steel : 'rgba(8,131,149,0.38)'}
                />
                {isMax && (
                  <SvgText x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize="8" fill={COLOURS.text} fontFamily="Lato">
                    {timeStr(m)}
                  </SvgText>
                )}
              </G>
            );
          })}
          <Line x1={0} y1={avgY} x2={width} y2={avgY} stroke={COLOURS.amber} strokeWidth="1" strokeDasharray="3,3" />
          <SvgText x={width - 2} y={avgY - 3} textAnchor="end" fontSize="7" fill={COLOURS.amber} fontFamily="Lato">avg</SvgText>
          {visible.map((key, i) => {
            const label = xLabel(key, i);
            if (!label) return null;
            const x = i * (barW + barGap) + barW / 2;
            return (
              <SvgText key={key} x={x} y={H - 4} textAnchor="middle" fontSize="8" fill={COLOURS.textDim} fontFamily="Lato">{label}</SvgText>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

function WeeklyTrendChart({ sessions, period }) {
  const [width, setWidth] = useState(0);
  const isDaily = period === '7d';

  const cutoff = (() => {
    if (period === 'all') return null;
    const d = new Date();
    d.setDate(d.getDate() - (isDaily ? 7 : 30));
    return d.toISOString().slice(0, 10);
  })();

  // Build buckets — daily ISO string for 7d, ISO week key for 30d/all
  const buckets = {};

  if (isDaily) {
    // Pre-fill all 7 days so gaps (no session) still appear as null points
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      buckets[d.toISOString().slice(0, 10)] = { energy: [], liking: [] };
    }
  }

  sessions.forEach(s => {
    if (cutoff && s.date < cutoff) return;
    const key = isDaily ? s.date : getISOWeek(s.date);
    if (!buckets[key]) buckets[key] = { energy: [], liking: [] };
    if (s.energy != null) buckets[key].energy.push(Number(s.energy));
    (s.segments || []).forEach(seg => {
      if (seg.type === 'repertoire' && seg.liking) buckets[key].liking.push(Number(seg.liking));
    });
  });

  const keys = Object.keys(buckets).sort();
  const MAX_WEEKS = period === 'all' ? keys.length : 12;
  const visible = isDaily ? keys : keys.slice(-MAX_WEEKS);

  const energyPts = visible.map(k => {
    const arr = buckets[k]?.energy || [];
    return arr.length ? arr.reduce((a, v) => a + v, 0) / arr.length : null;
  });
  const likingPts = visible.map(k => {
    const arr = buckets[k]?.liking || [];
    return arr.length ? arr.reduce((a, v) => a + v, 0) / arr.length : null;
  });

  const hasData = energyPts.some(v => v !== null) || likingPts.some(v => v !== null);
  if (!hasData) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 14, color: COLOURS.textDim }}>Not enough data yet.</Text>
  );

  const H = 160;
  const padL = 28, padR = 28, padT = 10, padB = 24;

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
      const x = padL + (i / (visible.length - 1)) * (width - padL - padR);
      const y = toY(v);
      return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  const energyPath = buildPath(energyPts, toYEnergy);
  const likingPath = buildPath(likingPts, toYLiking);

  function xLabel(key, i) {
    if (isDaily) {
      return new Date(key + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' });
    }
    const step = visible.length > 8 ? 3 : 2;
    if (i % step !== 0 && i !== visible.length - 1) return null;
    return weekLabel(key);
  }

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 20, height: 2, backgroundColor: COLOURS.amber, borderRadius: 1 }} />
          <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim }}>⚡ Energy</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 20, height: 2, backgroundColor: '#E87EA1', borderRadius: 1 }} />
          <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim }}>❤️ Liking</Text>
        </View>
      </View>

      {width > 0 && (
        <Svg width={width} height={H} viewBox={`0 0 ${width} ${H}`}>
          {/* Left axis — energy (−2…+2) */}
          {[-2, -1, 0, 1, 2].map(v => (
            <SvgText key={v} x={padL - 4} y={toYEnergy(v) + 3} textAnchor="end" fontSize="8" fill={COLOURS.amber} fontFamily="Lato">{v > 0 ? `+${v}` : v}</SvgText>
          ))}
          {/* Right axis — liking (1…5) */}
          {[1, 2, 3, 4, 5].map(v => (
            <SvgText key={v} x={width - padR + 4} y={toYLiking(v) + 3} textAnchor="start" fontSize="8" fill="#E87EA1" fontFamily="Lato">{v}</SvgText>
          ))}
          {/* Zero line for energy */}
          <Line x1={padL} y1={toYEnergy(0)} x2={width - padR} y2={toYEnergy(0)} stroke={COLOURS.glassBorderSubtle} strokeWidth="1" strokeDasharray="3,3" />
          {energyPath ? <Path d={energyPath} fill="none" stroke={COLOURS.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {energyPts.map((v, i) => {
            if (v === null) return null;
            const x = padL + (i / (visible.length - 1)) * (width - padL - padR);
            return <Circle key={`e${i}`} cx={x} cy={toYEnergy(v)} r={3} fill={COLOURS.amber} />;
          })}
          {likingPath ? <Path d={likingPath} fill="none" stroke="#E87EA1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {likingPts.map((v, i) => {
            if (v === null) return null;
            const x = padL + (i / (visible.length - 1)) * (width - padL - padR);
            return <Circle key={`l${i}`} cx={x} cy={toYLiking(v)} r={3} fill="#E87EA1" />;
          })}
          {visible.map((key, i) => {
            const label = xLabel(key, i);
            if (!label) return null;
            const x = padL + (i / (visible.length - 1)) * (width - padL - padR);
            return (
              <SvgText key={key} x={x} y={H - 4} textAnchor="middle" fontSize="8" fill={COLOURS.textDim} fontFamily="Lato">{label}</SvgText>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

// ─── Energy vs Duration scatter plot ───────────────────────────────

const ENERGY_COLOURS = {
  '-2': '#8C2045', '-1': '#B85C7A', '0': '#7AB2B2', '1': '#F77F00', '2': '#FCBF49',
};

function ScatterPlot({ sessions }) {
  const [width, setWidth] = useState(0);
  const H = 160;
  const padL = 24, padR = 10, padT = 8, padB = 24;

  const pts = sessions
    .filter(s => s.duration && s.energy != null)
    .map(s => ({ x: Number(s.duration), y: Number(s.energy) }));

  if (pts.length < 3) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 14, color: COLOURS.textDim }}>Not enough data yet.</Text>
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

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginBottom: 8, fontStyle: 'italic' }}>{trend}</Text>
      {width > 0 && (
        <Svg width={width} height={H} viewBox={`0 0 ${width} ${H}`}>
          {/* Y-axis labels */}
          {[-2, -1, 0, 1, 2].map(v => (
            <SvgText key={v} x={padL - 4} y={toY(v) + 3} textAnchor="end" fontSize="7" fill={COLOURS.textDim} fontFamily="Lato">{v > 0 ? `+${v}` : v}</SvgText>
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
              fill={ENERGY_COLOURS[String(Math.round(p.y))] || COLOURS.steel}
              opacity={0.75}
            />
          ))}
          {/* X-axis label */}
          <SvgText x={width / 2} y={H - 2} textAnchor="middle" fontSize="8" fill={COLOURS.textDim} fontFamily="Lato">duration (min)</SvgText>
        </Svg>
      )}
      {/* Legend */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {['-2','-1','0','1','2'].map(v => (
          <View key={v} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ENERGY_COLOURS[v] }} />
            <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim }}>{v > 0 ? `+${v}` : v}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Wins timeline ────────────────────────────────────────────────────

// ─── Neglected pieces ─────────────────────────────────────────────────────

function NeglectedPieces({ sessions, compositions }) {
  const today = new Date();

  // Count any segment linked to a composition, whether logged as repertoire
  // or as technique (e.g. Hanon linked as a library piece) — both count as
  // "worked on it" for neglect purposes.
  const lastSeen = {};
  sessions.forEach(s => {
    (s.segments || []).forEach(seg => {
      if (!seg.compositionId) return;
      if (!lastSeen[seg.compositionId] || s.date > lastSeen[seg.compositionId]) {
        lastSeen[seg.compositionId] = s.date;
      }
    });
  });

  const ACTIVE = new Set(['learning', 'consolidating']);
  const neglected = compositions
    .filter(c => ACTIVE.has(c.status))
    .map(c => {
      const last = lastSeen[c.id] || null;
      const daysSince = last
        ? Math.floor((today - new Date(last + 'T12:00:00')) / 86400000)
        : null;
      return { id: c.id, title: c.title, status: c.status, daysSince };
    })
    .filter(p => p.daysSince === null || p.daysSince >= 7)
    .sort((a, b) => {
      if (a.daysSince === null) return -1;
      if (b.daysSince === null) return 1;
      return b.daysSince - a.daysSince;
    });

  if (neglected.length === 0) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 14, color: COLOURS.textDim }}>
      All active pieces practised in the last 7 days.
    </Text>
  );

  function urgencyColour(d) {
    if (d === null || d >= 21) return COLOURS.red;
    if (d >= 14) return COLOURS.amber;
    return COLOURS.steel;
  }

  function sinceLabel(d) {
    if (d === null) return 'never practised';
    return `${d} day${d === 1 ? '' : 's'} ago`;
  }

  return (
    <View>
      {neglected.map(({ id, title, status, daysSince }) => (
        <View key={id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 }}>
          <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: urgencyColour(daysSince) }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 15, color: COLOURS.text }} numberOfLines={1}>
              📜 {title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
              <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: STATUS_COLOURS[status]?.bg || COLOURS.tealAccent }}>
                <Text style={{ fontFamily: 'Lato', fontSize: 11, color: STATUS_COLOURS[status]?.text || COLOURS.navy }}>{status}</Text>
              </View>
              <Text style={{ fontFamily: 'Lato', fontSize: 11, color: urgencyColour(daysSince), fontStyle: 'italic' }}>
                {sinceLabel(daysSince)}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function WinsTimeline({ sessions, period }) {
  const cutoff = (() => {
    if (period === 'all') return null;
    const d = new Date();
    d.setDate(d.getDate() - (period === '7d' ? 7 : 30));
    return d.toISOString().slice(0, 10);
  })();

  const wins = sessions
    .filter(s => s.wins && s.wins.trim() && (!cutoff || s.date >= cutoff))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  if (wins.length === 0) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 14, color: COLOURS.textDim }}>No wins logged in this period.</Text>
  );

  return (
    <View>
      {wins.map((s, i) => (
        <View key={s.id || i} style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <View style={{ alignItems: 'center', width: 32 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLOURS.gold, marginTop: 4 }} />
            {i < wins.length - 1 && <View style={{ width: 1, flex: 1, backgroundColor: COLOURS.glassBorderSubtle, marginTop: 4 }} />}
          </View>
          <View style={{ flex: 1, paddingBottom: 4 }}>
            <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginBottom: 3 }}>
              {new Date(s.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </Text>
            <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 14, color: COLOURS.text, lineHeight: 20 }}>“{s.wins}”</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Streak history ─────────────────────────────────────────────────────

function StreakHistory({ sessions }) {
  // Find all streaks (runs of consecutive practice days) across all time
  const dates = [...new Set(sessions.map(s => s.date))].sort();
  if (dates.length === 0) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 14, color: COLOURS.textDim }}>No sessions yet.</Text>
  );

  const streaks = [];
  let start = dates[0], prev = dates[0], len = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i] + 'T12:00:00') - new Date(prev + 'T12:00:00')) / 86400000;
    if (diff === 1) { len++; prev = dates[i]; }
    else {
      if (len > 1) streaks.push({ start, end: prev, len });
      start = dates[i]; prev = dates[i]; len = 1;
    }
  }
  if (len > 1) streaks.push({ start, end: prev, len });

  if (streaks.length === 0) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 14, color: COLOURS.textDim }}>No streaks of 2+ days yet.</Text>
  );

  const maxLen = Math.max(...streaks.map(s => s.len));
  const visible = streaks.sort((a, b) => b.len - a.len).slice(0, 6);

  return (
    <View>
      {visible.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <View style={{ width: 28, alignItems: 'center' }}>
            <Text style={{ fontSize: i === 0 ? 20 : 16 }}>{i === 0 ? '🔥' : '⭐'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim }}>
                {new Date(s.start + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                {' → '}
                {new Date(s.end + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </Text>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.navy }}>{s.len} days</Text>
            </View>
            <View style={{ height: 4, backgroundColor: COLOURS.glassBorderSubtle, borderRadius: 2 }}>
              <View style={{ height: '100%', width: `${(s.len / maxLen) * 100}%`, backgroundColor: i === 0 ? COLOURS.amber : COLOURS.steel, borderRadius: 2 }} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Lesson insights ────────────────────────────────────────────────────────

function LessonInsights({ lessons, sessions, compositions, period }) {
  const cutoff = (() => {
    if (period === 'all') return null;
    const d = new Date();
    d.setDate(d.getDate() - (period === '7d' ? 7 : 30));
    return d.toISOString().slice(0, 10);
  })();

  const periodLessons = lessons.filter(l => !cutoff || l.date >= cutoff);

  if (periodLessons.length === 0) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 14, color: COLOURS.textDim }}>No lessons logged in this period.</Text>
  );

  // ── Avg energy & enjoyment ────────────────────────────────────────────────
  const energyVals    = periodLessons.filter(l => l.energy != null).map(l => Number(l.energy));
  const enjoymentVals = periodLessons.filter(l => l.enjoyment != null).map(l => Number(l.enjoyment));
  const avgEnergy    = energyVals.length    ? energyVals.reduce((a, v) => a + v, 0) / energyVals.length       : null;
  const avgEnjoyment = enjoymentVals.length ? enjoymentVals.reduce((a, v) => a + v, 0) / enjoymentVals.length : null;

  // ── Pieces covered in lessons ─────────────────────────────────────────────
  const lessonPieceCounts = {};
  periodLessons.forEach(l => {
    (l.segments || []).forEach(seg => {
      if (seg.type !== 'repertoire' || !seg.compositionId) return;
      lessonPieceCounts[seg.compositionId] = (lessonPieceCounts[seg.compositionId] || 0) + 1;
    });
  });

  const topLessonPieces = Object.entries(lessonPieceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({
      id,
      title: compositions.find(c => c.id === id)?.title || id,
      count,
    }));

  // ── Lesson-only pieces (never appeared in a practice session) ─────────────
  const sessionPieceIds = new Set(
    sessions.flatMap(s =>
      (s.segments || [])
        .filter(seg => seg.type === 'repertoire' && seg.compositionId)
        .map(seg => seg.compositionId)
    )
  );
  const lessonOnlyIds = Object.keys(lessonPieceCounts).filter(id => !sessionPieceIds.has(id));
  const lessonOnlyPieces = lessonOnlyIds
    .map(id => ({ id, title: compositions.find(c => c.id === id)?.title || id }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const maxCount = topLessonPieces[0]?.count || 1;

  return (
    <View>
      {/* Avg energy & enjoyment */}
      <View style={{ flexDirection: 'row', gap: 20, marginBottom: 16 }}>
        {avgEnergy !== null && (
          <View style={{ gap: 4 }}>
            <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6 }}>Avg energy</Text>
            <ZeldaBarFractional emoji="⚡" fill={avgEnergy + 3} size={16} />
          </View>
        )}
        {avgEnjoyment !== null && (
          <View style={{ gap: 4 }}>
            <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6 }}>Avg enjoyment</Text>
            <ZeldaBarFractional emoji="❤️" fill={avgEnjoyment} size={16} />
          </View>
        )}
        <View style={{ gap: 4 }}>
          <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6 }}>Lessons</Text>
          <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 22, color: COLOURS.navy }}>{periodLessons.length}</Text>
        </View>
      </View>

      {/* Most covered in lessons */}
      {topLessonPieces.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <Label>Most covered in lessons</Label>
          {topLessonPieces.map(({ id, title, count }) => (
            <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 15, color: COLOURS.text, flex: 1 }} numberOfLines={1}>📜 {title}</Text>
              <View style={{ width: 80, height: 6, backgroundColor: COLOURS.bg2, borderRadius: 3 }}>
                <View style={{ height: '100%', width: `${(count / maxCount) * 100}%`, backgroundColor: COLOURS.amber, borderRadius: 3 }} />
              </View>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.textDim, width: 24, textAlign: 'right' }}>{count}×</Text>
            </View>
          ))}
        </View>
      )}

      {/* Lesson-only pieces */}
      {lessonOnlyPieces.length > 0 && (
        <View>
          <Label>Lesson-only pieces</Label>
          <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginBottom: 8, fontStyle: 'italic' }}>Covered in lessons but not yet self-practised</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {lessonOnlyPieces.map(({ id, title }) => (
              <View key={id} style={{
                paddingHorizontal: 10, paddingVertical: 5,
                borderRadius: RADIUS.pill,
                backgroundColor: COLOURS.lessonBg,
                shadowColor: COLOURS.lessonBorder,
                shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 1,
              }}>
                <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.lessonText }}>📜 {title}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Library growth chart ─────────────────────────────────────────────────

function LibraryGrowthChart({ compositions }) {
  const [width, setWidth] = useState(0);
  const H = 150;
  const padL = 6, padR = 6, padT = 8, padB = 24;

  // Group by month added (createdAt or dateStarted)
  const byMonth = {};
  compositions.forEach(c => {
    const raw = c.createdAt || c.dateStarted || null;
    if (!raw) return;
    const month = raw.slice(0, 7); // 'YYYY-MM'
    byMonth[month] = (byMonth[month] || 0) + 1;
  });

  const months = Object.keys(byMonth).sort();
  if (months.length < 2) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 14, color: COLOURS.textDim }}>Not enough data yet.</Text>
  );

  // Cumulative totals
  let running = 0;
  const pts = months.map(m => { running += byMonth[m]; return { m, total: running, added: byMonth[m] }; });
  const maxTotal = pts[pts.length - 1].total;

  function toX(i) { return padL + (i / (pts.length - 1)) * (width - padL - padR); }
  function toY(v) { return padT + (1 - v / maxTotal) * (H - padT - padB); }

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.total).toFixed(1)}`).join(' ');

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginBottom: 8 }}>
        {compositions.length} piece{compositions.length !== 1 ? 's' : ''} total · {compositions.filter(c => c.status !== 'ambition' && c.status !== 'shelved').length} active
      </Text>
      {width > 0 && (
        <Svg width={width} height={H} viewBox={`0 0 ${width} ${H}`}>
          {/* Area fill */}
          <Path
            d={`${linePath} L${toX(pts.length - 1).toFixed(1)},${H - padB} L${toX(0).toFixed(1)},${H - padB} Z`}
            fill={COLOURS.amber}
            opacity={0.12}
          />
          {/* Line */}
          <Path d={linePath} fill="none" stroke={COLOURS.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {/* Dots */}
          {pts.map((p, i) => (
            <Circle key={i} cx={toX(i)} cy={toY(p.total)} r={3} fill={COLOURS.amber} />
          ))}
          {/* X-axis labels — every 2nd or 3rd month */}
          {pts.map((p, i) => {
            const step = pts.length > 8 ? 3 : 2;
            if (i % step !== 0 && i !== pts.length - 1) return null;
            return (
              <SvgText key={p.m} x={toX(i)} y={H - 4} textAnchor="middle" fontSize="8" fill={COLOURS.textDim} fontFamily="Lato">
                {new Date(p.m + '-15').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
              </SvgText>
            );
          })}
          {/* Y-axis max label */}
          <SvgText x={padL} y={padT + 6} textAnchor="start" fontSize="8" fill={COLOURS.textDim} fontFamily="Lato">{maxTotal}</SvgText>
        </Svg>
      )}
    </View>
  );
}

// ─── Technique breakdown ───────────────────────────────────────────────

function TechniqueBreakdown({ sessions }) {
  const groups = {};
  sessions.forEach(s => {
    (s.segments || []).forEach(seg => {
      if (seg.type !== 'technique') return;
      const g = seg.group || seg.title || 'Technique';
      if (!groups[g]) groups[g] = { count: 0, minutes: 0, difficulty: [] };
      groups[g].count++;
      groups[g].minutes += Number(seg.duration) || 0;
      if (seg.feltDifficulty) groups[g].difficulty.push(Number(seg.feltDifficulty));
    });
  });

  const sorted = Object.entries(groups).sort((a, b) => b[1].count - a[1].count);
  if (sorted.length === 0) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 14, color: COLOURS.textDim }}>No technique segments logged in this period.</Text>
  );

  const maxCount = sorted[0][1].count;
  const timeStr  = m => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;

  return (
    <View>
      {sorted.map(([name, data]) => {
        const avgDiff = data.difficulty.length
          ? data.difficulty.reduce((a, v) => a + v, 0) / data.difficulty.length
          : null;
        return (
          <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.text, flex: 1 }} numberOfLines={1}>{name}</Text>
            <View style={{ flex: 1, height: 14, backgroundColor: COLOURS.bg2, borderRadius: 7 }}>
              <View style={{ height: '100%', width: `${(data.count / maxCount) * 100}%`, backgroundColor: COLOURS.steel, borderRadius: 7 }} />
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3, width: 80, flexShrink: 0 }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.textDim }}>{data.count}×{data.minutes > 0 ? `  ⏱${timeStr(data.minutes)}` : ''}</Text>
              {avgDiff !== null && <View style={{ marginTop: 8 }}><ZeldaBarFractional emoji="🎵" fill={avgDiff} size={13} /></View>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Scale coverage — circle of fifths ───────────────────────────────────────

const COF_KEYS   = ['C','G','D','A','E','B','F#','Db','Ab','Eb','Bb','F'];
const COF_MINORS = ['Am','Em','Bm','F#m','C#m','G#m','D#m','Bbm','Fm','Cm','Gm','Dm'];

// Maps the scale label stored in session data to a COF key or minor key
// Built explicitly to avoid any root collision between major and minor
const SCALE_LABEL_TO_COF = {
  // Major
  'C major': 'C', 'G major': 'G', 'D major': 'D', 'A major': 'A',
  'E major': 'E', 'B major': 'B', 'F# major': 'F#', 'Gb major': 'F#', 'Db major': 'Db',
  'Ab major': 'Ab', 'Eb major': 'Eb', 'Bb major': 'Bb', 'F major': 'F',
  // Natural minor
  'A natural minor': 'Am', 'E natural minor': 'Em', 'B natural minor': 'Bm',
  'F# natural minor': 'F#m', 'C# natural minor': 'C#m', 'G# natural minor': 'G#m',
  'D# natural minor': 'D#m', 'Bb natural minor': 'Bbm', 'F natural minor': 'Fm',
  'C natural minor': 'Cm', 'G natural minor': 'Gm', 'D natural minor': 'Dm',
  // Harmonic minor
  'A harmonic minor': 'Am', 'E harmonic minor': 'Em', 'B harmonic minor': 'Bm',
  'F# harmonic minor': 'F#m', 'C# harmonic minor': 'C#m', 'G# harmonic minor': 'G#m',
  'D# harmonic minor': 'D#m', 'Bb harmonic minor': 'Bbm', 'F harmonic minor': 'Fm',
  'C harmonic minor': 'Cm', 'G harmonic minor': 'Gm', 'D harmonic minor': 'Dm',
  // Melodic minor
  'A melodic minor': 'Am', 'E melodic minor': 'Em', 'B melodic minor': 'Bm',
  'F# melodic minor': 'F#m', 'C# melodic minor': 'C#m', 'G# melodic minor': 'G#m',
  'D# melodic minor': 'D#m', 'Bb melodic minor': 'Bbm', 'F melodic minor': 'Fm',
  'C melodic minor': 'Cm', 'G melodic minor': 'Gm', 'D melodic minor': 'Dm',
};

function amberForCount(n, max) {
  if (!n) return 'rgba(180,178,170,0.22)';
  const t = n / Math.max(max, 1);
  if (t < 0.15) return '#FAEEDA';
  if (t < 0.35) return '#FAC775';
  if (t < 0.6)  return '#EF9F27';
  if (t < 0.85) return '#BA7517';
  return '#854F0B';
}
function tealForCount(n, max) {
  if (!n) return 'rgba(180,178,170,0.15)';
  const t = n / Math.max(max, 1);
  if (t < 0.1)  return '#E1F5EE';
  if (t < 0.3)  return '#9FE1CB';
  if (t < 0.55) return '#5DCAA5';
  if (t < 0.8)  return '#1D9E75';
  return '#0F6E56';
}

function cofArcPath(cx, cy, r1, r2, startDeg, endDeg) {
  const s = startDeg * Math.PI / 180;
  const e = endDeg   * Math.PI / 180;
  const x1 = cx + r1 * Math.cos(s), y1 = cy + r1 * Math.sin(s);
  const x2 = cx + r1 * Math.cos(e), y2 = cy + r1 * Math.sin(e);
  const x3 = cx + r2 * Math.cos(e), y3 = cy + r2 * Math.sin(e);
  const x4 = cx + r2 * Math.cos(s), y4 = cy + r2 * Math.sin(s);
  return `M${x1},${y1} A${r1},${r1} 0 0,1 ${x2},${y2} L${x3},${y3} A${r2},${r2} 0 0,0 ${x4},${y4} Z`;
}

function ScaleCoverage({ sessions }) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState(null);

  const scaleCounts = {};
  sessions.forEach(s => {
    (s.segments || []).forEach(seg => {
      if (seg.type !== 'technique') return;
      const cofKeys = [...new Set(
        (seg.scales || []).map(l => SCALE_LABEL_TO_COF[scaleName(l)]).filter(Boolean)
      )];
      if (cofKeys.length === 0) return;
      // Apportion duration evenly across distinct keys so total time isn't inflated
      const durPerKey = (Number(seg.duration) || 0) / cofKeys.length;
      cofKeys.forEach(cofKey => {
        if (!scaleCounts[cofKey]) scaleCounts[cofKey] = { sessions: 0, minutes: 0, difficulty: [] };
        scaleCounts[cofKey].sessions++;
        scaleCounts[cofKey].minutes += durPerKey;
        if (seg.feltDifficulty) scaleCounts[cofKey].difficulty.push(Number(seg.feltDifficulty));
      });
    });
  });

  const majorCounts = COF_KEYS.map(k => scaleCounts[k]?.sessions || 0);
  const minorCounts = COF_MINORS.map(k => scaleCounts[k]?.sessions || 0);
  const maxCount    = Math.max(...majorCounts, ...minorCounts, 1);

  const totalScaleMins = sessions.reduce((acc, s) =>
    acc + (s.segments || []).reduce((a, seg) =>
      seg.type === 'technique' && (seg.scales || []).some(l => SCALE_LABEL_TO_COF[scaleName(l)])
        ? a + (Number(seg.duration) || 0) : a, 0), 0);
  const totalScaleSess = Object.values(scaleCounts).reduce((a, v) => a + v.sessions, 0);
  const keysVisited    = [...majorCounts, ...minorCounts].filter(v => v > 0).length;
  const allDiffs       = Object.values(scaleCounts).flatMap(v => v.difficulty);
  const avgDiff        = allDiffs.length ? allDiffs.reduce((a, v) => a + v, 0) / allDiffs.length : null;
  const timeStr        = m => { const r = Math.round(m); return r >= 60 ? `${Math.floor(r / 60)}h ${r % 60}m` : `${r}m`; };

  // Difficulty as dot symbols for SVG — ● = full, ◐ = half, ○ = empty
  function diffNotes(val) {
    if (val === null) return '';
    const full  = Math.floor(val);
    const half  = (val - full) >= 0.4 ? 1 : 0;
    const empty = 5 - full - half;
    return '●'.repeat(full) + (half ? '◐' : '') + '○'.repeat(empty);
  }

  const size = width || 300;
  const cx = size / 2, cy = size / 2;
  const R1 = size * 0.46, R2 = size * 0.315, R3 = size * 0.18;

  const sel = selected;
  const selKey  = sel ? (sel.ring === 'major' ? COF_KEYS[sel.index] : COF_MINORS[sel.index]) : null;
  const selData = selKey ? scaleCounts[selKey] : null;
  const selAvgDiff = selData?.difficulty?.length
    ? selData.difficulty.reduce((a, v) => a + v, 0) / selData.difficulty.length
    : null;

  if (totalScaleSess === 0) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 14, color: COLOURS.textDim }}>No scales logged in this period.</Text>
  );

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <View style={{ position: 'relative', width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {COF_KEYS.map((key, i) => {
            const startDeg = -90 + i * 30 - 15;
            const endDeg   = startDeg + 30;
            const midDeg   = startDeg + 15;
            const midRad   = midDeg * Math.PI / 180;
            const majorSel = sel?.ring === 'major' && sel?.index === i;
            const minorSel = sel?.ring === 'minor' && sel?.index === i;
            return (
              <G key={key}>
                <Path
                  d={cofArcPath(cx, cy, R1, R2, startDeg, endDeg)}
                  fill={majorSel ? '#FCBF49' : amberForCount(majorCounts[i], maxCount)}
                  stroke="#fff" strokeWidth={2}
                  onPress={() => setSelected(majorSel ? null : { ring: 'major', index: i })}
                />
                <Path
                  d={cofArcPath(cx, cy, R2, R3, startDeg, endDeg)}
                  fill={minorSel ? '#1D9E75' : tealForCount(minorCounts[i], maxCount)}
                  stroke="#fff" strokeWidth={1.5}
                  onPress={() => setSelected(minorSel ? null : { ring: 'minor', index: i })}
                />
                <SvgText
                  x={cx + (R1 + R2) / 2 * Math.cos(midRad)}
                  y={cy + (R1 + R2) / 2 * Math.sin(midRad)}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={size * 0.038} fontWeight="500"
                  fill={COLOURS.text} fontFamily="Lato"
                >{key === 'F#' ? 'F#/Gb' : key}</SvgText>
                <SvgText
                  x={cx + (R2 + R3) / 2 * Math.cos(midRad)}
                  y={cy + (R2 + R3) / 2 * Math.sin(midRad)}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={size * 0.028}
                  fill={COLOURS.textDim} fontFamily="Lato"
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
              <SvgText x={cx} y={cy - size*0.068} textAnchor="middle" dominantBaseline="central"
                fontSize={size*0.034} fontWeight="500" fill={COLOURS.text} fontFamily="Lato">⏱ {timeStr(totalScaleMins)}</SvgText>
              <SvgText x={cx} y={cy - size*0.024} textAnchor="middle" dominantBaseline="central"
                fontSize={size*0.030} fill={COLOURS.textDim} fontFamily="Lato">total scale time</SvgText>
              <SvgText x={cx} y={cy + size*0.028} textAnchor="middle" dominantBaseline="central"
                fontSize={size*0.030} fontWeight="500" fill={COLOURS.text} fontFamily="Lato">⚡ {totalScaleSess} sessions</SvgText>
              <SvgText x={cx} y={cy + size*0.072} textAnchor="middle" dominantBaseline="central"
                fontSize={size*0.030} fontWeight="500" fill={COLOURS.text} fontFamily="Lato">{keysVisited}/24 keys</SvgText>

            </G>
          ) : (
            <G>
              <SvgText x={cx} y={cy - size*0.088} textAnchor="middle" dominantBaseline="central"
                fontSize={size*0.044} fontWeight="500" fill={COLOURS.text} fontFamily="CormorantGaramond">{selKey}</SvgText>
              <SvgText x={cx} y={cy - size*0.038} textAnchor="middle" dominantBaseline="central"
                fontSize={size*0.032} fill={COLOURS.textDim} fontFamily="Lato">{sel.ring === 'major' ? 'major' : 'minor'}</SvgText>
              <SvgText x={cx} y={cy + size*0.01} textAnchor="middle" dominantBaseline="central"
                fontSize={size*0.030} fontWeight="500" fill={COLOURS.text} fontFamily="Lato">⚡ {selData?.sessions || 0} sessions</SvgText>
              <SvgText x={cx} y={cy + size*0.052} textAnchor="middle" dominantBaseline="central"
                fontSize={size*0.032} fill={COLOURS.textDim} fontFamily="Lato">⏱ {timeStr(selData?.minutes || 0)}</SvgText>

            </G>
          )}
        </Svg>
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
              : <Text style={{ fontFamily: 'Lato', fontSize: size * 0.030, color: COLOURS.textDim, fontStyle: 'italic' }}>no difficulty data</Text>
            }
          </View>
        )}
        </View>
      )}

      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#EF9F27' }} />
          <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim }}>major</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#5DCAA5' }} />
          <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim }}>minor</Text>
        </View>
        <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, fontStyle: 'italic' }}>tap for details</Text>
      </View>
    </View>
  );
}

// ─── Day-of-week patterns ───────────────────────────────────────────────────

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function DayOfWeekChart({ sessions }) {
  const [width, setWidth] = useState(0);

  if (sessions.length < 7) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 14, color: COLOURS.textDim }}>Not enough data yet.</Text>
  );

  // Bucket all sessions by day of week (Mon=0 … Sun=6)
  const byDay = Array.from({ length: 7 }, () => ({ count: 0, minutes: 0, energy: [] }));
  sessions.forEach(s => {
    const dow = (new Date(s.date + 'T12:00:00').getDay() + 6) % 7; // Mon=0
    byDay[dow].count++;
    byDay[dow].minutes += Number(s.duration) || 0;
    if (s.energy != null) byDay[dow].energy.push(Number(s.energy));
  });

  const maxCount   = Math.max(...byDay.map(d => d.count), 1);
  const bestDay    = byDay.indexOf(byDay.reduce((a, b) => b.count > a.count ? b : a));

  const H = 160;
  const padL = 0, padR = 0, padT = 16, padB = 36;
  const barW = width > 0 ? Math.floor((width - padL - padR) / 7) : 0;
  const maxBarH = H - padT - padB;

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginBottom: 10, fontStyle: 'italic' }}>
        Most active: {DOW_LABELS[bestDay]} ({byDay[bestDay].count} sessions)
      </Text>
      {width > 0 && (
        <Svg width={width} height={H} viewBox={`0 0 ${width} ${H}`}>
          {byDay.map((d, i) => {
            const barH  = maxBarH * (d.count / maxCount);
            const x     = padL + i * barW;
            const y     = padT + maxBarH - barH;
            const avgE  = d.energy.length ? d.energy.reduce((a, v) => a + v, 0) / d.energy.length : null;
            const alpha = 0.35 + 0.65 * (d.count / maxCount);
            const fill  = i === bestDay
              ? COLOURS.amber
              : `rgba(8,131,149,${alpha.toFixed(2)})`;
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
                    textAnchor="middle" fontSize="9"
                    fill={COLOURS.text} fontFamily="Lato"
                  >{d.count}</SvgText>
                )}
                {/* Avg energy number — row 1 below bars */}
                {avgE !== null && (
                  <SvgText
                    x={x + barW / 2} y={H - padB + 14}
                    textAnchor="middle" fontSize="9"
                    fill={avgE >= 0 ? COLOURS.amber : COLOURS.red}
                    fontFamily="Lato"
                  >{avgE >= 0 ? `+${avgE.toFixed(1)}` : avgE.toFixed(1)}</SvgText>
                )}
                {/* Day label — row 2, always visible */}
                <SvgText
                  x={x + barW / 2} y={H - 4}
                  textAnchor="middle" fontSize="10"
                  fill={i === bestDay ? COLOURS.navy : COLOURS.textDim}
                  fontWeight={i === bestDay ? '700' : '400'}
                  fontFamily="Lato"
                >{DOW_LABELS[i]}</SvgText>
              </G>
            );
          })}
        </Svg>
      )}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: COLOURS.amber }} />
          <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim }}>most active day</Text>
        </View>
        <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim, fontStyle: 'italic' }}>numbers = avg energy</Text>
      </View>
    </View>
  );
}

function TouchableYear({ onPress, label }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}
      style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)' }}>
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.navy }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function StatsScreen({ sessions, compositions, lessons, isDesktop }) {
  const [period, setPeriod] = useState('30d');
  const [pieceSort, setPieceSort] = useState('count');

  const PERIODS = [
    { key: '7d',  label: '7 days' },
    { key: '30d', label: '30 days' },
    { key: 'all', label: 'All time' },
  ];

  function filterByPeriod(items, days) {
    if (period === 'all') return items;
    const ago = new Date();
    ago.setDate(ago.getDate() - days);
    return items.filter(s => new Date(s.date + 'T12:00:00') >= ago);
  }

  const days = period === '7d' ? 7 : 30;
  const periodSessions = filterByPeriod(sessions, days);
  const periodLessons  = filterByPeriod(lessons || [], days);

  const totalMin    = periodSessions.reduce((a, s) => a + (Number(s.duration) || 0), 0);
  const allTimeMin  = sessions.reduce((a, s) => a + (Number(s.duration) || 0), 0);
  // Energy: convert -2…+2 scale to 0…5 fill for the Zelda bar
  const avgEnergyNum  = periodSessions.length
    ? periodSessions.reduce((a, s) => a + Number(s.energy), 0) / periodSessions.length
    : null;
  const energyFill    = avgEnergyNum !== null ? avgEnergyNum + 3 : null; // -2→1, 0→3, +2→5
  const enjoymentSessions = periodSessions.filter(s => s.enjoyment != null);
  const avgEnjoymentFill   = enjoymentSessions.length
    ? enjoymentSessions.reduce((a, s) => a + Number(s.enjoyment), 0) / enjoymentSessions.length
    : null;

  const streak = (() => {
    const dateSet = new Set(periodSessions.map(s => s.date));
    if (dateSet.size === 0) return 0;
    // Walk every day in the period, find the longest consecutive run
    const start = period === 'all'
      ? new Date(Math.min(...periodSessions.map(s => new Date(s.date + 'T12:00:00'))))
      : (() => { const d = new Date(); d.setDate(d.getDate() - days); return d; })();
    const end = new Date();
    let best = 0, current = 0, d = new Date(start);
    while (d <= end) {
      const iso = d.toISOString().slice(0, 10);
      if (dateSet.has(iso)) { current++; best = Math.max(best, current); }
      else { current = 0; }
      d.setDate(d.getDate() + 1);
    }
    return best;
  })();


  const pieceFreq = {};
  const pieceEnjoyment = {};
  const pieceMinutes = {};
  const pieceEnergy = {};
  const pieceSessionEnjoyment = {};
  const pieceDifficulty = {};
  periodSessions.forEach(s => {
    (s.segments || []).forEach(seg => {
      if (seg.type !== 'repertoire') return;
      const comp = compositions.find(c => c.id === seg.compositionId);
      if (comp?.status === 'ambition') return;
      const name = seg.compositionId
        ? (comp || {}).title || seg.compositionId
        : seg.title;
      if (!name) return;
      pieceFreq[name] = (pieceFreq[name] || 0) + 1;
      pieceMinutes[name] = (pieceMinutes[name] || 0) + (Number(seg.duration) || 0);
      if (seg.liking) {
        if (!pieceEnjoyment[name]) pieceEnjoyment[name] = [];
        pieceEnjoyment[name].push(seg.liking);
      }
      // energy + enjoyment from parent session
      if (s.energy != null) {
        if (!pieceEnergy[name]) pieceEnergy[name] = [];
        pieceEnergy[name].push(Number(s.energy));
      }
      if (s.enjoyment != null) {
        if (!pieceSessionEnjoyment[name]) pieceSessionEnjoyment[name] = [];
        pieceSessionEnjoyment[name].push(Number(s.enjoyment));
      }
      if (seg.feltDifficulty) {
        if (!pieceDifficulty[name]) pieceDifficulty[name] = [];
        pieceDifficulty[name].push(Number(seg.feltDifficulty));
      }
    });
  });
  const topPieces = Object.entries(pieceFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => {
      const joys  = pieceEnjoyment[name] || [];
      const engs  = pieceEnergy[name] || [];
      const sesEnj = pieceSessionEnjoyment[name] || [];
      const diffs = pieceDifficulty[name] || [];
      const avgLiking          = joys.length   ? joys.reduce((a, v) => a + v, 0)   / joys.length   : null;
      const avgEnergy          = engs.length   ? engs.reduce((a, v) => a + v, 0)   / engs.length   : null;
      const avgSessionEnjoyment = sesEnj.length ? sesEnj.reduce((a, v) => a + v, 0) / sesEnj.length : null;
      const avgDifficulty      = diffs.length  ? diffs.reduce((a, v) => a + v, 0)  / diffs.length  : null;
      const mins = pieceMinutes[name] || 0;
      return { name, count, avgLiking, avgEnergy, avgSessionEnjoyment, avgDifficulty, mins };
    });

  const topPiecesByTime = Object.entries(pieceMinutes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, mins]) => {
      const count = pieceFreq[name] || 0;
      const joys  = pieceEnjoyment[name] || [];
      const engs  = pieceEnergy[name] || [];
      const sesEnj = pieceSessionEnjoyment[name] || [];
      const diffs = pieceDifficulty[name] || [];
      const avgLiking          = joys.length   ? joys.reduce((a, v) => a + v, 0)   / joys.length   : null;
      const avgEnergy          = engs.length   ? engs.reduce((a, v) => a + v, 0)   / engs.length   : null;
      const avgSessionEnjoyment = sesEnj.length ? sesEnj.reduce((a, v) => a + v, 0) / sesEnj.length : null;
      const avgDifficulty      = diffs.length  ? diffs.reduce((a, v) => a + v, 0)  / diffs.length  : null;
      return { name, count, avgLiking, avgEnergy, avgSessionEnjoyment, avgDifficulty, mins };
    });

  const activePieces = pieceSort === 'time' ? topPiecesByTime : topPieces;
  const activePieceMax = pieceSort === 'time'
    ? (topPiecesByTime[0]?.mins || 1)
    : (topPieces[0]?.count || 1);
  const timeStr = m => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;

  const periodLabel = period === 'all' ? 'all time' : period === '7d' ? '7d' : '30d';

  const today = new Date().toISOString().slice(0, 10);

  const daysSinceSession = (() => {
    if (sessions.length === 0) return null;
    const last = sessions.map(s => s.date).sort().at(-1);
    return Math.floor((new Date(today + 'T12:00:00') - new Date(last + 'T12:00:00')) / 86400000);
  })();

  const daysSinceLesson = (() => {
    const all = lessons || [];
    if (all.length === 0) return null;
    const last = all.map(l => l.date).sort().at(-1);
    return Math.floor((new Date(today + 'T12:00:00') - new Date(last + 'T12:00:00')) / 86400000);
  })();

  const statItems = [
    { value: totalMin >= 60 ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}m` : `${Math.round(totalMin)}m`, label: `practice (${periodLabel})`, emoji: '⏱', allTime: period !== 'all' ? (allTimeMin >= 60 ? `${Math.floor(allTimeMin / 60)}h ${allTimeMin % 60}m total` : `${Math.round(allTimeMin)}m total`) : null },
    { value: periodSessions.length, label: `sessions (${periodLabel})`,  emoji: '🎹' },
    { value: periodLessons.length,  label: `lessons (${periodLabel})`,   emoji: '🎓' },
    { value: streak,         label: `best streak (${periodLabel})`,   emoji: '🔥' },
    { value: null, fill: energyFill,    label: `avg energy (${periodLabel})`,    emoji: '⚡', type: 'energy' },
    { value: null, fill: avgEnjoymentFill, label: `avg enjoyment (${periodLabel})`, emoji: '❤️', type: 'enjoyment' },
    { value: daysSinceSession === null ? '—' : daysSinceSession === 0 ? 'today' : `${daysSinceSession}d`, label: 'since practice', emoji: '📅',
      urgent: daysSinceSession !== null && daysSinceSession >= 3 },
    { value: daysSinceLesson === null ? '—' : daysSinceLesson === 0 ? 'today' : `${daysSinceLesson}d`, label: 'since lesson', emoji: '🎼',
      urgent: daysSinceLesson !== null && daysSinceLesson >= 16 },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingLeft: isDesktop ? 226 : 16, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 }}>
          <SectionTitle style={{ marginBottom: 0 }}>Overview</SectionTitle>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {PERIODS.map(p => {
              const active = period === p.key;
              return (
                <TouchableOpacity key={p.key} onPress={() => setPeriod(p.key)} activeOpacity={0.75}
                  style={{
                    paddingHorizontal: 11, paddingVertical: 5, borderRadius: RADIUS.pill,
                    backgroundColor: active ? COLOURS.navy : 'rgba(255,255,255,0.55)',
                    shadowColor: active ? COLOURS.glassShadowMd : COLOURS.glassShadow,
                    shadowOffset: { width: 0, height: active ? 3 : 1 },
                    shadowOpacity: 1, shadowRadius: active ? 8 : 4, elevation: active ? 3 : 1,
                  }}>
                  <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: 12, color: active ? '#fff' : COLOURS.textMuted }}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Stat tiles */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24, alignItems: 'stretch' }}>
          {statItems.map((item, i) => (
            <View key={i} style={{ flexBasis: '11%', flexGrow: 1, minWidth: isDesktop ? 0 : '22%' }}>
              <BlurView intensity={50} tint="light" style={{ borderRadius: RADIUS.md, overflow: 'hidden', shadowColor: COLOURS.glassShadowMd, shadowOffset:{width:0,height:4}, shadowOpacity:1, shadowRadius:16, elevation:4, flex: 1 }}>
                <View style={{ backgroundColor: COLOURS.glass, paddingVertical: 16, paddingHorizontal: 10, alignItems: 'center', flex: 1, justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' }}>
                  <Text style={{ fontSize: 28, lineHeight: 34, marginBottom: 8 }}>{item.emoji}</Text>
                  {(item.type === 'energy' || item.type === 'enjoyment') ? (
                    item.fill !== null
                      ? <ZeldaBarFractional emoji={item.emoji} fill={item.fill} size={16} />
                      : <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 24, color: COLOURS.navy, lineHeight: 28 }}>—</Text>
                  ) : (
                    <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 28, color: item.urgent ? COLOURS.red : COLOURS.navy, lineHeight: 32 }}>{item.value}</Text>
                  )}
                  <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginTop: 4, textAlign: 'center', letterSpacing: 0.2 }}>{item.label}</Text>
                  {item.allTime ? <Text style={{ fontFamily: 'Lato', fontSize: 10, color: COLOURS.textDim, marginTop: 2, textAlign: 'center', opacity: 0.7 }}>{item.allTime}</Text> : null}
                </View>
              </BlurView>
            </View>
          ))}
        </View>

        <SectionTitle>Activity</SectionTitle>
        <GlassCard>
          <ActivityGrid sessions={sessions} lessons={lessons} />
        </GlassCard>

        <SectionTitle style={{ marginTop: 16 }}>{period === '7d' ? 'Daily' : 'Weekly'} trends & session quality ({periodLabel})</SectionTitle>
        <GlassCard>
          <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 0, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: isDesktop ? 20 : 0 }}>
              <Label>Practice volume</Label>
              <PracticeVolumeChart sessions={sessions} period={period} />
            </View>
            {isDesktop && <View style={{ width: 1, backgroundColor: COLOURS.glassBorderSubtle, alignSelf: 'stretch', marginHorizontal: 4 }} />}
            <View style={{ flex: 1, paddingLeft: isDesktop ? 20 : 0, marginTop: isDesktop ? 0 : 16 }}>
              <Label>{period === '7d' ? 'Daily' : 'Weekly'} trends</Label>
              <WeeklyTrendChart sessions={sessions} period={period} />
            </View>
            {isDesktop && <View style={{ width: 1, backgroundColor: COLOURS.glassBorderSubtle, alignSelf: 'stretch', marginHorizontal: 4 }} />}
            <View style={{ flex: 1, paddingLeft: isDesktop ? 20 : 0, marginTop: isDesktop ? 0 : 16 }}>
              <Label>Session quality</Label>
              <ScatterPlot sessions={periodSessions} />
            </View>
            {isDesktop && <View style={{ width: 1, backgroundColor: COLOURS.glassBorderSubtle, alignSelf: 'stretch', marginHorizontal: 4 }} />}
            <View style={{ flex: 1, paddingLeft: isDesktop ? 20 : 0, marginTop: isDesktop ? 0 : 16 }}>
              <Label>Day of week (all time)</Label>
              <DayOfWeekChart sessions={sessions} />
            </View>
          </View>
        </GlassCard>

        <SectionTitle style={{ marginTop: 16 }}>Technique & scales ({periodLabel})</SectionTitle>
        <GlassCard>
          <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 0, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, minWidth: 0, paddingRight: isDesktop ? 20 : 0 }}>
              <Label>Groups</Label>
              <TechniqueBreakdown sessions={periodSessions} />
            </View>
            {isDesktop && <View style={{ width: 1, backgroundColor: COLOURS.glassBorderSubtle, alignSelf: 'stretch', marginHorizontal: 4 }} />}
            <View style={{ width: isDesktop ? 600 : '100%', flexShrink: 0, paddingLeft: isDesktop ? 20 : 0, marginTop: isDesktop ? 0 : 16 }}>
              <Label>Keys ({periodLabel})</Label>
              <ScaleCoverage sessions={periodSessions} />
            </View>
          </View>
        </GlassCard>

        <SectionTitle style={{ marginTop: 16 }}>Library</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          {STATUS_OPTIONS.map(s => {
            const sc = STATUS_COLOURS[s] || {};
            const count = compositions.filter(c => c.status === s).length;
            if (count === 0) return null;
            return (
              <BlurView
                key={s}
                intensity={44}
                tint="light"
                style={{
                  flex: 1, borderRadius: RADIUS.md, overflow: 'hidden',
                  shadowColor: sc.border || COLOURS.accentMid,
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.7, shadowRadius: 12, elevation: 3,
                }}
              >
                <View style={{ backgroundColor: sc.bg || COLOURS.glass, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' }}>
                  <Text style={{ fontSize: 28, lineHeight: 34, marginBottom: 8 }}>
                    {STATUS_EMOJI[s] || '🎵'}
                  </Text>
                  <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 30, color: sc.text || COLOURS.navy, lineHeight: 32 }}>
                    {count}
                  </Text>
                  <Text style={{ fontFamily: 'Lato', fontSize: 12, color: sc.text || COLOURS.textDim, marginTop: 4, letterSpacing: 0.3, opacity: 0.85 }}>{s}</Text>
                </View>
              </BlurView>
            );
          })}
        </View>

        <SectionTitle style={{ marginTop: 16 }}>Lesson insights ({periodLabel})</SectionTitle>
        <GlassCard>
          <LessonInsights lessons={lessons || []} sessions={sessions} compositions={compositions} period={period} />
        </GlassCard>

        <SectionTitle style={{ marginTop: 16 }}>Library growth & streak history</SectionTitle>
        <GlassCard>
          <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 0, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: isDesktop ? 20 : 0 }}>
              <Label>Library growth</Label>
              <LibraryGrowthChart compositions={compositions} />
            </View>
            {isDesktop && <View style={{ width: 1, backgroundColor: COLOURS.glassBorderSubtle, alignSelf: 'stretch', marginHorizontal: 4 }} />}
            <View style={{ flex: 1, paddingLeft: isDesktop ? 20 : 0, marginTop: isDesktop ? 0 : 16 }}>
              <Label>Streak history</Label>
              <StreakHistory sessions={sessions} />
            </View>
          </View>
        </GlassCard>

        <SectionTitle style={{ marginTop: 16 }}>Most practised & wins ({periodLabel})</SectionTitle>
        <GlassCard>
          <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 0, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: isDesktop ? 20 : 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Label style={{ marginBottom: 0 }}>Most practised</Label>
                <View style={{ flexDirection: 'row', gap: 5 }}>
                  {[{ key: 'count', label: 'Sessions' }, { key: 'time', label: 'Time' }].map(opt => {
                    const active = pieceSort === opt.key;
                    return (
                      <TouchableOpacity key={opt.key} onPress={() => setPieceSort(opt.key)} activeOpacity={0.75}
                        style={{
                          paddingHorizontal: 9, paddingVertical: 4, borderRadius: RADIUS.pill,
                          backgroundColor: active ? COLOURS.navy : 'rgba(255,255,255,0.55)',
                          shadowColor: active ? COLOURS.glassShadowMd : COLOURS.glassShadow,
                          shadowOffset: { width: 0, height: active ? 2 : 1 },
                          shadowOpacity: 1, shadowRadius: active ? 6 : 3, elevation: active ? 2 : 1,
                        }}>
                        <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: 11, color: active ? '#fff' : COLOURS.textMuted }}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              {activePieces.length > 0 ? activePieces.map(({ name, count, avgLiking, avgEnergy, avgSessionEnjoyment, avgDifficulty, mins }) => (
                <View key={name} style={{
                  marginBottom: 12,
                  paddingLeft: 12,
                  borderLeftWidth: 2,
                  borderLeftColor: COLOURS.steel,
                  paddingBottom: 4,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 16, color: COLOURS.text, flex: 1 }}>📜 {name}</Text>
                    <View style={{ alignItems: 'flex-end', gap: 1 }}>
                      <Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.textDim }}>
                        {pieceSort === 'time' ? timeStr(mins) : `${count}×`}
                      </Text>
                      <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim }}>
                        {pieceSort === 'time' ? `${count}× sessions` : (mins > 0 ? `⏱ ${timeStr(mins)}` : '')}
                      </Text>
                    </View>
                  </View>
                  <View style={{ height: 3, backgroundColor: COLOURS.bg2, borderRadius: 2, marginBottom: 8 }}>
                    <View style={{ height: '100%', width: `${((pieceSort === 'time' ? mins : count) / activePieceMax) * 100}%`, backgroundColor: COLOURS.steel, borderRadius: 2 }} />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 16 }}>
                    <View style={{ gap: 3 }}>
                      <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6 }}>Session</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {avgEnergy !== null && <ZeldaBarFractional emoji="⚡" fill={avgEnergy + 3} size={12} />}
                        {avgSessionEnjoyment !== null && <ZeldaBarFractional emoji="❤️" fill={avgSessionEnjoyment} size={12} />}
                      </View>
                    </View>
                    <View style={{ gap: 3 }}>
                      <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6 }}>Piece</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {avgLiking !== null && <ZeldaBarFractional emoji="⭐" fill={avgLiking} size={12} />}
                        {avgDifficulty !== null && <ZeldaBarFractional emoji="🎵" fill={avgDifficulty} size={12} />}
                      </View>
                    </View>
                  </View>
                </View>
              )) : (
                <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 14, color: COLOURS.textDim }}>No repertoire logged in this period.</Text>
              )}
            </View>
            {isDesktop && <View style={{ width: 1, backgroundColor: COLOURS.glassBorderSubtle, alignSelf: 'stretch', marginHorizontal: 4 }} />}
            <View style={{ flex: 1, paddingLeft: isDesktop ? 20 : 0, marginTop: isDesktop ? 0 : 16 }}>
              <Label>Wins</Label>
              <WinsTimeline sessions={sessions} period={period} />
              <View style={{ height: 1, backgroundColor: COLOURS.glassBorderSubtle, marginVertical: 14 }} />
              <Label>Needs attention</Label>
              <NeglectedPieces sessions={sessions} compositions={compositions} />
            </View>
          </View>
        </GlassCard>

      </ScrollView>
    </SafeAreaView>
  );
}
