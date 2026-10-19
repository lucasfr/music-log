// A grade (or any exam) target for Stats: a date, the scales and arpeggios it asks for, and how many
// pieces. You enter the requirements yourself, from the syllabus you are following or your
// teacher's list, so the app does not carry anyone's syllabus listing (see utils/insights.js).
// The card then shows how much of it you have practised lately.

import React, { useMemo, useState } from 'react';
import { View, Text, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, TOUCH_PILL, HIT_PILL, STATUS_COLOURS } from '../theme';
import { Btn } from './UI';
import { Field, TextF, NumberF, SelectF, DatePickerF } from './Form';
import { ScalesPicker } from './SegmentEditor';
import { Tap as TouchableOpacity } from './Motion';
import { usePref } from '../utils/usePref';
import { todayISO } from '../utils';
import { notify } from '../utils/notify';
import { GRADES } from '../constants';
import {
  emptyTarget, parseTarget, serializeTarget, targetHasContent, describeRequirement, readiness,
  splitScales, joinScales, agoLabel,
} from '../utils/insights';

const STATUS_TEXT = { recent: COLOURS.success, stale: COLOURS.amber, never: COLOURS.red };

function Pill({ label, onPress, primary, a11y }) {
  return (
    <TouchableOpacity
      onPress={onPress} activeOpacity={0.75} hitSlop={HIT_PILL}
      accessibilityRole="button" accessibilityLabel={a11y || label}
      style={{ ...TOUCH_PILL, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: primary ? COLOURS.navy : COLOURS.navyA(0.10) }}
    >
      <Text style={{ fontFamily: primary ? 'Lato-Bold' : 'Lato', fontSize: 14, color: primary ? '#fff' : COLOURS.textMuted }}>{label}</Text>
    </TouchableOpacity>
  );
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function daysLeftText(d) {
  if (d === null) return null;
  if (d > 1) return `${d} days left`;
  if (d === 1) return '1 day left';
  if (d === 0) return 'Today';
  return `${-d} ${d === -1 ? 'day' : 'days'} ago`;
}

// ─── The card ────────────────────────────────────────────────────────────────

export function GradeTargetCard({ sessions, compositions }) {
  const [raw, setRaw] = usePref('gradeTarget', '');
  const [editing, setEditing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const target = useMemo(() => parseTarget(raw), [raw]);
  // One stable object for the editor to start from. A fresh one on every render would make it
  // reset the form whenever this card re-renders (a sync finishing, say) while someone is typing.
  const initial = useMemo(() => target || emptyTarget(), [target]);
  const today = todayISO();
  const has = targetHasContent(target);
  const r = useMemo(() => (has ? readiness(target, sessions, compositions, today) : null), [has, target, sessions, compositions, today]);

  const modal = (
    <GradeTargetModal
      visible={editing}
      initial={initial}
      onClose={() => setEditing(false)}
      onSave={t => { setRaw(serializeTarget(t)); setEditing(false); }}
    />
  );

  if (!has) {
    return (
      <View>
        <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 15, color: COLOURS.textDim, lineHeight: 22 }}>
          Set a target to see how ready you are: which scales and arpeggios you have practised lately, how many pieces are performance-ready, and how long is left.
          You enter the requirements yourself, from your syllabus or your teacher's list.
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          <Pill label="Set a target" primary onPress={() => setEditing(true)} />
        </View>
        {modal}
      </View>
    );
  }

  const { counts, pieces, sightReading, daysLeft } = r;
  const order = { never: 0, stale: 1, recent: 2 };
  const reqs = [...r.scales, ...r.arpeggios].sort((a, b) => order[a.status] - order[b.status]);
  const shownReqs = showAll ? reqs : reqs.slice(0, 5);
  const heading = target.name || target.grade || 'Grade target';

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 22, color: COLOURS.text }}>{heading}</Text>
          {daysLeft !== null ? (
            <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginTop: 2 }}>{daysLeftText(daysLeft)} · {target.date}</Text>
          ) : null}
        </View>
        <Pill label="Edit" onPress={() => setEditing(true)} a11y="Edit target" />
      </View>

      {counts.total > 0 ? (
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.text }}>Scales and arpeggios</Text>
          <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 8, backgroundColor: COLOURS.navyA(0.10) }}>
            {counts.recent > 0 ? <View style={{ flex: counts.recent, backgroundColor: STATUS_TEXT.recent }} /> : null}
            {counts.stale > 0 ? <View style={{ flex: counts.stale, backgroundColor: STATUS_TEXT.stale }} /> : null}
            {counts.never > 0 ? <View style={{ flex: counts.never, backgroundColor: STATUS_TEXT.never }} /> : null}
          </View>
          <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginTop: 6 }}>
            {counts.recent} of {counts.total} practised in the last 3 weeks
            {counts.stale > 0 ? `, ${counts.stale} not lately` : ''}
            {counts.never > 0 ? `, ${counts.never} not yet` : ''}
          </Text>
        </View>
      ) : null}

      {target.grade && pieces.needed > 0 ? (
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.text }}>
            Pieces: {pieces.ready} of {pieces.needed} performance-ready
          </Text>
          {pieces.list.map(p => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 15, color: COLOURS.text, flexShrink: 1 }} numberOfLines={1}>{p.title}</Text>
              <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: STATUS_COLOURS[p.status]?.bg || COLOURS.tealAccent }}>
                <Text style={{ fontFamily: 'Lato', fontSize: 12, color: STATUS_COLOURS[p.status]?.text || COLOURS.navy }}>{p.status}</Text>
              </View>
            </View>
          ))}
          {pieces.candidates < pieces.needed ? (
            <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginTop: 6 }}>
              Your library has {plural(pieces.candidates, 'piece', 'pieces')} marked {target.grade}; the target needs {pieces.needed}.
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ marginTop: 16 }}>
        <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.text }}>Sight-reading</Text>
        <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginTop: 2 }}>
          {sightReading.sessions > 0
            ? `${plural(sightReading.sessions, 'session', 'sessions')}, ${sightReading.minutes} min in the last 4 weeks`
            : 'None logged in the last 4 weeks'}
        </Text>
      </View>

      {reqs.length > 0 ? (
        <View style={{ marginTop: 16 }}>
          {shownReqs.map(q => (
            <View key={`${q.group}|${q.name}|${q.motion}|${q.interval}`} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 }}>
              <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: STATUS_TEXT[q.status] }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 15, color: COLOURS.text }} numberOfLines={1}>{describeRequirement(q)}</Text>
                <Text style={{ fontFamily: 'Lato', fontSize: 12, color: STATUS_TEXT[q.status], marginTop: 1 }}>
                  {q.group === 'Arpeggios' ? 'Arpeggio' : 'Scale'} · {q.status === 'never' ? 'not yet' : q.daysSince === 0 ? 'today' : agoLabel(q.daysSince)}
                </Text>
              </View>
            </View>
          ))}
          {reqs.length > 5 ? (
            <View style={{ flexDirection: 'row', marginTop: 4 }}>
              <Pill label={showAll ? 'Show fewer' : `Show all ${reqs.length}`} onPress={() => setShowAll(v => !v)} />
            </View>
          ) : null}
        </View>
      ) : null}
      {modal}
    </View>
  );
}

// ─── The editor ──────────────────────────────────────────────────────────────

const GRADE_OPTIONS = [{ value: '', label: 'No grade' }, ...GRADES.map(g => ({ value: g, label: g }))];

function GradeTargetModal({ visible, initial, onClose, onSave }) {
  const start = useMemo(() => {
    const { similar, contrary } = splitScales(initial.scales);
    return { name: initial.name, grade: initial.grade, date: initial.date, pieces: String(initial.piecesNeeded), similar, contrary, arpeggios: initial.arpeggios };
  }, [initial]);

  const [name, setName] = useState(start.name);
  const [grade, setGrade] = useState(start.grade);
  const [date, setDate] = useState(start.date);
  const [pieces, setPieces] = useState(start.pieces);
  const [similar, setSimilar] = useState(start.similar);
  const [contrary, setContrary] = useState(start.contrary);
  const [arpeggios, setArpeggios] = useState(start.arpeggios);

  // Reopening shows the saved target, not whatever was left half-edited last time.
  React.useEffect(() => {
    if (!visible) return;
    setName(start.name); setGrade(start.grade); setDate(start.date); setPieces(start.pieces);
    setSimilar(start.similar); setContrary(start.contrary); setArpeggios(start.arpeggios);
  }, [visible, start]);

  function handleSave() {
    const when = String(date || '');
    if (when && (!/^\d{4}-\d{2}-\d{2}$/.test(when) || Number.isNaN(new Date(`${when}T12:00:00`).getTime()))) {
      notify('Check the date', 'Use the form 2026-12-31.');
      return;
    }
    const saved = parseTarget(serializeTarget({
      name, grade, date: when,
      piecesNeeded: Number(pieces),
      scales: joinScales(similar, contrary),
      arpeggios: joinScales(arpeggios, []),
    }));
    onSave(saved);
  }

  const hint = text => (
    <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginBottom: 8, lineHeight: 17 }}>{text}</Text>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLOURS.bg }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
          <BlurView intensity={50} tint={COLOURS.blurTint} style={{ borderBottomWidth: 1, borderBottomColor: COLOURS.glassBorderSubtle }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, backgroundColor: COLOURS.glass }}>
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 22, color: COLOURS.text }}>Grade target</Text>
              <Pill label="Cancel" onPress={onClose} />
            </View>
          </BlurView>
        </SafeAreaView>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
            <Field label="Name">
              <TextF value={name} onChange={setName} placeholder="e.g. Grade 4 exam" />
            </Field>
            <DatePickerF label="Target date" value={date} onChange={setDate} />
            <SelectF label="Grade of the pieces" value={grade} onChange={setGrade} options={GRADE_OPTIONS} placeholder="No grade" />
            {hint('Pieces in your library with this grade count towards the target.')}
            <Field label="Pieces needed">
              <NumberF value={pieces} onChange={setPieces} />
            </Field>

            <Field label="Scales">
              {hint('Add each scale the target asks for. Tap the octave badge to set the range.')}
              <ScalesPicker selected={similar} onChange={setSimilar} />
            </Field>
            <Field label="Contrary-motion scales">
              <ScalesPicker selected={contrary} onChange={setContrary} />
            </Field>
            <Field label="Arpeggios">
              <ScalesPicker selected={arpeggios} onChange={setArpeggios} />
            </Field>

            <Btn label="Save target" variant="primary" onPress={handleSave} style={{ marginTop: 8 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
