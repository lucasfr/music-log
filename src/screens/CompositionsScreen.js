import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, RADIUS } from '../theme';
import {
  SectionTitle, Btn, BtnRow, StatusPill, MetaChip,
  TagCloud, Divider, EmptyState,
} from '../components/UI';
import { Field, TextF, SelectF } from '../components/Form';
import {
  STATUS_OPTIONS, KEYS, MODES, TIME_SIGS, GRADES,
} from '../constants';
import { uid, fmtDate } from '../utils';

function CompModal({ comp, onSave, onClose }) {
  const C = useTheme();
  const [data, setData] = useState({ ...comp });
  const f = (k, v) => setData(d => ({ ...d, [k]: v }));

  const STATUS_COLORS = {
    learning:            { bg: '#FFF7ED', text: '#92400E', border: '#FED7AA' },
    consolidating:       { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
    'performance-ready': { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
  };

  function handleSave() {
    if (!data.title) { Alert.alert('Title required'); return; }
    onSave(data);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: C.surface }} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ fontFamily: 'serif', fontSize: 19, color: C.ink }}>
              {comp.title ? 'Edit piece' : 'Add piece'}
            </Text>
            <TouchableOpacity onPress={onClose}><Text style={{ color: C.accent, fontSize: 16 }}>Cancel</Text></TouchableOpacity>
          </View>
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
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {STATUS_OPTIONS.map(s => {
                  const active = data.status === s;
                  const sc = STATUS_COLORS[s];
                  return (
                    <TouchableOpacity
                      key={s}
                      onPress={() => f('status', s)}
                      activeOpacity={0.7}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 5,
                        borderRadius: 20, borderWidth: 1,
                        borderColor: active ? sc.border : C.border2,
                        backgroundColor: active ? sc.bg : C.surface,
                      }}
                    >
                      <Text style={{ fontSize: 12, color: active ? sc.text : C.ink2, fontWeight: active ? '500' : '400' }}>{s}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Field>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <SelectF label="Key" value={data.keyRoot || ''} onChange={v => f('keyRoot', v)} options={KEYS} placeholder="—" />
              </View>
              <View style={{ flex: 1 }}>
                <SelectF label="Mode" value={data.keyMode || ''} onChange={v => f('keyMode', v)} options={MODES} placeholder="—" />
              </View>
              <View style={{ flex: 1 }}>
                <SelectF label="Time sig" value={data.timeSig || ''} onChange={v => f('timeSig', v)} options={TIME_SIGS} placeholder="—" />
              </View>
            </View>

            <SelectF label="Grade estimate" value={data.grade || ''} onChange={v => f('grade', v)} options={GRADES} placeholder="— Unknown —" />

            <Field label="About this piece">
              <TextF value={data.info || ''} onChange={v => f('info', v)} placeholder="Style, context, why you're learning it…" multiline />
            </Field>

            <Field label="Kerrin's notes / assignment">
              <TextF value={data.kerrinNotes || ''} onChange={v => f('kerrinNotes', v)} placeholder="Teacher feedback, what to focus on…" multiline />
            </Field>

            <Field label="My notes" style={{ marginBottom: 0 }}>
              <TextF value={data.myNotes || ''} onChange={v => f('myNotes', v)} placeholder="Your own observations, discoveries…" multiline />
            </Field>

            <BtnRow style={{ marginTop: 20 }}>
              <Btn label="Save piece" variant="primary" onPress={handleSave} style={{ flex: 1 }} />
            </BtnRow>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function CompCard({ comp, sessions, onEdit, onDelete }) {
  const C = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState('details');

  const compSessions = sessions
    .filter(s => (s.segments || []).some(sg => sg.compositionId === comp.id))
    .slice(0, 8);

  return (
    <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md, backgroundColor: C.card, marginBottom: 12, overflow: 'hidden' }}>
      <TouchableOpacity
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.7}
        style={{ padding: 14 }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'serif', fontSize: 17, color: C.ink, fontStyle: 'italic', marginBottom: 3 }}>{comp.title}</Text>
            {comp.composer ? <Text style={{ fontSize: 13, color: C.ink2 }}>{comp.composer}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginLeft: 10 }}>
            <StatusPill status={comp.status} />
            <Text style={{ fontSize: 12, color: C.ink3 }}>{expanded ? '▲' : '▼'}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {comp.grade ? <MetaChip label={comp.grade} /> : null}
          {comp.keyRoot ? <MetaChip label={`${comp.keyRoot} ${comp.keyMode || ''}`.trim()} /> : null}
          {comp.timeSig ? <MetaChip label={comp.timeSig} /> : null}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={{ borderTopWidth: 1, borderTopColor: C.border }}>
          {/* Tabs */}
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border }}>
            {['details', 'notes', 'sessions'].map(t => (
              <TouchableOpacity key={t} onPress={() => setTab(t)} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: tab === t ? C.accent : 'transparent' }}>
                <Text style={{ fontSize: 13, color: tab === t ? C.accent : C.ink3, fontWeight: tab === t ? '500' : '400' }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ padding: 14 }}>
            {tab === 'details' && (
              <>
                {comp.info ? <Text style={{ fontSize: 14, color: C.ink2, lineHeight: 21, marginBottom: 14 }}>{comp.info}</Text> : null}
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
                    <Text style={{ fontSize: 11, fontWeight: '600', color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Kerrin's notes</Text>
                    <Text style={{ fontSize: 14, color: C.ink2, lineHeight: 21 }}>{comp.kerrinNotes}</Text>
                  </View>
                ) : null}
                {comp.myNotes ? (
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>My notes</Text>
                    <Text style={{ fontSize: 14, color: C.ink2, lineHeight: 21 }}>{comp.myNotes}</Text>
                  </View>
                ) : null}
                {!comp.kerrinNotes && !comp.myNotes ? (
                  <Text style={{ color: C.ink3, fontSize: 13 }}>No notes yet. Edit this piece to add them.</Text>
                ) : null}
              </>
            )}

            {tab === 'sessions' && (
              <>
                {compSessions.length === 0 ? (
                  <Text style={{ color: C.ink3, fontSize: 13 }}>No sessions logged yet for this piece.</Text>
                ) : compSessions.map(s => {
                  const seg = (s.segments || []).find(sg => sg.compositionId === comp.id);
                  return (
                    <View key={s.id} style={{ padding: 10, borderRadius: RADIUS.sm, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, marginBottom: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: C.ink }}>{fmtDate(s.date)}</Text>
                      {seg?.section ? <Text style={{ fontSize: 12, color: C.ink3, marginTop: 2 }}>Section: {seg.section}</Text> : null}
                      {seg?.notes ? <Text style={{ fontSize: 13, color: C.ink2, marginTop: 4, lineHeight: 19 }}>{seg.notes}</Text> : null}
                    </View>
                  );
                })}
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

export default function CompositionsScreen({ compositions, sessions, onSave, onDelete }) {
  const C = useTheme();
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const blank = () => ({ id: uid(), title: '', composer: '', status: 'learning', grade: '', keyRoot: '', keyMode: '', timeSig: '', info: '', kerrinNotes: '', myNotes: '', createdAt: new Date().toISOString() });

  const filtered = compositions.filter(c => {
    const ms = c.title.toLowerCase().includes(search.toLowerCase()) || (c.composer || '').toLowerCase().includes(search.toLowerCase());
    const mf = filterStatus === 'all' || c.status === filterStatus;
    return ms && mf;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.surface }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <SectionTitle style={{ marginBottom: 0 }}>Compositions</SectionTitle>
          <Btn label="+ Add piece" variant="primary" onPress={() => setModal(blank())} />
        </View>

        <Field label="">
          <TextF value={search} onChange={setSearch} placeholder="Search by title or composer…" />
        </Field>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {['all', ...STATUS_OPTIONS].map(s => {
            const active = filterStatus === s;
            return (
              <TouchableOpacity key={s} onPress={() => setFilterStatus(s)} activeOpacity={0.7}
                style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: active ? C.accent : C.border2, backgroundColor: active ? C.accentLight : C.surface }}>
                <Text style={{ fontSize: 12, color: active ? C.accent : C.ink2, fontWeight: active ? '500' : '400' }}>{s}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {filtered.length === 0 && <EmptyState icon="♩" text="No pieces yet. Add your current repertoire." />}

        {filtered.map(comp => (
          <CompCard
            key={comp.id}
            comp={comp}
            sessions={sessions}
            onEdit={c => setModal({ ...c })}
            onDelete={onDelete}
          />
        ))}
      </ScrollView>

      {modal && (
        <CompModal
          comp={modal}
          onSave={c => { onSave(c); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
    </SafeAreaView>
  );
}
