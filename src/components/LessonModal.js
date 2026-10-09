import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, TOUCH_PILL, HIT_PILL } from '../theme';
import { GlassCard, SectionTitle, Btn } from '../components/UI';
import { Field, TextF, NumberF, DatePickerF } from '../components/Form';
import { SegmentEditor } from '../components/SegmentEditor';
import { ReorderList, SwipeRow, DragHandle } from '../components/Gestures';
import { useUndoToast } from './Undo';
import { useDirtyGuard } from '../utils/useDirtyGuard';
import { reorder } from '../utils/reorder';
import { uid, confirmDiscard } from '../utils';

function ZeldaBar({ label, emoji, value, onChange }) {
  return (
    <View style={{ marginBottom: 0 }}>
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <TouchableOpacity key={n} onPress={() => onChange(n === value ? 0 : n)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`${n} of 5`} hitSlop={{ top: 7, bottom: 7, left: 0, right: 0 }} style={{ paddingHorizontal: 7 }}>
            <Text style={{ fontSize: 26, opacity: n <= value ? 1 : 0.18, transform: [{ scale: n <= value ? 1 : 0.88 }], userSelect: 'none', cursor: 'pointer' }}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}


function energyValueToBar(v) { return v === null || v === undefined ? 0 : v + 3; }
function energyBarToValue(bar) { return bar === 0 ? null : bar - 3; }

export function LessonModal({ visible, onClose, onSave, compositions, initialDate, initialLesson, inline }) {
  const [date, setDate]             = useState(initialDate || '');
  const [teacher, setTeacher]       = useState('');
  const [duration, setDuration]     = useState('60');
  const [energyBar, setEnergyBar]   = useState(0);
  const [enjoyment, setEnjoyment]   = useState(0);
  const [pieces, setPieces]         = useState([]);
  const [dragging, setDragging]     = useState(false);
  const [overallNotes, setOverallNotes] = useState('');
  const [wins, setWins]             = useState('');
  const [nextFocus, setNextFocus]   = useState('');
  const undo = useUndoToast();
  const scrollRef = useRef(null);
  const scrollY = useRef(0);
  const guard = useDirtyGuard(JSON.stringify({ date, teacher, duration, energyBar, enjoyment, pieces, overallNotes, wins, nextFocus }));

  useEffect(() => {
    if (visible || inline) {
      if (initialLesson) {
        setDate(initialLesson.date || '');
        setTeacher(initialLesson.teacher || '');
        setDuration(initialLesson.duration ? String(initialLesson.duration) : '60');
        setEnergyBar(energyValueToBar(initialLesson.energy));
        setEnjoyment(initialLesson.enjoyment || 0);
        setPieces(initialLesson.segments || initialLesson.pieces || []);
        setOverallNotes(initialLesson.overallNotes || '');
        setWins(initialLesson.wins || '');
        setNextFocus(initialLesson.nextFocus || '');
      } else {
        setDate(initialDate || '');
        setTeacher(''); setDuration('60');
        setEnergyBar(0); setEnjoyment(0);
        setPieces([]); setOverallNotes('');
        setWins(''); setNextFocus('');
      }
      guard.markReset();
    }
  }, [visible, inline, initialDate, initialLesson]);

  function addPiece(type = 'repertoire') {
    setPieces(p => [...p, { id: uid(), type, compositionId: '', title: '', group: '', notes: '', feedback: '', assignment: '', isNew: false, section: '', duration: '', feltDifficulty: 0, liking: 0, challenges: [], progress: [], scales: [], octaves: 1 }]);
  }
  function updatePiece(id, val) { setPieces(p => p.map(x => x.id === id ? val : x)); }
  function removePiece(id) {
    const idx = pieces.findIndex(x => x.id === id);
    if (idx < 0) return;
    const item = pieces[idx];
    setPieces(p => p.filter(x => x.id !== id));
    undo.show('Segment removed', () => setPieces(p => {
      const a = p.slice();
      a.splice(Math.min(idx, a.length), 0, item);
      return a;
    }));
  }
  function requestClose() {
    if (guard.isDirty()) confirmDiscard(onClose); else onClose();
  }
  function reorderPieces(from, to) { setPieces(p => reorder(p, from, to)); }

  function handleSave() {
    if (!date) { Alert.alert('Date required'); return; }
    onSave({
      id: initialLesson?.id || uid(),
      type: 'lesson', date, teacher,
      duration: Number(duration) || 60,
      energy: energyBarToValue(energyBar), enjoyment: enjoyment || null,
      segments: pieces, overallNotes, wins, nextFocus,
      createdAt: initialLesson?.createdAt || new Date().toISOString(),
    });
    onClose();
  }

  const formContent = (
    <>
      <GlassCard>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 0 }}>
          <View style={{ flex: 1 }}>
            <DatePickerF label="Date" icon="calendar-outline" value={date} onChange={setDate} />
          </View>
          <View style={{ width: 90 }}>
            <Field label="Min" icon="time-outline">
              <NumberF value={duration} onChange={setDuration} />
            </Field>
          </View>
        </View>
        <Field label="Teacher" icon="person-outline" style={{ marginBottom: 0 }}>
          <TextF value={teacher} onChange={setTeacher} placeholder="Teacher name" />
        </Field>
      </GlassCard>

      <GlassCard>
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
          <TouchableOpacity onPress={() => addPiece('technique')} activeOpacity={0.75}
            hitSlop={HIT_PILL} style={{ ...TOUCH_PILL, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.55), shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:8, elevation:2 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.navy }}>+ Technique</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => addPiece('repertoire')} activeOpacity={0.75}
            hitSlop={HIT_PILL} style={{ ...TOUCH_PILL, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.55), shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:8, elevation:2 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.navy }}>+ Repertoire</Text>
          </TouchableOpacity>
        </View>
      </View>

      {pieces.length === 0 && (
        <View style={{ borderRadius: RADIUS.md, padding: 24, alignItems: 'center', marginBottom: 12, backgroundColor: COLOURS.w(0.35), shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 1 }}>
          <Text style={{ fontFamily: 'Lato', color: COLOURS.textDim, fontSize: 14 }}>Add technique and repertoire segments from this lesson</Text>
        </View>
      )}

      <ReorderList
        data={pieces}
        keyExtractor={item => item.id}
        onReorder={reorderPieces}
        onDragChange={setDragging}
        scrollRef={scrollRef}
        scrollOffset={scrollY}
        renderItem={({ item, handleProps, isActive }) => (
          <SwipeRow onDelete={() => removePiece(item.id)} bottomInset={10}>
            <SegmentEditor segment={item} compositions={compositions}
              onChange={val => updatePiece(item.id, val)}
              onRemove={() => removePiece(item.id)}
              dragHandle={<DragHandle handleProps={handleProps} active={isActive} />}
              lessonMode />
          </SwipeRow>
        )}
      />

      <GlassCard>
        <Field label="Lesson notes" icon="create-outline">
          <TextF value={overallNotes} onChange={setOverallNotes} placeholder="General observations from the lesson…" multiline />
        </Field>
        <Field label="Wins / breakthroughs" icon="sparkles-outline">
          <TextF value={wins} onChange={setWins} placeholder="What clicked or was confirmed today…" multiline />
        </Field>
        <Field label="Focus before next lesson" icon="arrow-forward-circle-outline" style={{ marginBottom: 0 }}>
          <TextF value={nextFocus} onChange={setNextFocus} placeholder="Overall priority until next lesson…" multiline />
        </Field>
      </GlassCard>

      <Btn label="Save lesson" variant="primary" onPress={handleSave} style={{ marginTop: 4 }} />
    </>
  );

  // ── Inline mode (desktop right panel) ────────────────────────────────────
  if (inline) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 28, paddingTop: 24, paddingBottom: 8 }}>
          <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 22, color: COLOURS.text }}>Log lesson</Text>
          <TouchableOpacity onPress={requestClose} activeOpacity={0.75}
            hitSlop={HIT_PILL} style={{ ...TOUCH_PILL, paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.55), shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 }}>
            <Text style={{ fontFamily: 'Lato-Bold', color: COLOURS.navy, fontSize: 14 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} onScroll={e => { scrollY.current = e.nativeEvent.contentOffset.y; }} scrollEventThrottle={16} contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" scrollEnabled={!dragging}>
          {formContent}
        </ScrollView>
        {undo.toast}
        </View>
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
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 22, color: COLOURS.text }}>Log lesson</Text>
              <TouchableOpacity onPress={requestClose} activeOpacity={0.75}
                hitSlop={HIT_PILL} style={{ ...TOUCH_PILL, paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.55), shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 }}>
                <Text style={{ fontFamily: 'Lato-Bold', color: COLOURS.navy, fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </SafeAreaView>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flex: 1 }}>
          <ScrollView ref={scrollRef} onScroll={e => { scrollY.current = e.nativeEvent.contentOffset.y; }} scrollEventThrottle={16} contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" scrollEnabled={!dragging}>
            {formContent}
          </ScrollView>
          {undo.toast}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
