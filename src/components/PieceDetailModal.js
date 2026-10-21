import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Modal, TextInput } from 'react-native';
import { Tap as TouchableOpacity } from './Motion';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import { COLOURS, RADIUS, HIT_TEXT, HIT_PILL, STATUS_COLOURS } from '../theme';
import { fmtDate, deriveStatusHistory, todayISO } from '../utils';
import {
  pieceReport, describeTempo, describeRunThroughs, agoLabel, formatRunThroughs,
  addSpot, setSpotFixed, removeSpot, spotLabel,
} from '../utils/insights';
import { tint } from '../utils/tint';

// One page for one piece: where it stands (practice, tempo and whether it will get there in time), the
// bars that keep going wrong, what your teacher has said, how it has gone lately, and the stages it has
// been through. The numbers come from pieceReport (src/utils/insights.js); this is only layout, plus
// the list of tricky spots, which you add to and tick off here.

const SECTION = { fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 };

function Section({ title, children }) {
  return (
    <View style={{ marginBottom: 22 }}>
      <Text style={SECTION}>{title}</Text>
      {children}
    </View>
  );
}

function Chip({ children, tone }) {
  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: tone ? tint(tone, 0.2) : COLOURS.w(0.55) }}>
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.navy }}>{children}</Text>
    </View>
  );
}

// The clean tempo over time, with the piece's own tempo as a dashed line when it has one.
function TempoLine({ points, target }) {
  const W = 300; const H = 64; const PAD = 6;
  if (!points || points.length < 2) return null;
  const values = points.map(p => p.bpm).concat(target ? [target] : []);
  const lo = Math.min(...values); const hi = Math.max(...values);
  const span = Math.max(1, hi - lo);
  const x = i => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const y = v => H - PAD - ((v - lo) / span) * (H - PAD * 2);
  const path = points.map((p, i) => `${x(i)},${y(p.bpm)}`).join(' ');
  const last = points[points.length - 1];
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" accessibilityLabel={`Clean tempo from ${points[0].bpm} to ${last.bpm} bpm`}>
      {target ? <Line x1={PAD} x2={W - PAD} y1={y(target)} y2={y(target)} stroke={COLOURS.amber} strokeWidth={1.5} strokeDasharray="4 4" /> : null}
      <Polyline points={path} fill="none" stroke={COLOURS.steel} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={x(points.length - 1)} cy={y(last.bpm)} r={4} fill={COLOURS.steel} />
    </Svg>
  );
}

function SpotRow({ spot, onToggle, onRemove }) {
  const fixed = spot.status === 'fixed';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
      <TouchableOpacity onPress={onToggle} hitSlop={HIT_PILL} accessibilityRole="checkbox" accessibilityState={{ checked: fixed }}
        accessibilityLabel={`${spotLabel(spot.bars)}, ${fixed ? 'fixed' : 'still tricky'}`}
        style={{ width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: fixed ? COLOURS.success : COLOURS.w(0.55), borderWidth: 1, borderColor: fixed ? COLOURS.success : COLOURS.glassBorderSubtle }}>
        {fixed ? <Text style={{ fontFamily: 'Lato-Bold', fontSize: 15, lineHeight: 18, color: '#fff' }}>✓</Text> : null}
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Lato-Bold', fontSize: 15, color: fixed ? COLOURS.textDim : COLOURS.text, textDecorationLine: fixed ? 'line-through' : 'none' }}>{spotLabel(spot.bars)}</Text>
        <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim }}>
          {fixed && spot.fixed ? `Fixed ${fmtDate(spot.fixed)}` : spot.added ? `Since ${fmtDate(spot.added)}` : ''}
        </Text>
      </View>
      <TouchableOpacity onPress={onRemove} hitSlop={HIT_PILL} accessibilityRole="button" accessibilityLabel={`Remove ${spotLabel(spot.bars)}`}>
        <Text style={{ fontFamily: 'Lato', fontSize: 22, lineHeight: 24, color: COLOURS.textDim }}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

export function PieceDetailModal({ visible, piece, sessions, lessons, examDate, onSavePiece, onClose }) {
  const [spotText, setSpotText] = useState('');
  const today = todayISO();
  const report = useMemo(
    () => (piece ? pieceReport(piece, sessions, lessons, today, examDate || null) : null),
    [piece, sessions, lessons, today, examDate],
  );
  const stages = useMemo(
    () => (piece ? deriveStatusHistory(piece.id, sessions, lessons, piece.shelvedAt) : []),
    [piece, sessions, lessons],
  );
  if (!piece || !report) return null;

  const { practice, tempo, next, stalled, trajectory, runThroughs, recent, fromLessons, spots } = report;
  const status = report.status;
  const sc = STATUS_COLOURS[status] || {};
  const save = list => onSavePiece && onSavePiece({ ...piece, spots: list });
  const addNew = () => { if (!spotText.trim()) return; save(addSpot(piece.spots, spotText, today)); setSpotText(''); };
  const trajectoryColour = !trajectory ? null
    : trajectory.status === 'behind' ? COLOURS.amber
      : trajectory.status === 'on-track' || trajectory.status === 'reached' ? COLOURS.success : COLOURS.textDim;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLOURS.bg }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
          <BlurView intensity={50} tint={COLOURS.blurTint} style={{ borderBottomWidth: 1, borderBottomColor: COLOURS.glassBorder }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLOURS.glass }}>
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'CormorantGaramond-Italic', fontSize: 21, color: COLOURS.text, marginRight: 12 }}>{report.title}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={HIT_TEXT} accessibilityRole="button" accessibilityLabel="Close">
                <Text style={{ fontFamily: 'Lato-Bold', color: COLOURS.navy, fontSize: 16 }}>Done</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </SafeAreaView>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            {report.composer ? <Text style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.textDim }}>{report.composer}</Text> : null}
            {status ? (
              <View style={{ paddingHorizontal: 9, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: sc.bg || COLOURS.tealAccent }}>
                <Text style={{ fontFamily: 'Lato', fontSize: 12, color: sc.text || COLOURS.navy }}>{status}</Text>
              </View>
            ) : null}
            {report.grade ? <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim }}>{report.grade}</Text> : null}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
            <Chip>{practice.sessions} {practice.sessions === 1 ? 'session' : 'sessions'}</Chip>
            <Chip>{practice.minutes} min</Chip>
            <Chip>{practice.lastDate ? `Played ${practice.daysSince === 0 ? 'today' : agoLabel(practice.daysSince)}` : 'Not played yet'}</Chip>
          </View>

          {tempo ? (
            <Section title="Tempo">
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 34, color: COLOURS.text }}>{tempo.latest}</Text>
                <Text style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.textDim }}>bpm{tempo.target ? ` of ${tempo.target}` : ''}</Text>
              </View>
              <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginBottom: 8 }}>{describeTempo(tempo)}</Text>
              <TempoLine points={tempo.points} target={tempo.target} />
              {next && next.kind !== 'at-target' ? (
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.navy, marginTop: 8 }}>Next: {next.bpm} bpm <Text style={{ fontFamily: 'Lato', color: COLOURS.textDim }}>· {next.reason}</Text></Text>
              ) : null}
              {stalled ? (
                <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.amber, marginTop: 6 }}>
                  Stalled at {stalled.bpm} for {Math.max(1, Math.round(stalled.days / 7))} {Math.round(stalled.days / 7) <= 1 ? 'week' : 'weeks'}. A smaller step, or a different way in (hands apart, a slower run, a loop on the hard bars), may help.
                </Text>
              ) : null}
              {trajectory ? <Text style={{ fontFamily: 'Lato', fontSize: 13, color: trajectoryColour, marginTop: 6, lineHeight: 19 }}>{trajectory.message}</Text> : null}
            </Section>
          ) : null}

          <Section title="Tricky spots">
            {spots.open.map(s => (
              <SpotRow key={s.id} spot={s} onToggle={() => save(setSpotFixed(piece.spots, s.id, true, today))} onRemove={() => save(removeSpot(piece.spots, s.id))} />
            ))}
            {spots.open.length === 0 ? (
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 15, color: COLOURS.textDim, marginBottom: 6 }}>
                {spots.fixed.length ? 'Nothing tricky at the moment.' : 'None noted. Add the bars that keep going wrong and they will show in the timer and your summaries.'}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              <TextInput value={spotText} onChangeText={setSpotText} onSubmitEditing={addNew} returnKeyType="done" placeholder="Bars 9-12, or the left hand jump" placeholderTextColor={COLOURS.textDim}
                accessibilityLabel="Add a tricky spot"
                style={{ flex: 1, fontFamily: 'Lato', fontSize: 15, color: COLOURS.text, paddingHorizontal: 12, paddingVertical: 9, borderRadius: RADIUS.md, backgroundColor: COLOURS.w(0.6), borderWidth: 1, borderColor: COLOURS.glassBorderSubtle }} />
              <TouchableOpacity onPress={addNew} hitSlop={HIT_PILL} accessibilityRole="button" accessibilityLabel="Add spot"
                style={{ paddingHorizontal: 16, justifyContent: 'center', borderRadius: RADIUS.md, backgroundColor: COLOURS.steel }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: '#fff' }}>Add</Text>
              </TouchableOpacity>
            </View>
            {spots.fixed.length > 0 ? (
              <View style={{ marginTop: 10 }}>
                <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim }}>Fixed</Text>
                {spots.fixed.map(s => (
                  <SpotRow key={s.id} spot={s} onToggle={() => save(setSpotFixed(piece.spots, s.id, false, today))} onRemove={() => save(removeSpot(piece.spots, s.id))} />
                ))}
              </View>
            ) : null}
          </Section>

          {runThroughs ? (
            <Section title="Run-throughs">
              <Text style={{ fontFamily: 'Lato', fontSize: 15, color: COLOURS.text }}>{describeRunThroughs(runThroughs)}</Text>
            </Section>
          ) : null}

          {fromLessons.length > 0 ? (
            <Section title="From your lessons">
              {fromLessons.map((l, i) => (
                <View key={`${l.date}-${i}`} style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: COLOURS.amber, marginBottom: 12 }}>
                  <Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.textDim }}>{fmtDate(l.date)}</Text>
                  {l.feedback ? <Text style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.text, marginTop: 2 }}>{l.feedback}</Text> : null}
                  {l.assignment ? <Text style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.navy, marginTop: 2 }}>{l.done ? '✓ ' : 'To do: '}{l.assignment}</Text> : null}
                </View>
              ))}
            </Section>
          ) : null}

          {recent.length > 0 ? (
            <Section title="Recent sessions">
              {recent.map((r, i) => (
                <View key={`${r.date}-${i}`} style={{ flexDirection: 'row', gap: 10, paddingVertical: 5 }}>
                  <Text style={{ width: 92, fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.textDim }}>{fmtDate(r.date)}</Text>
                  <Text style={{ flex: 1, fontFamily: 'Lato', fontSize: 14, color: COLOURS.text }}>
                    {[r.minutes ? `${r.minutes} min` : null, r.tempo ? `${r.tempo} bpm` : null, r.runThroughs ? formatRunThroughs({ runThroughs: r.runThroughs }) : null, r.section].filter(Boolean).join(' · ') || 'Played'}
                  </Text>
                </View>
              ))}
            </Section>
          ) : null}

          {stages.length > 0 ? (
            <Section title="Stages">
              {stages.map((st, i) => {
                const c = STATUS_COLOURS[st.status] || {};
                return (
                  <View key={`${st.status}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 }}>
                    <View style={{ paddingHorizontal: 9, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: c.bg || COLOURS.tealAccent }}>
                      <Text style={{ fontFamily: 'Lato', fontSize: 12, color: c.text || COLOURS.navy }}>{st.status}</Text>
                    </View>
                    <Text style={{ flex: 1, fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim }}>
                      {fmtDate(st.start)} to {fmtDate(st.end)}{st.count ? ` · ${st.count} ${st.count === 1 ? 'log' : 'logs'}` : ''}
                    </Text>
                  </View>
                );
              })}
            </Section>
          ) : null}

          {report.notes.length > 0 ? (
            <Section title="Notes">
              {report.notes.map(n => (
                <View key={n.label} style={{ marginBottom: 10 }}>
                  <Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.textDim }}>{n.label}</Text>
                  <Text style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.text, lineHeight: 20, marginTop: 2 }}>{n.text}</Text>
                </View>
              ))}
            </Section>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
