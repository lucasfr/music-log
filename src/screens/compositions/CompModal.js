// The Add / Edit piece form. Moved out of CompositionsScreen.js unchanged.

import React, { useState } from 'react';
import { View, Text, ScrollView, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Tap as TouchableOpacity } from '../../components/Motion';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, SIZES, STATUS_COLOURS, TOUCH_PILL, HIT_PILL, HIT_TEXT } from '../../theme';
import { Btn, GlassCard } from '../../components/UI';
import { notify } from '../../utils/notify';
import { Field, TextF, SelectF, DatePickerF } from '../../components/Form';
import { GRADES } from '../../constants';
import { todayISO } from '../../utils';
import { DifficultyPicker, TagInput, AutocompleteField, KeysPicker, TimeSigPicker } from './FormParts';

// ─── Composition modal ────────────────────────────────────────────────────────

export function CompModal({ comp, onSave, onClose, composerSuggestions, arrangementSuggestions }) {
  const [data, setData] = useState({ ...comp });
  const f = (k, v) => setData(d => ({ ...d, [k]: v }));

  function handleSave() {
    if (!data.title) { notify('Title required'); return; }
    onSave(data);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: COLOURS.bg }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
          <BlurView intensity={50} tint={COLOURS.blurTint} style={{ borderBottomWidth: 1, borderBottomColor: COLOURS.glassBorderSubtle }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLOURS.glass }}>
              <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.cardTitle, color: COLOURS.text }}>
                {comp.title ? 'Edit piece' : 'Add piece'}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={HIT_TEXT}>
                <Text style={{ fontFamily: 'Lato-Bold', color: COLOURS.navy, fontSize: SIZES.body }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </SafeAreaView>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">

            <GlassCard>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 3 }}>
                  <Field label="Title *">
                    <TextF value={data.title} onChange={v => f('title', v)} placeholder="e.g. Gymnopédie No. 1" />
                  </Field>
                </View>
                <View style={{ flex: 2 }}>
                  <AutocompleteField label="Composer" value={data.composer || ''} onChange={v => f('composer', v)} placeholder="e.g. Satie" suggestions={composerSuggestions} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <AutocompleteField label="Arrangement" value={data.arrangement || ''} onChange={v => f('arrangement', v)} placeholder="e.g. Rachmaninoff" suggestions={arrangementSuggestions} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Collection">
                    <TextF value={data.collection || ''} onChange={v => f('collection', v)} placeholder="e.g. For Children Vol. 1" />
                  </Field>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 0 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Year" style={{ marginBottom: 0 }}>
                    <TextF value={data.year || ''} onChange={v => f('year', v)} placeholder="e.g. 1888" />
                  </Field>
                </View>
                <View style={{ flex: 2 }}>
                  <SelectF label="Grade estimate" value={data.grade || ''} onChange={v => f('grade', v)} options={GRADES} placeholder="— Unknown —" />
                </View>
              </View>
            </GlassCard>

            <GlassCard>
              <TagInput value={data.tags || []} onChange={v => f('tags', v)} />
            </GlassCard>

            <GlassCard>
              <KeysPicker
                value={data.keys || (data.keyRoot ? [{ root: data.keyRoot, mode: data.keyMode || 'major' }] : [])}
                onChange={v => f('keys', v)}
              />
              <TimeSigPicker
                value={data.timeSigs || (data.timeSig ? [data.timeSig] : [])}
                onChange={v => f('timeSigs', v)}
              />
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}>
                  <Field label="♪ Reference tempo (bpm)">
                    <TextF value={data.tempo ? String(data.tempo) : ''} onChange={v => f('tempo', v.replace(/[^0-9]/g, ''))} placeholder="e.g. 92" />
                  </Field>
                </View>
                <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, flex: 1, marginBottom: 14 }}>
                  Drives the metronome default when you time a practice segment on this piece.
                </Text>
              </View>
              <DifficultyPicker value={data.difficulty || 0} onChange={v => f('difficulty', v)} />
              <Field label="⭐ Liking" style={{ marginBottom: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    {[1,2,3,4,5].map(n => (
                      <TouchableOpacity key={n} onPress={() => f('liking', data.liking === n ? 0 : n)} activeOpacity={0.75} hitSlop={{ top: 7, bottom: 7, left: 0, right: 0 }} style={{ paddingHorizontal: 8 }}>
                        <Text style={{ fontSize: SIZES.display, opacity: n <= (data.liking || 0) ? 1 : COLOURS.ratingEmpty, transform: [{ scale: n <= (data.liking || 0) ? 1 : 0.88 }] }}>⭐</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {(data.liking || 0) > 0 && (
                    <TouchableOpacity onPress={() => f('liking', 0)} activeOpacity={0.7} hitSlop={{ top: 14, bottom: 14, left: 6, right: 12 }}>
                      <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Field>
            </GlassCard>

            <GlassCard>
              <Field label="Status">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <View style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill,
                    backgroundColor: (STATUS_COLOURS[data.status] || {}).bg || COLOURS.w(0.50),
                  }}>
                    <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: (STATUS_COLOURS[data.status] || {}).text || COLOURS.textMuted }}>
                      {data.status || 'ambition'}
                    </Text>
                  </View>

                  {data.status !== 'ambition' && !data.shelvedAt && (
                    <TouchableOpacity
                      onPress={() => setData(d => ({ ...d, shelvedAt: todayISO(), status: 'shelved' }))}
                      activeOpacity={0.75}
                      hitSlop={HIT_PILL} style={{ ...TOUCH_PILL, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.55), shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 }}
                    >
                      <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.textDim }}>📦 Shelve now</Text>
                    </TouchableOpacity>
                  )}

                  {data.shelvedAt ? (
                    <TouchableOpacity
                      onPress={() => setData(d => ({ ...d, shelvedAt: '' }))}
                      activeOpacity={0.75}
                      hitSlop={HIT_PILL} style={{ ...TOUCH_PILL, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.55), shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 }}
                    >
                      <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.textDim }}>↺ Un-shelve</Text>
                    </TouchableOpacity>
                  ) : null}

                  <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, flex: 1, minWidth: 180 }}>
                    {data.shelvedAt
                      ? 'Manually shelved — logging a session or lesson for this piece will automatically resume it.'
                      : 'Derived automatically from your practice log — logging moves it out of ambition; 60+ days of inactivity rolls it to shelved.'}
                  </Text>
                </View>
              </Field>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 0 }}>
                <View style={{ flex: 1 }}>
                  <DatePickerF label="📅 Date started" value={data.dateStarted || ''} onChange={v => f('dateStarted', v)} />
                </View>
                <View style={{ flex: 1 }}>
                  <DatePickerF label="✅ Date completed" value={data.dateCompleted || ''} onChange={v => f('dateCompleted', v)} />
                </View>
              </View>
            </GlassCard>

            <GlassCard>
              <Field label="About this piece" style={{ marginBottom: 0 }}>
                <TextF value={data.info || ''} onChange={v => f('info', v)} placeholder="Style, context, history, why you're learning it…" multiline />
              </Field>
            </GlassCard>

            <GlassCard>
              <Field label="Technical challenges" icon="construct-outline">
                <TextF value={data.technicalChallenges || ''} onChange={v => f('technicalChallenges', v)} placeholder="Hand coordination, fingering, rhythm…" multiline />
              </Field>
              <Field label="Musical focus areas" icon="musical-notes-outline">
                <TextF value={data.musicalFocus || ''} onChange={v => f('musicalFocus', v)} placeholder="Phrasing, dynamics, character…" multiline />
              </Field>
              <Field label="Practice notes" icon="repeat-outline" style={{ marginBottom: 0 }}>
                <TextF value={data.practiceNotes || ''} onChange={v => f('practiceNotes', v)} placeholder="Approaches, methods, what works…" multiline />
              </Field>
            </GlassCard>

            <GlassCard>
              <Field label="Teacher's notes / assignment" icon="chatbubble-outline">
                <TextF value={data.kerrinNotes || ''} onChange={v => f('kerrinNotes', v)} placeholder="Teacher feedback, what to focus on…" multiline />
              </Field>
              <Field label="Teacher feedback log" icon="journal-outline" style={{ marginBottom: 0 }}>
                <TextF value={data.teacherFeedback || ''} onChange={v => f('teacherFeedback', v)} placeholder="Feedback from lessons over time…" multiline />
              </Field>
            </GlassCard>

            <GlassCard>
              <Field label="My notes" style={{ marginBottom: 0 }}>
                <TextF value={data.myNotes || ''} onChange={v => f('myNotes', v)} placeholder="Your own observations, discoveries…" multiline />
              </Field>
            </GlassCard>

            <GlassCard>
              <Field label="Sheet music source" icon="musical-notes-outline">
                <TextF value={data.resourceSheet || ''} onChange={v => f('resourceSheet', v)} placeholder="Where the score is from…" />
              </Field>
              <Field label="Recording references" icon="headset-outline">
                <TextF value={data.resourceRecordings || ''} onChange={v => f('resourceRecordings', v)} placeholder="Reference recordings, performers…" multiline />
              </Field>
              <Field label="Tutorial videos" icon="videocam-outline" style={{ marginBottom: 0 }}>
                <TextF value={data.resourceTutorials || ''} onChange={v => f('resourceTutorials', v)} placeholder="YouTube links, tutorial notes…" multiline />
              </Field>
            </GlassCard>

            <Btn label="Save piece" variant="primary" onPress={handleSave} style={{ marginTop: 4 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
