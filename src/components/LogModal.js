import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, TOUCH_PILL, HIT_PILL } from '../theme';
import { GlassCard, SectionTitle, Btn, Label } from '../components/UI';
import { Field, TextF, NumberF, DatePickerF } from '../components/Form';
import { SegmentEditor } from '../components/SegmentEditor';
import { ReorderList, SwipeRow, DragHandle } from '../components/Gestures';
import { useUndoToast } from './Undo';
import { useDirtyGuard } from '../utils/useDirtyGuard';
import { reorder } from '../utils/reorder';
import { uid, confirmDelete, confirmDiscard } from '../utils';

function ZeldaBar({ label, emoji, value, onChange }) {
  return (
    <View style={{ marginBottom: 0 }}>
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <TouchableOpacity key={n} onPress={() => onChange(n === value ? 0 : n)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`${n} of 5`} hitSlop={{ top: 7, bottom: 7, left: 0, right: 0 }} style={{ paddingHorizontal: 7 }}>
            <Text style={{ fontSize: 26, opacity: n <= value ? 1 : 0.18, transform: [{ scale: n <= value ? 1 : 0.88 }], userSelect: 'none', cursor: 'pointer' }}>
              {emoji}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function energyBarToValue(bar) { return bar === 0 ? null : bar - 3; }
export function energyValueToBar(v) { return v === null || v === undefined ? 0 : v + 3; }

export function LogModal({ visible, onClose, onSave, compositions, initialDate, initialSession, previousSession, inline }) {
  const [date, setDate]           = useState(initialDate || '');
  const [energyBar, setEnergyBar] = useState(0);
  const [enjoyment, setEnjoyment] = useState(0);
  const [duration, setDuration]   = useState('');
  const [segments, setSegments]   = useState([]);
  const [dragging, setDragging]   = useState(false);
  const [wins, setWins]           = useState('');
  const [focus, setFocus]         = useState('');
  const undo = useUndoToast();
  const scrollRef = useRef(null);
  const scrollY = useRef(0);
  const guard = useDirtyGuard(JSON.stringify({ date, energyBar, enjoyment, duration, segments, wins, focus }));

  useEffect(() => {
    if (visible || inline) {
      if (initialSession) {
        setDate(initialSession.date || '');
        setEnergyBar(energyValueToBar(initialSession.energy));
        setEnjoyment(initialSession.enjoyment || 0);
        setDuration(initialSession.duration ? String(initialSession.duration) : '');
        setSegments(initialSession.segments || []);
        setWins(initialSession.wins || '');
        setFocus(initialSession.tomorrowFocus || '');
      } else {
        setDate(initialDate || '');
        setEnergyBar(0); setEnjoyment(0); setDuration('');
        setSegments([]); setWins(''); setFocus('');
      }
      guard.markReset();
    }
  }, [visible, inline, initialDate, initialSession]);

  function addSegment(type) {
    setSegments(s => [...s, { id: uid(), type, title: '', notes: '', challenges: [], progress: [] }]);
  }
  function updateSegment(id, val) { setSegments(s => s.map(seg => seg.id === id ? val : seg)); }
  function removeSegment(id) {
    const idx = segments.findIndex(seg => seg.id === id);
    if (idx < 0) return;
    const item = segments[idx];
    setSegments(s => s.filter(seg => seg.id !== id));
    undo.show('Segment removed', () => setSegments(s => {
      const a = s.slice();
      a.splice(Math.min(idx, a.length), 0, item);
      return a;
    }));
  }
  function requestClose() {
    if (guard.isDirty()) confirmDiscard(onClose); else onClose();
  }
  // Pre-fill from the previous session's plan; the reflective fields start fresh.
  function repeatLast() {
    const prev = previousSession;
    if (!prev) return;
    setSegments((prev.segments || []).map(s => ({
      ...s, id: uid(), notes: '', feedback: '', assignment: '',
      challenges: [], progress: [], feltDifficulty: 0, liking: 0,
    })));
    if (prev.duration) setDuration(String(prev.duration));
  }
  function reorderSegments(from, to) { setSegments(s => reorder(s, from, to)); }

  function handleSave() {
    if (energyBar === 0) {
      if (Platform.OS === 'web') { window.alert('Please set an energy level before saving.'); }
      else { Alert.alert('Energy required', 'Please set an energy level before saving.'); }
      return;
    }
    const totalFromSegs = segments.reduce((s, seg) => s + (Number(seg.duration) || 0), 0);
    onSave({
      id: initialSession?.id || uid(), date, energy: energyBarToValue(energyBar),
      enjoyment: enjoyment || null,
      duration: Number(duration) || totalFromSegs || null,
      segments, wins, tomorrowFocus: focus,
      createdAt: initialSession?.createdAt || new Date().toISOString(),
    });
    onClose();
  }

  const totalMin = segments.reduce((s, seg) => s + (Number(seg.duration) || 0), 0);

  const formBody = (
    <View style={{ flex: 1 }}>
    <ScrollView ref={scrollRef} onScroll={e => { scrollY.current = e.nativeEvent.contentOffset.y; }} scrollEventThrottle={16} contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" scrollEnabled={!dragging}>
      <GlassCard>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <DatePickerF label="Date" icon="calendar-outline" value={date} onChange={setDate} />
          </View>
          <View style={{ width: 80 }}>
            <Field label={totalMin ? `~${totalMin}m` : 'Min'} icon="time-outline">
              <NumberF value={duration} onChange={setDuration} placeholder={totalMin ? String(totalMin) : ''} />
            </Field>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 20 }}>
          <View style={{ flex: 1 }}>
            <ZeldaBar label="Energy" emoji="⚡" value={energyBar} onChange={setEnergyBar} />
          </View>
          <View style={{ flex: 1 }}>
            <ZeldaBar label="Enjoyment" emoji="❤️" value={enjoyment} onChange={setEnjoyment} />
          </View>
        </View>
      </GlassCard>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 }}>
        <SectionTitle style={{ marginBottom: 0 }}>Segments</SectionTitle>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={() => addSegment('technique')} activeOpacity={0.75}
            hitSlop={HIT_PILL} style={{ ...TOUCH_PILL, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.55), shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:8, elevation:2 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.navy }}>+ Technique</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => addSegment('repertoire')} activeOpacity={0.75}
            hitSlop={HIT_PILL} style={{ ...TOUCH_PILL, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.55), shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:8, elevation:2 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.navy }}>+ Repertoire</Text>
          </TouchableOpacity>
        </View>
      </View>

      {segments.length === 0 && (
        <View style={{ borderRadius: RADIUS.md, padding: 24, alignItems: 'center', marginBottom: 12, backgroundColor: COLOURS.w(0.35), shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 1 }}>
          <Text style={{ fontFamily: 'Lato', color: COLOURS.textDim, fontSize: 14 }}>Add technique and repertoire segments above</Text>
          {previousSession && !initialSession ? (
            <TouchableOpacity onPress={repeatLast} activeOpacity={0.75} hitSlop={HIT_PILL}
              style={{ ...TOUCH_PILL, marginTop: 14, paddingHorizontal: 16, borderRadius: RADIUS.pill, backgroundColor: COLOURS.tealAccent }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.navy }}>↻ Repeat last session</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <ReorderList
        data={segments}
        keyExtractor={seg => seg.id}
        onReorder={reorderSegments}
        onDragChange={setDragging}
        scrollRef={scrollRef}
        scrollOffset={scrollY}
        renderItem={({ item: seg, handleProps, isActive }) => (
          <SwipeRow onDelete={() => removeSegment(seg.id)} bottomInset={10}>
            <SegmentEditor segment={seg} compositions={compositions}
              onChange={val => updateSegment(seg.id, val)}
              onRemove={() => removeSegment(seg.id)}
              dragHandle={<DragHandle handleProps={handleProps} active={isActive} />} />
          </SwipeRow>
        )}
      />

      <GlassCard>
        <Field label="Wins today" icon="sparkles-outline">
          <TextF value={wins} onChange={setWins} placeholder="What went well? Any breakthroughs?" multiline />
        </Field>
        <Field label="Tomorrow's focus" icon="arrow-forward-circle-outline" style={{ marginBottom: 0 }}>
          <TextF value={focus} onChange={setFocus} placeholder="What to prioritise next session?" multiline />
        </Field>
      </GlassCard>

      <Btn label="Save session" variant="primary" onPress={handleSave} style={{ marginTop: 4 }} />
    </ScrollView>
    {undo.toast}
    </View>
  );

  // ── Inline mode (desktop right panel) ────────────────────────────────────
  if (inline) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 28, paddingTop: 24, paddingBottom: 8 }}>
          <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 22, color: COLOURS.text }}>Log session</Text>
          <TouchableOpacity onPress={requestClose} activeOpacity={0.75}
            hitSlop={HIT_PILL} style={{ ...TOUCH_PILL, paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.55), shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 }}>
            <Text style={{ fontFamily: 'Lato-Bold', color: COLOURS.navy, fontSize: 14 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
        {formBody}
      </View>
    );
  }

  // ── Full-screen modal (mobile) ────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={requestClose}>
      <View style={{ flex: 1, backgroundColor: COLOURS.bg }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
          <BlurView intensity={50} tint={COLOURS.blurTint} style={{ borderBottomWidth: 1, borderBottomColor: COLOURS.glassBorderSubtle }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, backgroundColor: COLOURS.glass }}>
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 22, color: COLOURS.text }}>Log session</Text>
              <TouchableOpacity onPress={requestClose} activeOpacity={0.75}
                hitSlop={HIT_PILL} style={{ ...TOUCH_PILL, paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.55), shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 }}>
                <Text style={{ fontFamily: 'Lato-Bold', color: COLOURS.navy, fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </SafeAreaView>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {formBody}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
