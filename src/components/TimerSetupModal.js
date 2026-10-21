import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Tap as TouchableOpacity } from './Motion';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, TOUCH_PILL, HIT_PILL } from '../theme';
import { SectionTitle, Btn } from './UI';
import { TextF, SelectF } from './Form';
import { ArticulationPicker, DynamicsPicker } from './SegmentEditor';
import { MinutesDial } from './MinutesDial';
import { ReorderList, SwipeRow, DragHandle } from './Gestures';
import { useUndoToast } from './Undo';
import { reorder } from '../utils/reorder';
import { TECH_GROUPS } from '../constants';
import { uid, fmtDate, formatTouch, confirmDiscard, sessionToTimerPlan } from '../utils';
import { usePref } from '../utils/usePref';
import { parseRoutines, serializeRoutines, addRoutine, removeRoutine, routineToPlan } from '../utils/planning';
import { notify } from '../utils/notify';

function DraftSegmentRow({ segment, compositions, onChange, onRemove, dragHandle }) {
  const isTech = segment.type === 'technique';
  const field = (k, v) => onChange({ ...segment, [k]: v });
  const isValid = Number(segment.plannedMinutes) > 0 && (isTech ? !!segment.title : !!segment.compositionId);

  // Confirmed segments collapse to a single compact summary row — with
  // several segments in a plan, each carrying a full technique-group
  // picker or piece picker plus a large drag dial, reviewing the whole
  // plan before starting meant a lot of scrolling past segments you'd
  // already finished setting up. Collapsing the ones you're done with
  // keeps only what still needs attention expanded.
  if (segment.confirmed) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => field('confirmed', false)} style={{
        flexDirection: 'row', alignItems: 'center',
        borderRadius: RADIUS.md,
        backgroundColor: COLOURS.w(0.55),
        paddingHorizontal: 12, paddingVertical: 10,
        marginBottom: 10,
        shadowColor: COLOURS.glassShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 2,
      }}>
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, backgroundColor: isTech ? COLOURS.accent2Light : COLOURS.tealAccent, marginRight: 10 }}>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.steel, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {isTech ? 'technique' : 'repertoire'}
          </Text>
        </View>
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.text }}>
          {segment.title || 'Untitled'}
          {isTech && segment.compositionId
            ? ` · ${(compositions.find(c => c.id === segment.compositionId) || {}).title || ''}`
            : ''}
        </Text>
        {isTech && formatTouch(segment) ? (
          <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.steel, marginRight: 10 }}>
            {formatTouch(segment)}
          </Text>
        ) : null}
        <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginRight: 12 }}>
          {segment.plannedMinutes} min
        </Text>
        <Text style={{ fontSize: 13, color: COLOURS.steel, marginRight: 2 }}>✎</Text>
        {dragHandle}
      </TouchableOpacity>
    );
  }

  return (
    <View style={{
      borderRadius: RADIUS.md,
      backgroundColor: COLOURS.w(0.55),
      padding: 12,
      marginBottom: 10,
      shadowColor: COLOURS.glassShadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 8,
      elevation: 2,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: isTech ? COLOURS.accent2Light : COLOURS.tealAccent }}>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: isTech ? COLOURS.steel : COLOURS.steel, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {isTech ? 'technique' : 'repertoire'}
          </Text>
        </View>
        {dragHandle}
      </View>

      {isTech ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {TECH_GROUPS.map(g => {
              const active = segment.title === g;
              return (
                <TouchableOpacity
                  key={g}
                  onPress={() => field('title', g)}
                  activeOpacity={0.75}
                  hitSlop={HIT_PILL} style={{ ...TOUCH_PILL,
                    paddingHorizontal: 10, paddingVertical: 5,
                    borderRadius: RADIUS.pill,
                    backgroundColor: active ? COLOURS.steelA(0.14) : COLOURS.w(0.65),
                  }}
                >
                  <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: 13, color: active ? COLOURS.navy : COLOURS.textMuted }}>{g}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {segment.title !== 'Sight-reading' && (
            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Articulation</Text>
              <ArticulationPicker
                value={segment.articulation}
                onChange={v => field('articulation', v)}
              />
            </View>
          )}
          {segment.title !== 'Sight-reading' && (
            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Dynamics</Text>
              <DynamicsPicker
                value={segment.dynamics}
                onChange={v => field('dynamics', v)}
              />
            </View>
          )}
          <View style={{ marginBottom: 8 }}>
            <SelectF
              label=""
              value={segment.compositionId || ''}
              onChange={id => field('compositionId', id)}
              options={compositions.map(c => ({ value: c.id, label: c.title }))}
              placeholder="Link a library piece (optional)…"
            />
          </View>
        </>
      ) : (
        <View style={{ marginBottom: 8 }}>
          <SelectF
            label=""
            value={segment.compositionId || ''}
            onChange={id => {
              const comp = compositions.find(c => c.id === id);
              onChange({ ...segment, compositionId: id, title: comp ? comp.title : segment.title });
            }}
            options={compositions.map(c => ({ value: c.id, label: c.title }))}
            placeholder="Choose a piece…"
          />
        </View>
      )}

      <View style={{ alignItems: 'center', marginTop: 4 }}>
        <MinutesDial value={segment.plannedMinutes || 10} onChange={v => field('plannedMinutes', v)} />
      </View>

      <TouchableOpacity
        onPress={() => field('confirmed', true)}
        activeOpacity={0.75}
        disabled={!isValid}
        hitSlop={HIT_PILL} style={{ ...TOUCH_PILL,
          marginTop: 12, paddingVertical: 9, borderRadius: RADIUS.pill, alignItems: 'center',
          backgroundColor: isValid ? COLOURS.navy : COLOURS.navyA(0.15),
        }}
      >
        <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: isValid ? '#fff' : COLOURS.textDim }}>
          Confirm
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onRemove}
        activeOpacity={0.75}
        hitSlop={HIT_PILL}
        style={{ ...TOUCH_PILL, alignSelf: 'center', marginTop: 10, paddingHorizontal: 16, borderRadius: RADIUS.pill, backgroundColor: COLOURS.dangerLight }}
      >
        <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.danger }}>Remove segment</Text>
      </TouchableOpacity>
    </View>
  );
}

export function TimerSetupModal({ visible, onClose, onStart, compositions, previousSession }) {
  const [draftSegments, setDraftSegments] = useState([]);
  const [dragging, setDragging] = useState(false);
  const undo = useUndoToast();
  const scrollRef = useRef(null);
  const scrollY = useRef(0);

  // Saved routines: a named plan you can load in one tap (kept in preferences as JSON).
  const [routinesRaw, setRoutinesRaw] = usePref('timerRoutines', '[]');
  const routines = useMemo(() => parseRoutines(routinesRaw), [routinesRaw]);
  const [naming, setNaming] = useState(false);
  const [routineName, setRoutineName] = useState('');

  function addSegment(type) {
    setDraftSegments(s => [...s, { id: uid(), type, title: '', compositionId: '', plannedMinutes: 10 }]);
  }
  function updateSegment(id, val) { setDraftSegments(s => s.map(seg => (seg.id === id ? val : seg))); }
  function removeSegment(id) {
    const idx = draftSegments.findIndex(seg => seg.id === id);
    if (idx < 0) return;
    const item = draftSegments[idx];
    setDraftSegments(s => s.filter(seg => seg.id !== id));
    undo.show('Segment removed', () => setDraftSegments(s => {
      const a = s.slice();
      a.splice(Math.min(idx, a.length), 0, item);
      return a;
    }));
  }
  function reorderSegments(from, to) { setDraftSegments(s => reorder(s, from, to)); }

  // Start from the most recent logged session's plan (see sessionToTimerPlan).
  function repeatLast() {
    if (!previousSession) return;
    setDraftSegments(sessionToTimerPlan(previousSession, compositions));
  }

  function loadRoutine(r) { setDraftSegments(routineToPlan(r, compositions)); }
  function saveRoutine() {
    const next = addRoutine(routines, routineName, draftSegments);
    if (next === routines) return;                       // no name, or nothing to save
    setRoutinesRaw(serializeRoutines(next));
    notify('Routine saved', routineName.trim());
    setNaming(false);
    setRoutineName('');
  }
  function deleteRoutine(r) {
    const before = routines;
    setRoutinesRaw(serializeRoutines(removeRoutine(routines, r.id)));
    undo.show(`Routine "${r.name}" removed`, () => setRoutinesRaw(serializeRoutines(before)));
  }

  const previousSummary = (() => {
    const segs = (previousSession && previousSession.segments) || [];
    if (!segs.length) return '';
    const mins = segs.reduce((sum, s) => sum + Math.min(60, Number(s.duration) || 10), 0);
    return `${fmtDate(previousSession.date)} · ${segs.length} segment${segs.length === 1 ? '' : 's'} · ${mins} min`;
  })();

  const totalMin = draftSegments.reduce((sum, s) => sum + (Number(s.plannedMinutes) || 0), 0);
  const canStart = draftSegments.length > 0 && draftSegments.every(s => Number(s.plannedMinutes) > 0 && (s.type === 'technique' ? s.title : s.compositionId));

  function handleStart() {
    onStart(draftSegments.map(({ confirmed, ...s }) => ({ ...s, plannedMinutes: Number(s.plannedMinutes) })));
    setDraftSegments([]);
  }

  function handleClose() {
    setNaming(false);
    setRoutineName('');
    setDraftSegments([]);
    onClose();
  }
  // Ask first if there's a plan that would be thrown away.
  function requestClose() {
    if (draftSegments.length > 0) confirmDiscard(handleClose); else handleClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={requestClose}>
      <View style={{ flex: 1, backgroundColor: COLOURS.bg }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
          <BlurView intensity={50} tint={COLOURS.blurTint} style={{ borderBottomWidth: 1, borderBottomColor: COLOURS.glassBorderSubtle }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, backgroundColor: COLOURS.glass }}>
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 22, color: COLOURS.text }}>Set up timer</Text>
              <TouchableOpacity onPress={requestClose} activeOpacity={0.75}
                hitSlop={HIT_PILL} style={{ ...TOUCH_PILL, paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.55) }}>
                <Text style={{ fontFamily: 'Lato-Bold', color: COLOURS.navy, fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </SafeAreaView>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flex: 1 }}>
          <ScrollView ref={scrollRef} onScroll={e => { scrollY.current = e.nativeEvent.contentOffset.y; }} scrollEventThrottle={16} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled" scrollEnabled={!dragging}>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <SectionTitle style={{ marginBottom: 0 }}>Segments{totalMin ? ` · ${totalMin} min total` : ''}</SectionTitle>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <TouchableOpacity onPress={() => addSegment('technique')} activeOpacity={0.75}
                hitSlop={HIT_PILL} style={{ ...TOUCH_PILL, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.55) }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.navy }}>+ Technique</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => addSegment('repertoire')} activeOpacity={0.75}
                hitSlop={HIT_PILL} style={{ ...TOUCH_PILL, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.55) }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.navy }}>+ Repertoire</Text>
              </TouchableOpacity>
            </View>

            {draftSegments.length === 0 && (
              <View style={{ borderRadius: RADIUS.md, padding: 24, alignItems: 'center', marginBottom: 12, backgroundColor: COLOURS.w(0.35) }}>
                <Text style={{ fontFamily: 'Lato', color: COLOURS.textDim, fontSize: 14, textAlign: 'center' }}>
                  Add the segments you plan to work through, and how many minutes each gets.
                </Text>
                {previousSession ? (
                  <>
                    <TouchableOpacity onPress={repeatLast} activeOpacity={0.75} hitSlop={HIT_PILL}
                      accessibilityRole="button" accessibilityLabel={`Repeat last session: ${previousSummary}`}
                      style={{ ...TOUCH_PILL, marginTop: 14, paddingHorizontal: 16, borderRadius: RADIUS.pill, backgroundColor: COLOURS.tealAccent }}>
                      <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.navy }}>↻ Repeat last session</Text>
                    </TouchableOpacity>
                    <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginTop: 6, textAlign: 'center' }}>{previousSummary}</Text>
                  </>
                ) : null}
                {routines.length > 0 ? (
                  <View style={{ marginTop: 18, alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>Your routines</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                      {routines.map(r => (
                        <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOURS.tealAccent }}>
                          <TouchableOpacity onPress={() => loadRoutine(r)} activeOpacity={0.75} hitSlop={HIT_PILL}
                            accessibilityRole="button" accessibilityLabel={`Load routine ${r.name}, ${r.segments.length} segments`}
                            style={{ ...TOUCH_PILL, paddingLeft: 14, paddingRight: 6 }}>
                            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.navy }}>{r.name}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => deleteRoutine(r)} activeOpacity={0.75} hitSlop={{ top: 4, bottom: 4, left: 0, right: 6 }}
                            accessibilityRole="button" accessibilityLabel={`Remove routine ${r.name}`}
                            style={{ minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 13, color: COLOURS.textDim }}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            )}

            <ReorderList
              data={draftSegments}
              keyExtractor={seg => seg.id}
              onReorder={reorderSegments}
              onDragChange={setDragging}
              scrollRef={scrollRef}
              scrollOffset={scrollY}
              renderItem={({ item: seg, handleProps, isActive }) => (
                <SwipeRow onDelete={() => removeSegment(seg.id)} bottomInset={10} disabled={!seg.confirmed}>
                  <DraftSegmentRow
                    segment={seg}
                    compositions={compositions}
                    onChange={val => updateSegment(seg.id, val)}
                    onRemove={() => removeSegment(seg.id)}
                    dragHandle={<DragHandle handleProps={handleProps} active={isActive} />}
                  />
                </SwipeRow>
              )}
            />

            {draftSegments.length > 0 && (naming ? (
              <View style={{ marginTop: 4, marginBottom: 12 }}>
                <TextF value={routineName} onChange={setRoutineName} placeholder="Name this routine, e.g. Warm-up" />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity onPress={saveRoutine} disabled={!routineName.trim()} activeOpacity={0.8} hitSlop={HIT_PILL}
                    style={{ ...TOUCH_PILL, paddingHorizontal: 16, borderRadius: RADIUS.pill, backgroundColor: routineName.trim() ? COLOURS.navy : COLOURS.navyA(0.15) }}>
                    <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: routineName.trim() ? '#fff' : COLOURS.textDim }}>Save routine</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setNaming(false); setRoutineName(''); }} activeOpacity={0.8} hitSlop={HIT_PILL}
                    style={{ ...TOUCH_PILL, paddingHorizontal: 16, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navyA(0.10) }}>
                    <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.textMuted }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setNaming(true)} activeOpacity={0.75} hitSlop={HIT_PILL}
                accessibilityRole="button" accessibilityLabel="Save this plan as a routine"
                style={{ ...TOUCH_PILL, alignSelf: 'flex-start', paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: COLOURS.tealAccent, marginTop: 4, marginBottom: 8 }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.navy }}>Save as routine</Text>
              </TouchableOpacity>
            ))}

            <Btn label="Start timer" variant="primary" onPress={handleStart} disabled={!canStart} style={{ marginTop: 8 }} />
          </ScrollView>
          {undo.toast}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
