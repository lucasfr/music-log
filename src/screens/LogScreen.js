import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, RADIUS } from '../theme';
import { Card, SectionTitle, Btn, BtnRow, Label } from '../components/UI';
import { Field, TextF, NumberF } from '../components/Form';
import { SegmentEditor } from '../components/SegmentEditor';
import { ENERGY_LABELS } from '../constants';
import { uid, todayISO } from '../utils';

export default function LogScreen({ sessions, compositions, onSave }) {
  const C = useTheme();

  const [date, setDate]       = useState(todayISO());
  const [energy, setEnergy]   = useState(null);
  const [duration, setDuration] = useState('');
  const [segments, setSegments] = useState([]);
  const [wins, setWins]       = useState('');
  const [focus, setFocus]     = useState('');

  function addSegment(type) {
    setSegments(s => [...s, { id: uid(), type, title: '', notes: '', challenges: [], progress: [] }]);
  }
  function updateSegment(id, val) { setSegments(s => s.map(seg => seg.id === id ? val : seg)); }
  function removeSegment(id)      { setSegments(s => s.filter(seg => seg.id !== id)); }

  function handleSave() {
    if (energy === null) { Alert.alert('Energy required', 'Please set an energy level before saving.'); return; }
    const totalFromSegs = segments.reduce((s, seg) => s + (Number(seg.duration) || 0), 0);
    const session = {
      id: uid(),
      date,
      energy: Number(energy),
      duration: Number(duration) || totalFromSegs || null,
      segments,
      wins,
      tomorrowFocus: focus,
      createdAt: new Date().toISOString(),
    };
    onSave(session);
    setEnergy(null); setDuration(''); setSegments([]); setWins(''); setFocus('');
    Alert.alert('Saved', 'Session logged.');
  }

  const totalMin = segments.reduce((s, seg) => s + (Number(seg.duration) || 0), 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.surface }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <SectionTitle>Log session</SectionTitle>

          <Card>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="Date">
                  <TextF value={date} onChange={setDate} placeholder="YYYY-MM-DD" />
                </Field>
              </View>
              <View style={{ width: 120 }}>
                <Field label={`Duration${totalMin ? ` (~${totalMin}m)` : ' (min)'}`}>
                  <NumberF value={duration} onChange={setDuration} placeholder={String(totalMin || '')} />
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
                    activeOpacity={0.7}
                    style={{
                      flex: 1, paddingVertical: 8, alignItems: 'center',
                      borderRadius: RADIUS.sm, borderWidth: 1,
                      borderColor: active ? C.accent : C.border2,
                      backgroundColor: active ? C.accent : C.surface,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: active ? '#fff' : C.ink2 }}>
                      {Number(v) > 0 ? `+${v}` : v}
                    </Text>
                    <Text style={{ fontSize: 10, color: active ? '#ffffffcc' : C.ink3, marginTop: 2 }}>
                      {ENERGY_LABELS[v]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          {/* Segments */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 }}>
            <SectionTitle style={{ marginBottom: 0 }}>Segments</SectionTitle>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => addSegment('technique')}
                activeOpacity={0.7}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: C.accent2 }}
              >
                <Text style={{ fontSize: 12, color: C.accent2 }}>+ Technique</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => addSegment('repertoire')}
                activeOpacity={0.7}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: C.accent }}
              >
                <Text style={{ fontSize: 12, color: C.accent }}>+ Repertoire</Text>
              </TouchableOpacity>
            </View>
          </View>

          {segments.length === 0 && (
            <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: C.border2, borderRadius: RADIUS.md, padding: 20, alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: C.ink3, fontSize: 13 }}>Add technique and repertoire segments above</Text>
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

          {/* Wins + Focus */}
          <Card>
            <Field label="Wins today">
              <TextF value={wins} onChange={setWins} placeholder="What went well? Any breakthroughs?" multiline />
            </Field>
            <Field label="Tomorrow's focus" style={{ marginBottom: 0 }}>
              <TextF value={focus} onChange={setFocus} placeholder="What to prioritise next session?" multiline />
            </Field>
          </Card>

          <BtnRow>
            <Btn label="Save session" variant="primary" onPress={handleSave} style={{ flex: 1 }} />
          </BtnRow>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
