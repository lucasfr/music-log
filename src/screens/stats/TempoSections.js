import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { COLOURS, SIZES } from '../../theme';
import { tempoProgress, describeTempo, suggestNextTempo, tempoStalled, tempoTrajectory } from '../../utils/insights';
import { AnimatedFill, Tap as TouchableOpacity } from '../../components/Motion';
import Svg, { Path, Circle } from 'react-native-svg';
import { todayISO } from '../../utils';

// ─── Tempo progress ──────────────────────────────────────────────────────────
// The BPM logged on pieces and exercises over time, against a piece's reference tempo (see
// tempoProgress in utils/insights.js).

function Sparkline({ points, width = 96, height = 28, colour }) {
  const day = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;
  const t0 = day(points[0].date);
  const t1 = day(points[points.length - 1].date);
  const lo = Math.min(...points.map(p => p.bpm));
  const hi = Math.max(...points.map(p => p.bpm));
  const pad = 3;
  const x = p => (points.length < 2 || t1 === t0 ? width / 2 : pad + ((day(p.date) - t0) / (t1 - t0)) * (width - 2 * pad));
  const y = p => (hi === lo ? height / 2 : height - pad - ((p.bpm - lo) / (hi - lo)) * (height - 2 * pad));
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p).toFixed(1)} ${y(p).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  return (
    <Svg width={width} height={height}>
      {points.length > 1 && <Path d={d} fill="none" stroke={colour} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      <Circle cx={x(last)} cy={y(last)} r="3" fill={colour} />
    </Svg>
  );
}

// "Next: 82 bpm" under a tempo row: a small step above the last clean reading (suggestNextTempo in
// utils/insights.js). Nothing to show for a piece that has reached its target.
function NextTempoLine({ p, today }) {
  const next = suggestNextTempo(p, today);
  if (next.kind === 'at-target') return null;
  return (
    <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.steel, marginTop: 1 }}>
      {next.kind === 'return' ? `Start again from ${next.bpm} bpm` : `Next: ${next.bpm} bpm`}
    </Text>
  );
}

// For a piece with a tempo of its own: has it stalled, and will the pace so far get it there by the exam.
// A short line each here; the piece's page has the full wording.
function TrajectoryLine({ p, examDate, today }) {
  const stalled = tempoStalled(p, today);
  const t = p.kind === 'piece' ? tempoTrajectory(p, examDate, today) : null;
  const behind = !!t && t.status === 'behind';
  const onTrack = !!t && t.status === 'on-track';
  if (!stalled && !behind && !onTrack) return null;
  const weeks = stalled ? Math.max(1, Math.round(stalled.days / 7)) : 0;
  return (
    <>
      {stalled ? <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.amber, marginTop: 1 }}>{`Stalled at ${stalled.bpm} for ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`}</Text> : null}
      {behind || onTrack ? (
        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: behind ? COLOURS.amber : COLOURS.success, marginTop: 1 }}>
          {behind ? `Behind: needs ${t.needPerWeek} bpm a week, managing ${t.ratePerWeek}` : `On track for ${p.target} (${t.ratePerWeek} bpm a week)`}
        </Text>
      ) : null}
    </>
  );
}

export function TempoProgress({ sessions, compositions, examDate, onOpenPiece }) {
  const today = todayISO();
  const items = useMemo(() => tempoProgress(sessions, compositions), [sessions, compositions]);
  if (items.length === 0) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.textDim }}>
      Log a BPM on a piece or an exercise and how it changes over time shows up here.
    </Text>
  );
  const shown = items.slice(0, 8);
  return (
    <View>
      {shown.map(p => (
        <TouchableOpacity key={p.key} activeOpacity={0.8} disabled={!(p.compositionId && onOpenPiece)}
          onPress={() => onOpenPiece(p.compositionId)} style={{ marginBottom: 14 }}
          accessible accessibilityRole={p.compositionId && onOpenPiece ? 'button' : undefined}
          accessibilityHint={p.compositionId && onOpenPiece ? "Opens this piece's page" : undefined}
          accessibilityLabel={`${p.name}: ${describeTempo(p)}`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.text }}>{p.name}</Text>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, marginTop: 2 }}>{describeTempo(p)}</Text>
              <NextTempoLine p={p} today={today} />
              <TrajectoryLine p={p} examDate={examDate} today={today} />
            </View>
            <Sparkline points={p.points} colour={p.reachedTarget ? COLOURS.success : COLOURS.steel} />
          </View>
          {p.target ? (
            <View style={{ height: 4, borderRadius: 2, backgroundColor: COLOURS.bg2, marginTop: 8, overflow: 'hidden' }}>
              <AnimatedFill fraction={p.fractionOfTarget} style={{ height: '100%', borderRadius: 2, backgroundColor: p.reachedTarget ? COLOURS.success : COLOURS.steel }} />
            </View>
          ) : null}
        </TouchableOpacity>
      ))}
      {items.length > shown.length ? (
        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>and {items.length - shown.length} more</Text>
      ) : null}
    </View>
  );
}
