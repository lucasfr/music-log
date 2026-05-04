import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, STATUS_COLOURS } from '../theme';
import { GlassCard, Card, SectionTitle, Btn, BtnRow, StatusPill, MetaChip, EmptyState } from '../components/UI';
import { Field, TextF, SelectF } from '../components/Form';
import { STATUS_OPTIONS, KEYS, MODES, TIME_SIGS, GRADES } from '../constants';
import { uid, fmtDate } from '../utils';

function CompModal({ comp, onSave, onClose }) {
  const [data, setData] = useState({ ...comp });
  const f = (k, v) => setData(d => ({ ...d, [k]: v }));

  function handleSave() {
    if (!data.title) { Alert.alert('Title required'); return; }
    onSave(data);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: COLOURS.bg }}>
        {/* Header */}
        <SafeAreaView edges={['top']} style={{ backgroundColor: COLOURS.glass }}>
          <BlurView intensity={50} tint="light" style={{ borderBottomWidth: 1, borderBottomColor: COLOURS.glassBorder }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLOURS.glass }}>
              <Text style={{ fontFamily: 'LibreBaskerville-Italic', fontSize: 19, color: COLOURS.text }}>
                {comp.title ? 'Edit piece' : 'Add piece'}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={{ fontFamily: 'SourceSans3-Bold', color: COLOURS.navy, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </SafeAreaView>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="Title *">
                  <TextF value={data.title} onChange={v => f('title', v)} placeholder="e.g. Gymnopédie No. 1" />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Composer">
                  <TextF value={data.composer || ''} onChange={v => f('composer', v)} placeholder="e.g. Satie" />
                </Field>
              </View>
            </View>

            <Field label="Status">
              <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
                {STATUS_OPTIONS.map(s => {
                  const active = data.status === s;
                  const sc = STATUS_COLOURS[s];
                  return (
                    <TouchableOpacity
                      key={s} onPress={() => f('status', s)} activeOpacity={0.75}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 7,
                        borderRadius: RADIUS.pill, borderWidth: 1,
                        borderColor: active ? sc.border : COLOURS.glassBorder,
                        backgroundColor: active ? sc.bg : 'rgba(255,255,255,0.50)',
                      }}
                    >
                      <Text style={{ fontFamily: active ? 'SourceSans3-Bold' : 'SourceSans3', fontSize: 13, color: active ? sc.text : COLOURS.textMuted }}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Field>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><SelectF label="Key"      value={data.keyRoot || ''} onChange={v => f('keyRoot', v)} options={KEYS}      placeholder="—" /></View>
              <View style={{ flex: 1 }}><SelectF label="Mode"     value={data.keyMode || ''} onChange={v => f('keyMode', v)} options={MODES}     placeholder="—" /></View>
              <View style={{ flex: 1 }}><SelectF label="Time sig" value={data.timeSig || ''} onChange={v => f('timeSig', v)} options={TIME_SIGS} placeholder="—" /></View>
            </View>

            <SelectF label="Grade estimate" value={data.grade || ''} onChange={v => f('grade', v)} options={GRADES} placeholder="— Unknown —" />

            <Field label="About this piece">
              <TextF value={data.info || ''} onChange={v => f('info', v)} placeholder="Style, context, why you're learning it…" multiline />
            </Field>

            <Field label="Teacher's notes / assignment">
              <TextF value={data.kerrinNotes || ''} onChange={v => f('kerrinNotes', v)} placeholder="Teacher feedback, what to focus on…" multiline />
            </Field>

            <Field label="My notes" style={{ marginBottom: 0 }}>
              <TextF value={data.myNotes || ''} onChange={v => f('myNotes', v)} placeholder="Your own observations, discoveries…" multiline />
            </Field>

            <Btn label="Save piece" variant="primary" onPress={handleSave} style={{ marginTop: 20 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function CompCard({ comp, sessions, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState('details');

  const compSessions = sessions
    .filter(s => (s.segments || []).some(sg => sg.compositionId === comp.id))
    .slice(0, 8);

  return (
    <BlurView
      intensity={32}
      tint="light"
      style={{
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLOURS.glassBorder,
        overflow: 'hidden',
        marginBottom: 12,
        shadowColor: COLOURS.glassShadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 14,
        elevation: 4,
      }}
    >
      <TouchableOpacity
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.8}
        style={{ padding: 14, backgroundColor: COLOURS.glass }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'LibreBaskerville-Italic', fontSize: 18, color: COLOURS.text, marginBottom: 3 }}>{comp.title}</Text>
            {comp.composer ? <Text style={{ fontFamily: 'SourceSans3', fontSize: 13, color: COLOURS.textMuted }}>{comp.composer}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginLeft: 10 }}>
            <StatusPill status={comp.status} />
            <Text style={{ fontSize: 11, color: COLOURS.textDim }}>{expanded ? '▲' : '▼'}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {comp.grade   ? <MetaChip label={comp.grade} /> : null}
          {comp.keyRoot ? <MetaChip label={`${comp.keyRoot} ${comp.keyMode || ''}`.trim()} /> : null}
          {comp.timeSig ? <MetaChip label={comp.timeSig} /> : null}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={{ borderTopWidth: 1, borderTopColor: COLOURS.glassBorder, backgroundColor: 'rgba(255,255,255,0.30)' }}>
          {/* Tabs */}
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLOURS.glassBorder }}>
            {['details', 'notes', 'sessions'].map(t => (
              <TouchableOpacity key={t} onPress={() => setTab(t)}
                style={{ flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: tab === t ? COLOURS.navy : 'transparent' }}>
                <Text style={{ fontFamily: tab === t ? 'SourceSans3-Bold' : 'SourceSans3', fontSize: 13, color: tab === t ? COLOURS.navy : COLOURS.textMuted }}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ padding: 14 }}>
            {tab === 'details' && (
              <>
                {comp.info ? <Text style={{ fontFamily: 'SourceSans3', fontSize: 14, color: COLOURS.textMuted, lineHeight: 22, marginBottom: 14 }}>{comp.info}</Text> : null}
                <BtnRow>
                  <Btn label="Remove" variant="danger" onPress={() => Alert.alert('Remove piece?', comp.title, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => onDelete(comp.id) },
                  ])} />
                  <Btn label="Edit" onPress={() => onEdit(comp)} />
                </BtnRow>
              </>
            )}

            {tab === 'notes' && (
              <>
                {comp.kerrinNotes ? (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                      Teacher's notes
                    </Text>
                    <Text style={{ fontFamily: 'SourceSans3', fontSize: 14, color: COLOURS.textMuted, lineHeight: 22 }}>{comp.kerrinNotes}</Text>
                  </View>
                ) : null}
                {comp.myNotes ? (
                  <View>
                    <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                      My notes
                    </Text>
                    <Text style={{ fontFamily: 'SourceSans3', fontSize: 14, color: COLOURS.textMuted, lineHeight: 22 }}>{comp.myNotes}</Text>
                  </View>
                ) : null}
                {!comp.kerrinNotes && !comp.myNotes ? (
                  <Text style={{ fontFamily: 'SourceSans3', color: COLOURS.textDim, fontSize: 13 }}>No notes yet. Edit this piece to add them.</Text>
                ) : null}
              </>
            )}

            {tab === 'sessions' && (
              <>
                {compSessions.length === 0 ? (
                  <Text style={{ fontFamily: 'SourceSans3', color: COLOURS.textDim, fontSize: 13 }}>No sessions logged yet for this piece.</Text>
                ) : compSessions.map(s => {
                  const seg = (s.segments || []).find(sg => sg.compositionId === comp.id);
                  return (
                    <View key={s.id} style={{ padding: 10, borderRadius: RADIUS.sm, backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 1, borderColor: COLOURS.glassBorder, marginBottom: 8 }}>
                      <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 13, color: COLOURS.text }}>{fmtDate(s.date)}</Text>
                      {seg?.section ? <Text style={{ fontFamily: 'SourceSans3', fontSize: 12, color: COLOURS.textDim, marginTop: 2 }}>Section: {seg.section}</Text> : null}
                      {seg?.notes  ? <Text style={{ fontFamily: 'SourceSans3', fontSize: 13, color: COLOURS.textMuted, marginTop: 4, lineHeight: 19 }}>{seg.notes}</Text>   : null}
                    </View>
                  );
                })}
              </>
            )}
          </View>
        </View>
      )}
    </BlurView>
  );
}

export default function CompositionsScreen({ compositions, sessions, onSave, onDelete }) {
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const blank = () => ({ id: uid(), title: '', composer: '', status: 'learning', grade: '', keyRoot: '', keyMode: '', timeSig: '', info: '', kerrinNotes: '', myNotes: '', createdAt: new Date().toISOString() });

  const filtered = compositions.filter(c => {
    const ms = c.title.toLowerCase().includes(search.toLowerCase()) || (c.composer || '').toLowerCase().includes(search.toLowerCase());
    return ms && (filterStatus === 'all' || c.status === filterStatus);
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, marginTop: 4 }}>
          <SectionTitle style={{ marginBottom: 0 }}>Compositions</SectionTitle>
          <Btn label="+ Add piece" variant="primary" onPress={() => setModal(blank())} />
        </View>

        <Field label="">
          <TextF value={search} onChange={setSearch} placeholder="Search by title or composer…" />
        </Field>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
          {['all', ...STATUS_OPTIONS].map(s => {
            const active = filterStatus === s;
            return (
              <TouchableOpacity key={s} onPress={() => setFilterStatus(s)} activeOpacity={0.75}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: active ? COLOURS.navy : COLOURS.glassBorder, backgroundColor: active ? COLOURS.accentLight : COLOURS.glass }}>
                <Text style={{ fontFamily: active ? 'SourceSans3-Bold' : 'SourceSans3', fontSize: 12, color: active ? COLOURS.navy : COLOURS.textMuted }}>{s}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {filtered.length === 0 && <EmptyState icon="♩" text="No pieces yet. Add your current repertoire." />}

        {filtered.map(comp => (
          <CompCard key={comp.id} comp={comp} sessions={sessions} onEdit={c => setModal({ ...c })} onDelete={onDelete} />
        ))}
      </ScrollView>

      {modal && (
        <CompModal comp={modal} onSave={c => { onSave(c); setModal(null); }} onClose={() => setModal(null)} />
      )}
    </SafeAreaView>
  );
}
