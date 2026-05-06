import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, Modal, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS } from '../theme';
import { GlassCard, SectionTitle, Btn, Label } from '../components/UI';
import { Field, TextF, NumberF } from '../components/Form';
import { SegmentEditor } from '../components/SegmentEditor';
import { uid } from '../utils';

// ─── Zelda-style rating bar ───────────────────────────────────────────────────
// Shared by energy (⚡, 1–5 mapped from -2..+2) and enjoyment (❤️, 1–5)

const ZELDA_CELL_W = 40;
const ZELDA_CELLS  = 5;

function ZeldaBar({ label, emoji, value, onChange }) {
  return (
    <View style={{ marginBottom: 0 }}>
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(n === value ? 0 : n)}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
          >
            <Text style={{
              fontSize: 26,
              opacity: n <= value ? 1 : 0.18,
              transform: [{ scale: n <= value ? 1 : 0.88 }],
              userSelect: 'none',
              cursor: 'pointer',
            }}>
              {emoji}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// Energy maps: 1=Very low(-2), 2=Low(-1), 3=Neutral(0), 4=Good(+1), 5=High(+2)
function energyBarToValue(bar) { return bar === 0 ? null : bar - 3; }
export function energyValueToBar(v) { return v === null || v === undefined ? 0 : v + 3; }

export function LogModal({ visible, onClose, onSave, compositions, initialDate, initialSession }) {
  const [date, setDate]           = useState(initialDate || '');
  const [energyBar, setEnergyBar] = useState(0);
  const [enjoyment, setEnjoyment] = useState(0);
  const [duration, setDuration]   = useState('');
  const [segments, setSegments]   = useState([]);
  const [wins, setWins]           = useState('');
  const [focus, setFocus]         = useState('');

  useEffect(() => {
    if (visible) {
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
        setEnergyBar(0);
        setEnjoyment(0);
        setDuration('');
        setSegments([]);
        setWins('');
        setFocus('');
      }
    }
  }, [visible, initialDate, initialSession]);

  function addSegment(type) {
    setSegments(s => [...s, { id: uid(), type, title: '', notes: '', challenges: [], progress: [] }]);
  }
  function updateSegment(id, val) { setSegments(s => s.map(seg => seg.id === id ? val : seg)); }
  function removeSegment(id)      { setSegments(s => s.filter(seg => seg.id !== id)); }

  function handleSave() {
    if (energyBar === 0) { Alert.alert('Energy required', 'Please set an energy level before saving.'); return; }
    const totalFromSegs = segments.reduce((s, seg) => s + (Number(seg.duration) || 0), 0);
    const session = {
      id: initialSession?.id || uid(), date, energy: energyBarToValue(energyBar),
      enjoyment: enjoyment || null,
      duration: Number(duration) || totalFromSegs || null,
      segments, wins, tomorrowFocus: focus,
      createdAt: initialSession?.createdAt || new Date().toISOString(),
    };
    onSave(session);
    onClose();
  }

  const totalMin = segments.reduce((s, seg) => s + (Number(seg.duration) || 0), 0);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLOURS.bg }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
          <BlurView intensity={50} tint="light" style={{ borderBottomWidth: 1, borderBottomColor: COLOURS.glassBorder }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLOURS.glass }}>
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 19, color: COLOURS.text }}>
                🎹 Log session
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={{ fontFamily: 'Lato-Bold', color: COLOURS.navy, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </SafeAreaView>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
            <GlassCard>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Field label="📅 Date">
                    <TextF value={date} onChange={setDate} placeholder="YYYY-MM-DD" />
                  </Field>
                </View>
                <View style={{ width: 120 }}>
                  <Field label={totalMin ? `⏱ ~${totalMin}m` : '⏱ Min'}>
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

            {/* Segments */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 }}>
              <SectionTitle style={{ marginBottom: 0 }}>Segments</SectionTitle>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => addSegment('technique')}
                  activeOpacity={0.75}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)', shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:8, elevation:2 }}
                >
                  <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.navy }}>+ Technique</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => addSegment('repertoire')}
                  activeOpacity={0.75}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)', shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:8, elevation:2 }}
                >
                  <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.navy }}>+ Repertoire</Text>
                </TouchableOpacity>
              </View>
            </View>

            {segments.length === 0 && (
              <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: COLOURS.glassBorder, borderRadius: RADIUS.md, padding: 24, alignItems: 'center', marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.25)' }}>
                <Text style={{ fontFamily: 'Lato', color: COLOURS.textDim, fontSize: 14 }}>Add technique and repertoire segments above</Text>
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
              <Field label="✨ Wins today">
                <TextF value={wins} onChange={setWins} placeholder="What went well? Any breakthroughs?" multiline />
              </Field>
              <Field label="🎯 Tomorrow's focus" style={{ marginBottom: 0 }}>
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
