import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, SIZES, TOUCH_PILL, HIT_PILL } from '../theme';
import { GlassCard, SectionTitle, Btn } from './UI';
import { Field, TextF, SelectF } from './Form';
import { ArticulationPicker } from './SegmentEditor';
import { MinutesDial } from './MinutesDial';
import { ReorderList, SwipeRow, DragHandle } from './Gestures';
import { reorder } from '../utils/reorder';
import { TECH_GROUPS } from '../constants';
import { uid, formatArticulation } from '../utils';

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
        backgroundColor: 'rgba(255,255,255,0.55)',
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
        {isTech && formatArticulation(segment) ? (
          <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.steel, marginRight: 10 }}>
            {formatArticulation(segment)}
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
      backgroundColor: 'rgba(255,255,255,0.55)',
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
                    backgroundColor: active ? 'rgba(8,131,149,0.14)' : 'rgba(255,255,255,0.65)',
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
          backgroundColor: isValid ? COLOURS.navy : 'rgba(9,99,126,0.15)',
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

export function TimerSetupModal({ visible, onClose, onStart, compositions }) {
  const [draftSegments, setDraftSegments] = useState([]);
  const [dragging, setDragging] = useState(false);

  function addSegment(type) {
    setDraftSegments(s => [...s, { id: uid(), type, title: '', compositionId: '', plannedMinutes: 10 }]);
  }
  function updateSegment(id, val) { setDraftSegments(s => s.map(seg => (seg.id === id ? val : seg))); }
  function removeSegment(id) { setDraftSegments(s => s.filter(seg => seg.id !== id)); }
  function reorderSegments(from, to) { setDraftSegments(s => reorder(s, from, to)); }

  const totalMin = draftSegments.reduce((sum, s) => sum + (Number(s.plannedMinutes) || 0), 0);
  const canStart = draftSegments.length > 0 && draftSegments.every(s => Number(s.plannedMinutes) > 0 && (s.type === 'technique' ? s.title : s.compositionId));

  function handleStart() {
    onStart(draftSegments.map(({ confirmed, ...s }) => ({ ...s, plannedMinutes: Number(s.plannedMinutes) })));
    setDraftSegments([]);
  }

  function handleClose() {
    setDraftSegments([]);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: COLOURS.bg }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
          <BlurView intensity={50} tint="light" style={{ borderBottomWidth: 1, borderBottomColor: COLOURS.glassBorderSubtle }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, backgroundColor: COLOURS.glass }}>
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 22, color: COLOURS.text }}>Set up timer</Text>
              <TouchableOpacity onPress={handleClose} activeOpacity={0.75}
                hitSlop={HIT_PILL} style={{ ...TOUCH_PILL, paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)' }}>
                <Text style={{ fontFamily: 'Lato-Bold', color: COLOURS.navy, fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </SafeAreaView>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled" scrollEnabled={!dragging}>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <SectionTitle style={{ marginBottom: 0 }}>Segments{totalMin ? ` · ${totalMin} min total` : ''}</SectionTitle>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <TouchableOpacity onPress={() => addSegment('technique')} activeOpacity={0.75}
                hitSlop={HIT_PILL} style={{ ...TOUCH_PILL, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)' }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.navy }}>+ Technique</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => addSegment('repertoire')} activeOpacity={0.75}
                hitSlop={HIT_PILL} style={{ ...TOUCH_PILL, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)' }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.navy }}>+ Repertoire</Text>
              </TouchableOpacity>
            </View>

            {draftSegments.length === 0 && (
              <View style={{ borderRadius: RADIUS.md, padding: 24, alignItems: 'center', marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.35)' }}>
                <Text style={{ fontFamily: 'Lato', color: COLOURS.textDim, fontSize: 14, textAlign: 'center' }}>
                  Add the segments you plan to work through, and how many minutes each gets.
                </Text>
              </View>
            )}

            <ReorderList
              data={draftSegments}
              keyExtractor={seg => seg.id}
              onReorder={reorderSegments}
              onDragChange={setDragging}
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

            <Btn label="Start timer" variant="primary" onPress={handleStart} disabled={!canStart} style={{ marginTop: 8 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
