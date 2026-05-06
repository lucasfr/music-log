import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  Alert, KeyboardAvoidingView, Platform, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, STATUS_COLOURS } from '../theme';
import { SectionTitle, Btn, BtnRow, StatusPill, MetaChip, EmptyState } from '../components/UI';
import { Field, TextF, SelectF } from '../components/Form';
import { STATUS_OPTIONS, KEYS, MODES, TIME_SIGS, GRADES } from '../constants';
import { uid, fmtDate } from '../utils';

// ─── Zelda-style 🎹 difficulty ───────────────────────────────────────────────

const CELL_W = 36;
const TOTAL_CELLS = 5;

function DifficultyPicker({ value, onChange }) {
  const containerRef = useRef(null);
  const containerX   = useRef(0);

  function valueFromX(x) {
    const raw = Math.ceil((x - containerX.current) / CELL_W);
    return Math.max(0, Math.min(TOTAL_CELLS, raw));
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => { onChange(valueFromX(e.nativeEvent.pageX)); },
      onPanResponderMove:  (e) => { onChange(valueFromX(e.nativeEvent.pageX)); },
    })
  ).current;

  return (
    <Field label="Difficulty">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          ref={containerRef}
          onLayout={() => { containerRef.current?.measure((_x, _y, _w, _h, pageX) => { containerX.current = pageX; }); }}
          {...panResponder.panHandlers}
          style={{ flexDirection: 'row', gap: 2 }}
        >
          {[1, 2, 3, 4, 5].map(n => (
            <Text key={n} style={{ fontSize: 26, opacity: n <= value ? 1 : 0.18, transform: [{ scale: n <= value ? 1 : 0.88 }] }}>🎹</Text>
          ))}
        </View>
        {value > 0 && (
          <TouchableOpacity onPress={() => onChange(0)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim }}>clear</Text>
          </TouchableOpacity>
        )}
      </View>
    </Field>
  );
}

// ─── Tag input ────────────────────────────────────────────────────────────────

function TagInput({ value = [], onChange }) {
  const [input, setInput] = useState('');

  function addTag() {
    const tag = input.trim().toLowerCase().replace(/\s+/g, '-');
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setInput('');
  }

  return (
    <Field label="Tags">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {value.map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => onChange(value.filter(x => x !== t))}
            activeOpacity={0.75}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: 'rgba(214,40,40,0.12)', shadowColor: COLOURS.accentMid, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 1 }}
          >
            <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.navy }}>{t}</Text>
            <Text style={{ fontSize: 11, color: COLOURS.textDim }}>✕</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <TextF value={input} onChange={setInput} placeholder="Add tag…" />
        </View>
        <TouchableOpacity onPress={addTag} activeOpacity={0.8}
          style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.sm, backgroundColor: COLOURS.navy, justifyContent: 'center', shadowColor: COLOURS.glassShadowMd, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 }}>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: '#fff' }}>Add</Text>
        </TouchableOpacity>
      </View>
    </Field>
  );
}

// ─── Autocomplete field ───────────────────────────────────────────────────────

function AutocompleteField({ label, value, onChange, placeholder, suggestions }) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filtered = suggestions.filter(s =>
    s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase()
  );
  const showList = showSuggestions && value.length > 0 && filtered.length > 0;

  return (
    <Field label={label}>
      <View>
        <TextF
          value={value}
          onChange={v => { onChange(v); setShowSuggestions(true); }}
          placeholder={placeholder}
          style={showList ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 } : undefined}
        />
        {showList && (
          <View style={{
            borderBottomLeftRadius: RADIUS.sm,
            borderBottomRightRadius: RADIUS.sm,
            backgroundColor: 'rgba(255,255,255,0.95)',
            overflow: 'hidden',
            shadowColor: COLOURS.glassShadow,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 1,
            shadowRadius: 8,
            elevation: 4,
            zIndex: 100,
          }}>
            {filtered.slice(0, 5).map((s, i) => (
              <TouchableOpacity
                key={s}
                onPress={() => { onChange(s); setShowSuggestions(false); }}
                activeOpacity={0.75}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopColor: COLOURS.glassBorderSubtle,
                }}
              >
                <Text style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.text }}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </Field>
  );
}

// ─── Section divider ─────────────────────────────────────────────────────────

function SectionDivider({ label }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, marginTop: 8 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: COLOURS.glassBorderSubtle }} />
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: 10, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: COLOURS.glassBorderSubtle }} />
    </View>
  );
}

// ─── Composition modal ────────────────────────────────────────────────────────

function CompModal({ comp, onSave, onClose, composerSuggestions, arrangementSuggestions }) {
  const [data, setData] = useState({ ...comp });
  const f = (k, v) => setData(d => ({ ...d, [k]: v }));

  function handleSave() {
    if (!data.title) { Alert.alert('Title required'); return; }
    onSave(data);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: COLOURS.bg }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
          <BlurView intensity={50} tint="light" style={{ borderBottomWidth: 1, borderBottomColor: COLOURS.glassBorderSubtle }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLOURS.glass }}>
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 19, color: COLOURS.text }}>
                {comp.title ? '📜 Edit piece' : '📜 Add piece'}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={{ fontFamily: 'Lato-Bold', color: COLOURS.navy, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </SafeAreaView>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">

            <SectionDivider label="🏷️ Identity" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 3 }}>
                <Field label="📜 Title *">
                  <TextF value={data.title} onChange={v => f('title', v)} placeholder="e.g. Gymnopédie No. 1" />
                </Field>
              </View>
              <View style={{ flex: 2 }}>
                <AutocompleteField label="🎤 Composer" value={data.composer || ''} onChange={v => f('composer', v)} placeholder="e.g. Satie" suggestions={composerSuggestions} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <AutocompleteField label="🎻 Arrangement / arrangers" value={data.arrangement || ''} onChange={v => f('arrangement', v)} placeholder="e.g. Rachmaninoff" suggestions={arrangementSuggestions} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="📚 Collection">
                  <TextF value={data.collection || ''} onChange={v => f('collection', v)} placeholder="e.g. For Children Vol. 1" />
                </Field>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="📅 Year">
                  <TextF value={data.year || ''} onChange={v => f('year', v)} placeholder="e.g. 1888" />
                </Field>
              </View>
              <View style={{ flex: 2 }}>
                <SelectF label="🎓 Grade estimate" value={data.grade || ''} onChange={v => f('grade', v)} options={GRADES} placeholder="— Unknown —" />
              </View>
            </View>

            <TagInput value={data.tags || []} onChange={v => f('tags', v)} />

            <SectionDivider label="🎵 Musical properties" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><SelectF label="🎹 Key"      value={data.keyRoot || ''} onChange={v => f('keyRoot', v)} options={KEYS}      placeholder="—" /></View>
              <View style={{ flex: 1 }}><SelectF label="🌙 Mode"     value={data.keyMode || ''} onChange={v => f('keyMode', v)} options={MODES}     placeholder="—" /></View>
              <View style={{ flex: 1 }}><SelectF label="⏱ Time sig" value={data.timeSig || ''} onChange={v => f('timeSig', v)} options={TIME_SIGS} placeholder="—" /></View>
            </View>

            <DifficultyPicker value={data.difficulty || 0} onChange={v => f('difficulty', v)} />

            <Field label="⭐ Liking">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flexDirection: 'row', gap: 2 }}>
                  {[1,2,3,4,5].map(n => (
                    <TouchableOpacity key={n} onPress={() => f('liking', data.liking === n ? 0 : n)} activeOpacity={0.75}>
                      <Text style={{ fontSize: 26, opacity: n <= (data.liking || 0) ? 1 : 0.18, transform: [{ scale: n <= (data.liking || 0) ? 1 : 0.88 }] }}>⭐</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {(data.liking || 0) > 0 && (
                  <TouchableOpacity onPress={() => f('liking', 0)} activeOpacity={0.7} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
                    <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim }}>clear</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Field>

            <SectionDivider label="📊 Status" />
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
                        borderRadius: RADIUS.pill,
                        backgroundColor: active ? sc.bg : 'rgba(255,255,255,0.50)',
                        shadowColor: active ? sc.border : COLOURS.glassShadow,
                        shadowOffset: { width: 0, height: active ? 3 : 1 },
                        shadowOpacity: 1,
                        shadowRadius: active ? 8 : 4,
                        elevation: active ? 3 : 1,
                      }}
                    >
                      <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: 13, color: active ? sc.text : COLOURS.textMuted }}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Field>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="📅 Date started">
                  <TextF value={data.dateStarted || ''} onChange={v => f('dateStarted', v)} placeholder="YYYY-MM-DD" />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="✅ Date completed">
                  <TextF value={data.dateCompleted || ''} onChange={v => f('dateCompleted', v)} placeholder="YYYY-MM-DD" />
                </Field>
              </View>
            </View>

            <SectionDivider label="ℹ️ About" />
            <Field label="📝 About this piece">
              <TextF value={data.info || ''} onChange={v => f('info', v)} placeholder="Style, context, history, why you're learning it…" multiline />
            </Field>

            <SectionDivider label="📖 Study notes" />
            <Field label="🚧 Technical challenges">
              <TextF value={data.technicalChallenges || ''} onChange={v => f('technicalChallenges', v)} placeholder="Hand coordination, fingering, rhythm…" multiline />
            </Field>
            <Field label="🎶 Musical focus areas">
              <TextF value={data.musicalFocus || ''} onChange={v => f('musicalFocus', v)} placeholder="Phrasing, dynamics, character…" multiline />
            </Field>
            <Field label="🔄 Practice notes">
              <TextF value={data.practiceNotes || ''} onChange={v => f('practiceNotes', v)} placeholder="Approaches, methods, what works…" multiline />
            </Field>

            <SectionDivider label="🎓 Teacher" />
            <Field label="💬 Teacher's notes / assignment">
              <TextF value={data.kerrinNotes || ''} onChange={v => f('kerrinNotes', v)} placeholder="Teacher feedback, what to focus on…" multiline />
            </Field>
            <Field label="📚 Teacher feedback log">
              <TextF value={data.teacherFeedback || ''} onChange={v => f('teacherFeedback', v)} placeholder="Feedback from lessons over time…" multiline />
            </Field>

            <SectionDivider label="💡 My notes" />
            <Field label="💡 My notes" style={{ marginBottom: 0 }}>
              <TextF value={data.myNotes || ''} onChange={v => f('myNotes', v)} placeholder="Your own observations, discoveries…" multiline />
            </Field>

            <SectionDivider label="🔗 Resources" />
            <Field label="🎼 Sheet music source">
              <TextF value={data.resourceSheet || ''} onChange={v => f('resourceSheet', v)} placeholder="Where the score is from…" />
            </Field>
            <Field label="🎧 Recording references">
              <TextF value={data.resourceRecordings || ''} onChange={v => f('resourceRecordings', v)} placeholder="Reference recordings, performers…" multiline />
            </Field>
            <Field label="🎥 Tutorial videos" style={{ marginBottom: 0 }}>
              <TextF value={data.resourceTutorials || ''} onChange={v => f('resourceTutorials', v)} placeholder="YouTube links, tutorial notes…" multiline />
            </Field>

            <Btn label="Save piece" variant="primary" onPress={handleSave} style={{ marginTop: 24 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Composition card ─────────────────────────────────────────────────────────

function DifficultyDisplay({ value }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Text key={n} style={{ fontSize: 14, opacity: n <= value ? 1 : 0.18, transform: [{ scale: n <= value ? 1 : 0.88 }] }}>🎹</Text>
      ))}
    </View>
  );
}

function NoteSection({ label, value }) {
  if (!value) return null;
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{label}</Text>
      <Text style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.textMuted, lineHeight: 22 }}>{value}</Text>
    </View>
  );
}

function CompCard({ comp, sessions, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState('details');

  const compSessions = sessions
    .filter(s => (s.segments || []).some(sg => sg.compositionId === comp.id))
    .slice(0, 10);

  const TABS = ['details', 'notes', 'study', 'resources', 'sessions'];

  return (
    <BlurView intensity={32} tint="light" style={{
      borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 12,
      shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 20, elevation: 5,
    }}>
      <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.8} style={{ padding: 14, backgroundColor: COLOURS.glass }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 18, color: COLOURS.text, marginBottom: 2 }}>📜 {comp.title}</Text>
            {comp.composer ? <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textMuted }}>{comp.composer}</Text> : null}
            {comp.arrangement ? <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginTop: 1 }}>arr. {comp.arrangement}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6, marginLeft: 10 }}>
            <StatusPill status={comp.status} />
            <Text style={{ fontSize: 11, color: COLOURS.textDim }}>{expanded ? '▲' : '▼'}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, alignItems: 'center' }}>
          {comp.difficulty > 0 && <DifficultyDisplay value={comp.difficulty} />}
          {comp.liking > 0 && (
            <View style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
              {[1,2,3,4,5].map(n => (
                <Text key={n} style={{ fontSize: 14, opacity: n <= comp.liking ? 1 : 0.18 }}>⭐</Text>
              ))}
            </View>
          )}
          {comp.grade   ? <MetaChip label={comp.grade} /> : null}
          {comp.keyRoot ? <MetaChip label={`${comp.keyRoot} ${comp.keyMode || ''}`.trim()} /> : null}
          {comp.timeSig ? <MetaChip label={comp.timeSig} /> : null}
          {comp.collection ? <MetaChip label={comp.collection} /> : null}
          {(comp.tags || []).map(t => <MetaChip key={t} label={t} />)}
        </View>

        {(comp.dateStarted || comp.dateCompleted) && (
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
            {comp.dateStarted ? <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim }}>Started {comp.dateStarted}</Text> : null}
            {comp.dateCompleted ? <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim }}>Completed {comp.dateCompleted}</Text> : null}
          </View>
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={{ backgroundColor: 'rgba(255,255,255,0.30)' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row' }}>
              {TABS.map(t => (
                <TouchableOpacity key={t} onPress={() => setTab(t)}
                  style={{ paddingVertical: 11, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: tab === t ? COLOURS.navy : 'transparent' }}>
                  <Text style={{ fontFamily: tab === t ? 'Lato-Bold' : 'Lato', fontSize: 13, color: tab === t ? COLOURS.navy : COLOURS.textMuted }}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={{ padding: 14 }}>
            {tab === 'details' && (
              <>
                {comp.info ? <Text style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.textMuted, lineHeight: 22, marginBottom: 14 }}>{comp.info}</Text> : null}
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
                <NoteSection label="💬 Teacher's notes" value={comp.kerrinNotes} />
                <NoteSection label="📚 Teacher feedback" value={comp.teacherFeedback} />
                <NoteSection label="💡 My notes" value={comp.myNotes} />
                {!comp.kerrinNotes && !comp.teacherFeedback && !comp.myNotes &&
                  <Text style={{ fontFamily: 'Lato', color: COLOURS.textDim, fontSize: 13 }}>No notes yet.</Text>
                }
              </>
            )}

            {tab === 'study' && (
              <>
                <NoteSection label="🚧 Technical challenges" value={comp.technicalChallenges} />
                <NoteSection label="🎶 Musical focus areas" value={comp.musicalFocus} />
                <NoteSection label="🔄 Practice notes" value={comp.practiceNotes} />
                {!comp.technicalChallenges && !comp.musicalFocus && !comp.practiceNotes &&
                  <Text style={{ fontFamily: 'Lato', color: COLOURS.textDim, fontSize: 13 }}>No study notes yet.</Text>
                }
              </>
            )}

            {tab === 'resources' && (
              <>
                <NoteSection label="🎼 Sheet music" value={comp.resourceSheet} />
                <NoteSection label="🎧 Recording references" value={comp.resourceRecordings} />
                <NoteSection label="🎥 Tutorial videos" value={comp.resourceTutorials} />
                {!comp.resourceSheet && !comp.resourceRecordings && !comp.resourceTutorials &&
                  <Text style={{ fontFamily: 'Lato', color: COLOURS.textDim, fontSize: 13 }}>No resources added yet.</Text>
                }
              </>
            )}

            {tab === 'sessions' && (
              <>
                {compSessions.length === 0 ? (
                  <Text style={{ fontFamily: 'Lato', color: COLOURS.textDim, fontSize: 13 }}>No sessions logged yet for this piece.</Text>
                ) : compSessions.map(s => {
                  const seg = (s.segments || []).find(sg => sg.compositionId === comp.id);
                  return (
                    <View key={s.id} style={{ padding: 10, borderRadius: RADIUS.sm, backgroundColor: 'rgba(255,255,255,0.55)', shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2, marginBottom: 8 }}>
                      <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.text }}>{fmtDate(s.date)}</Text>
                      {seg?.section ? <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginTop: 2 }}>Section: {seg.section}</Text> : null}
                      {seg?.notes  ? <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textMuted, marginTop: 4, lineHeight: 19 }}>{seg.notes}</Text> : null}
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CompositionsScreen({ compositions, sessions, onSave, onDelete }) {
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const composerSuggestions = [...new Set(
    compositions.map(c => c.composer).filter(Boolean).sort()
  )];
  const arrangementSuggestions = [...new Set(
    compositions
      .map(c => c.arrangement).filter(Boolean)
      .flatMap(a => a.split(',').map(s => s.trim()))
      .filter(Boolean)
      .sort()
  )];

  const blank = () => ({
    id: uid(), title: '', composer: '', arrangement: '', collection: '',
    status: 'learning', grade: '', keyRoot: '', keyMode: '', timeSig: '',
    difficulty: 0, liking: 0, year: '', tags: [],
    dateStarted: '', dateCompleted: '',
    info: '', technicalChallenges: '', musicalFocus: '', practiceNotes: '',
    kerrinNotes: '', teacherFeedback: '', myNotes: '',
    resourceSheet: '', resourceRecordings: '', resourceTutorials: '',
    createdAt: new Date().toISOString(),
  });

  const filtered = compositions.filter(c => {
    const ms = c.title.toLowerCase().includes(search.toLowerCase())
      || (c.composer || '').toLowerCase().includes(search.toLowerCase())
      || (c.tags || []).some(t => t.includes(search.toLowerCase()));
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
          <TextF value={search} onChange={setSearch} placeholder="Search title, composer, or tag…" />
        </Field>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
          {['all', ...STATUS_OPTIONS].map(s => {
            const active = filterStatus === s;
            return (
              <TouchableOpacity key={s} onPress={() => setFilterStatus(s)} activeOpacity={0.75}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill,
                  backgroundColor: active ? 'rgba(247,127,0,0.14)' : 'rgba(255,255,255,0.55)',
                  shadowColor: active ? COLOURS.accent2Mid : COLOURS.glassShadow,
                  shadowOffset: { width: 0, height: active ? 4 : 1 },
                  shadowOpacity: 1,
                  shadowRadius: active ? 10 : 4,
                  elevation: active ? 4 : 1,
                }}>
                <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: 12, color: active ? COLOURS.navy : COLOURS.textMuted }}>{s}</Text>
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
        <CompModal
          comp={modal}
          onSave={c => { onSave(c); setModal(null); }}
          onClose={() => setModal(null)}
          composerSuggestions={composerSuggestions}
          arrangementSuggestions={arrangementSuggestions}
        />
      )}
    </SafeAreaView>
  );
}
