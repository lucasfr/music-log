import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS } from '../theme';
import { GlassCard, SectionTitle, Btn, Label } from '../components/UI';
import { Field, TextF, NumberF } from '../components/Form';
import { SegmentEditor } from '../components/SegmentEditor';
import { ENERGY_LABELS } from '../constants';
import { uid } from '../utils';

export function LogModal({ visible, onClose, onSave, compositions, initialDate }) {
  const [date, setDate]         = useState(initialDate || '');
  const [energy, setEnergy]     = useState(null);
  const [duration, setDuration] = useState('');
  const [segments, setSegments] = useState([]);
  const [wins, setWins]         = useState('');
  const [focus, setFocus]       = useState('');

  // Reset form when modal opens with a new date
  useEffect(() => {
    if (visible) {
      setDate(initialDate || '');
      setEnergy(null);
      setDuration('');
      setSegments([]);
      setWins('');
      setFocus('');
    }
  }, [visible, initialDate]);

  function addSegment(type) {
    setSegments(s => [...s, { id: uid(), type, title: '', notes: '', challenges: [], progress: [] }]);
  }
  function updateSegment(id, val) { setSegments(s => s.map(seg => seg.id === id ? val : seg)); }
  function removeSegment(id)      { setSegments(s => s.filter(seg => seg.id !== id)); }

  function handleSave() {
    if (energy === null) { Alert.alert('Energy required', 'Please set an energy level before saving.'); return; }
    const totalFromSegs = segments.reduce((s, seg) => s + (Number(seg.duration) || 0), 0);
    const session = {
      id: uid(), date, energy: Number(energy),
      duration: Number(duration) || totalFromSegs || null,
      segments, wins, tomorrowFocus: focus,
      createdAt: new Date().toISOString(),
    };
    onSave(session);
    onClose();
  }

  const totalMin = segments.reduce((s, seg) => s + (Number(seg.duration) || 0), 0);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLOURS.bg }}>
        {/* Header */}
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
          <BlurView intensity={50} tint="light" style={{ borderBottomWidth: 1, borderBottomColor: COLOURS.glassBorder }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLOURS.glass }}>
              <Text style={{ fontFamily: 'LibreBaskerville-Italic', fontSize: 19, color: COLOURS.text }}>
                Log session
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={{ fontFamily: 'SourceSans3-Bold', color: COLOURS.navy, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </SafeAreaView>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
            keyboardShouldPersistTaps="handled"
          >
            <GlassCard>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Date">
                    <TextF value={date} onChange={setDate} placeholder="YYYY-MM-DD" />
                  </Field>
                </View>
                <View style={{ width: 120 }}>
                  <Field label={totalMin ? `Duration (~${totalMin}m)` : 'Duration (min)'}>
                    <NumberF value={duration} onChange={setDuration} placeholder={totalMin ? String(totalMin) : ''} />
                  </Field>
                </View>
              </View>

              <Label>Energy level</Label>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                {['-2', '-1', '0', '1', '2'].map(v => {
                  const active = String(energy) === v;
                  return (
                    <TouchableOpacity
                      key={v}
                      onPress={() => setEnergy(v)}
                      activeOpacity={0.75}
                      style={{
                        flex: 1, paddingVertical: 10, alignItems: 'center',
                        borderRadius: RADIUS.sm, borderWidth: 1,
                        borderColor: active ? COLOURS.navy : COLOURS.glassBorder,
                        backgroundColor: active ? COLOURS.navy : 'rgba(255,255,255,0.50)',
                        shadowColor: active ? COLOURS.navy : 'transparent',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: active ? 0.35 : 0,
                        shadowRadius: 8,
                        elevation: active ? 4 : 0,
                      }}
                    >
                      <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 14, color: active ? '#fff' : COLOURS.textMuted }}>
                        {Number(v) > 0 ? `+${v}` : v}
                      </Text>
                      <Text style={{ fontFamily: 'SourceSans3', fontSize: 10, color: active ? 'rgba(255,255,255,0.75)' : COLOURS.textDim, marginTop: 2 }}>
                        {ENERGY_LABELS[v]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </GlassCard>

            {/* Segments */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 }}>
              <SectionTitle style={{ marginBottom: 0 }}>Segments</SectionTitle>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => addSegment('technique')}
                  activeOpacity={0.75}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOURS.steel, backgroundColor: COLOURS.accent2Light }}
                >
                  <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 12, color: COLOURS.navy }}>+ Technique</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => addSegment('repertoire')}
                  activeOpacity={0.75}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOURS.navy, backgroundColor: COLOURS.accentLight }}
                >
                  <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 12, color: COLOURS.navy }}>+ Repertoire</Text>
                </TouchableOpacity>
              </View>
            </View>

            {segments.length === 0 && (
              <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: COLOURS.glassBorder, borderRadius: RADIUS.md, padding: 24, alignItems: 'center', marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.25)' }}>
                <Text style={{ fontFamily: 'SourceSans3', color: COLOURS.textDim, fontSize: 14 }}>Add technique and repertoire segments above</Text>
              </View>
            )}

            {segments.map(seg => (
              <SegmentEditor
                key={seg.id}
                segment={seg}
                compositions={compositions}
                onChange={val => updateSegment(seg.id, val)}
                onRemove={() => removeSegment(seg.id)}
              />
            ))}

            <GlassCard>
              <Field label="Wins today">
                <TextF value={wins} onChange={setWins} placeholder="What went well? Any breakthroughs?" multiline />
              </Field>
              <Field label="Tomorrow's focus" style={{ marginBottom: 0 }}>
                <TextF value={focus} onChange={setFocus} placeholder="What to prioritise next session?" multiline />
              </Field>
            </GlassCard>

            <Btn label="Save session" variant="primary" onPress={handleSave} style={{ marginTop: 4 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
