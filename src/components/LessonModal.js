import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, Modal, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS } from '../theme';
import { GlassCard, SectionTitle, Btn, TagCloud } from '../components/UI';
import { Field, TextF, NumberF, SelectF } from '../components/Form';
import { TECH_GROUPS, SCALE_OPTIONS, CHALLENGE_TAGS, PROGRESS_TAGS } from '../constants';
import { uid } from '../utils';

// ─── Zelda bar ────────────────────────────────────────────────────────────────

const CELL_W = 36;
const CELLS  = 5;

function ZeldaBar({ emoji, value, onChange }) {
  const containerRef = useRef(null);
  const containerX   = useRef(0);
  function valueFromX(x) {
    return Math.max(1, Math.min(CELLS, Math.ceil((x - containerX.current) / CELL_W)));
  }
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: e => onChange(valueFromX(e.nativeEvent.pageX)),
    onPanResponderMove:  e => onChange(valueFromX(e.nativeEvent.pageX)),
  })).current;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        ref={containerRef}
        onLayout={() => containerRef.current?.measure((_x, _y, _w, _h, px) => { containerX.current = px; })}
        {...pan.panHandlers}
        style={{ flexDirection: 'row', gap: 2 }}
      >
        {[1,2,3,4,5].map(n => (
          <Text key={n} style={{ fontSize: 22, opacity: n <= value ? 1 : 0.18, transform: [{ scale: n <= value ? 1 : 0.88 }] }}>{emoji}</Text>
        ))}
      </View>
      {value > 0 && (
        <TouchableOpacity onPress={() => onChange(0)} activeOpacity={0.7} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
          <Text style={{ fontFamily: 'SourceSans3', fontSize: 12, color: COLOURS.textDim }}>clear</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Scales picker (shared with SegmentEditor) ───────────────────────────────────────

function ScalesPicker({ selected = [], onChange }) {
  const [filter, setFilter] = useState('');
  const [showAll, setShowAll] = useState(false);

  const filtered = SCALE_OPTIONS.filter(s =>
    filter.length === 0 || s.toLowerCase().includes(filter.toLowerCase())
  );
  const visible = showAll || filter.length > 0 ? filtered : filtered.slice(0, 16);
  const hasMore = !showAll && filter.length === 0 && filtered.length > 16;

  function toggle(scale) {
    onChange(selected.includes(scale)
      ? selected.filter(s => s !== scale)
      : [...selected, scale]
    );
  }

  return (
    <View>
      {selected.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {selected.map(s => (
            <TouchableOpacity key={s} onPress={() => toggle(s)} activeOpacity={0.75}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill, backgroundColor: 'rgba(8,131,149,0.14)', shadowColor: COLOURS.tealBorder, shadowOffset:{width:0,height:1}, shadowOpacity:1, shadowRadius:4, elevation:1 }}>
              <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 13, color: COLOURS.navy }}>{s}</Text>
              <Text style={{ fontSize: 11, color: COLOURS.textDim }}>✕</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <TextF value={filter} onChange={setFilter} placeholder="Search scales…" style={{ marginBottom: 8 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {visible.map(s => {
          const active = selected.includes(s);
          return (
            <TouchableOpacity key={s} onPress={() => toggle(s)} activeOpacity={0.75}
              style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill,
                backgroundColor: active ? 'rgba(8,131,149,0.14)' : 'rgba(255,255,255,0.55)',
                shadowColor: active ? COLOURS.tealBorder : COLOURS.glassShadow,
                shadowOffset: { width: 0, height: active ? 3 : 1 }, shadowOpacity: 1, shadowRadius: active ? 8 : 4, elevation: active ? 3 : 1 }}>
              <Text style={{ fontFamily: active ? 'SourceSans3-Bold' : 'SourceSans3', fontSize: 12, color: active ? COLOURS.navy : COLOURS.textMuted }}>{s}</Text>
            </TouchableOpacity>
          );
        })}
        {hasMore && (
          <TouchableOpacity onPress={() => setShowAll(true)} activeOpacity={0.75}
            style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill, backgroundColor: COLOURS.tealAccent, shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:1}, shadowOpacity:1, shadowRadius:4, elevation:1 }}>
            <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 12, color: COLOURS.navy }}>+ more</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Lesson segment editor ───────────────────────────────────────────────────
// Same structure as SegmentEditor but with lesson-specific fields added:
// teacher feedback, assignment, new piece toggle.

function LessonSegmentEditor({ item, onChange, onRemove, compositions }) {
  const [open, setOpen] = useState(true);
  const f = (k, v) => onChange({ ...item, [k]: v });
  const toggleTag = (key, tag) => {
    const cur = item[key] || [];
    f(key, cur.includes(tag) ? cur.filter(t => t !== tag) : [...cur, tag]);
  };

  const isTech     = item.type === 'technique';
  const linkedComp = compositions.find(c => c.id === item.compositionId);
  const accentColor = isTech ? COLOURS.steel : COLOURS.navy;

  const displayName = isTech
    ? (item.group || item.title || 'Technical work')
    : (linkedComp ? linkedComp.title : (item.pieceName || 'Piece'));

  return (
    <View style={{
      borderRadius: RADIUS.md,
      marginBottom: 10,
      backgroundColor: COLOURS.glass,
      shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3,
    }}>
      {/* Header */}
      <TouchableOpacity
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.75}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, backgroundColor: COLOURS.glass }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Type toggle pills */}
            <TouchableOpacity
              onPress={() => onChange({ ...item, type: 'technique', compositionId: '', pieceName: '' })}
              activeOpacity={0.75}
              style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: isTech ? COLOURS.accent2Light : 'transparent', borderWidth: 1, borderColor: isTech ? COLOURS.steel : COLOURS.glassBorder }}
            >
              <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 10, color: isTech ? COLOURS.navy : COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>technique</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onChange({ ...item, type: 'repertoire', group: '' })}
              activeOpacity={0.75}
              style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: !isTech ? COLOURS.accentLight : 'transparent', borderWidth: 1, borderColor: !isTech ? COLOURS.navy : COLOURS.glassBorder }}
            >
              <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 10, color: !isTech ? COLOURS.navy : COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>repertoire</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 14, color: COLOURS.text, marginTop: 4 }}>{displayName}</Text>
          {item.isNew && (
            <View style={{ marginTop: 3, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLOURS.pinkLight, borderWidth: 1, borderColor: 'rgba(221,174,211,0.40)' }}>
              <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 10, color: '#5C2D6E' }}>new piece</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ fontSize: 16, color: COLOURS.danger }}>✕</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 11, color: COLOURS.textDim }}>{open ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {open && (
        <View style={{ padding: 14, backgroundColor: 'rgba(255,255,255,0.30)' }}>

          {isTech ? (
            <>
              <Field label="🎹 Technique group">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                  {TECH_GROUPS.map(g => {
                    const active = item.group === g;
                    return (
                      <TouchableOpacity key={g} onPress={() => f('group', g)} activeOpacity={0.75}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill,
                          backgroundColor: active ? 'rgba(8,131,149,0.14)' : 'rgba(255,255,255,0.55)',
                          shadowColor: active ? COLOURS.tealBorder : COLOURS.glassShadow,
                          shadowOffset: { width: 0, height: active ? 3 : 1 }, shadowOpacity: 1, shadowRadius: active ? 8 : 4, elevation: active ? 3 : 1 }}>
                        <Text style={{ fontFamily: active ? 'SourceSans3-Bold' : 'SourceSans3', fontSize: 13, color: active ? COLOURS.navy : COLOURS.textMuted }}>{g}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Field>

              {(item.group === 'Scales' || item.group === 'Arpeggios') && (
                <Field label={`🎵 ${item.group} practiced`}>
                  <ScalesPicker selected={item.scales || []} onChange={v => f('scales', v)} />
                </Field>
              )}
              <Field label="Label (optional)">
                <TextF value={item.title || ''} onChange={v => f('title', v)} placeholder="e.g. Hanon No. 1" />
              </Field>
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <SelectF
                    label="Piece"
                    value={item.compositionId || ''}
                    onChange={id => {
                      const comp = compositions.find(c => c.id === id);
                      onChange({ ...item, compositionId: id, pieceName: comp ? comp.title : item.pieceName });
                    }}
                    options={compositions.map(c => ({ value: c.id, label: c.title }))}
                    placeholder="— Select or type —"
                  />
                </View>
                <View style={{ width: 80 }}>
                  <Field label="New piece?">
                    <TouchableOpacity
                      onPress={() => f('isNew', !item.isNew)}
                      activeOpacity={0.75}
                      style={{ paddingVertical: 10, paddingHorizontal: 10, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: item.isNew ? COLOURS.navy : COLOURS.glassBorder, backgroundColor: item.isNew ? COLOURS.accentLight : 'rgba(255,255,255,0.50)', alignItems: 'center' }}
                    >
                      <Text style={{ fontFamily: 'SourceSans3', fontSize: 13, color: item.isNew ? COLOURS.navy : COLOURS.textMuted }}>{item.isNew ? 'Yes ✓' : 'No'}</Text>
                    </TouchableOpacity>
                  </Field>
                </View>
              </View>
              {!linkedComp && (
                <Field label="Piece name (if not in library)">
                  <TextF value={item.pieceName || ''} onChange={v => f('pieceName', v)} placeholder="Title" />
                </Field>
              )}
              <Field label="Section worked on">
                <TextF value={item.section || ''} onChange={v => f('section', v)} placeholder="e.g. Bars 1–16, full piece…" />
              </Field>
            </>
          )}

          <Field label="💬 Teacher feedback">
            <TextF value={item.feedback || ''} onChange={v => f('feedback', v)} placeholder="What the teacher said about this piece…" multiline />
          </Field>

          <Field label="📚 Assignment for next lesson">
            <TextF value={item.assignment || ''} onChange={v => f('assignment', v)} placeholder="What to practise before next lesson…" multiline />
          </Field>

          <Field label="🎵 Felt difficulty">
            <ZeldaBar emoji="🎵" value={item.feltDifficulty || 0} onChange={v => f('feltDifficulty', v)} />
          </Field>

          <Field label="⭐ Liking" style={{ marginBottom: 0 }}>
            <ZeldaBar emoji="⭐" value={item.liking || 0} onChange={v => f('liking', v)} />
          </Field>

          <Field label="🚧 Challenge tags">
            <TagCloud tags={CHALLENGE_TAGS} selected={item.challenges || []} onToggle={t => toggleTag('challenges', t)} />
          </Field>

          <Field label="✅ Progress tags" style={{ marginBottom: 0 }}>
            <TagCloud tags={PROGRESS_TAGS} selected={item.progress || []} onToggle={t => toggleTag('progress', t)} />
          </Field>
        </View>
      )}
    </View>
  );
}

// ─── Lesson modal ─────────────────────────────────────────────────────────────

export function LessonModal({ visible, onClose, onSave, compositions, initialDate }) {
  const [date, setDate]               = useState(initialDate || '');
  const [teacher, setTeacher]         = useState('');
  const [duration, setDuration]       = useState('60');
  const [energy, setEnergy]           = useState(0);
  const [enjoyment, setEnjoyment]     = useState(0);
  const [pieces, setPieces]           = useState([]);
  const [overallNotes, setOverallNotes] = useState('');
  const [wins, setWins]               = useState('');
  const [nextFocus, setNextFocus]     = useState('');

  useEffect(() => {
    if (visible) {
      setDate(initialDate || '');
      setTeacher('');
      setDuration('60');
      setEnergy(0);
      setEnjoyment(0);
      setPieces([]);
      setOverallNotes('');
      setWins('');
      setNextFocus('');
    }
  }, [visible, initialDate]);

  function addPiece(type = 'repertoire') {
    setPieces(p => [...p, { id: uid(), type, compositionId: '', pieceName: '', title: '', group: '', feedback: '', assignment: '', isNew: false, section: '', feltDifficulty: 0, liking: 0, challenges: [], progress: [] }]);
  }
  function updatePiece(id, val) { setPieces(p => p.map(x => x.id === id ? val : x)); }
  function removePiece(id)      { setPieces(p => p.filter(x => x.id !== id)); }

  function handleSave() {
    if (!date) { Alert.alert('Date required'); return; }
    onSave({
      id: uid(), type: 'lesson', date, teacher,
      duration: Number(duration) || 60,
      energy: energy || null,
      enjoyment: enjoyment || null,
      pieces, overallNotes, wins, nextFocus,
      createdAt: new Date().toISOString(),
    });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLOURS.bg }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
          <BlurView intensity={50} tint="light" style={{ borderBottomWidth: 1, borderBottomColor: COLOURS.glassBorder }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLOURS.glass }}>
              <View>
                <Text style={{ fontFamily: 'LibreBaskerville-Italic', fontSize: 19, color: COLOURS.text }}>🎓 Log lesson</Text>
                <Text style={{ fontFamily: 'SourceSans3', fontSize: 12, color: COLOURS.textDim, marginTop: 1 }}>with {teacher}</Text>
              </View>
              <TouchableOpacity onPress={onClose}>
                <Text style={{ fontFamily: 'SourceSans3-Bold', color: COLOURS.navy, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </SafeAreaView>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">

            <GlassCard>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field label="📅 Date">
                    <TextF value={date} onChange={setDate} placeholder="YYYY-MM-DD" />
                  </Field>
                </View>
                <View style={{ width: 100 }}>
                  <Field label="⏱ Duration (min)">
                    <NumberF value={duration} onChange={setDuration} />
                  </Field>
                </View>
              </View>
              <Field label="🎼 Teacher" style={{ marginBottom: 0 }}>
                <TextF value={teacher} onChange={setTeacher} placeholder="Teacher name" />
              </Field>
            </GlassCard>

            <GlassCard>
              <Field label="Energy">
                <ZeldaBar emoji="⚡" value={energy} onChange={setEnergy} />
              </Field>
              <Field label="Enjoyment" style={{ marginBottom: 0 }}>
                <ZeldaBar emoji="❤️" value={enjoyment} onChange={setEnjoyment} />
              </Field>
            </GlassCard>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 }}>
              <SectionTitle style={{ marginBottom: 0 }}>Segments</SectionTitle>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => addPiece('technique')} activeOpacity={0.75}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOURS.steel, backgroundColor: COLOURS.accent2Light }}>
                  <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 12, color: COLOURS.navy }}>+ Technique</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => addPiece('repertoire')} activeOpacity={0.75}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOURS.navy, backgroundColor: COLOURS.accentLight }}>
                  <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 12, color: COLOURS.navy }}>+ Repertoire</Text>
                </TouchableOpacity>
              </View>
            </View>

            {pieces.length === 0 && (
              <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: COLOURS.glassBorder, borderRadius: RADIUS.md, padding: 24, alignItems: 'center', marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.25)' }}>
                <Text style={{ fontFamily: 'SourceSans3', color: COLOURS.textDim, fontSize: 14 }}>Add technique and repertoire segments worked on in this lesson</Text>
              </View>
            )}

            {pieces.map(item => (
              <LessonSegmentEditor
                key={item.id}
                item={item}
                compositions={compositions}
                onChange={val => updatePiece(item.id, val)}
                onRemove={() => removePiece(item.id)}
              />
            ))}

            <GlassCard>
              <Field label="✨ Overall lesson notes">
                <TextF value={overallNotes} onChange={setOverallNotes} placeholder="General observations from the lesson…" multiline />
              </Field>
              <Field label="🌟 Wins / breakthroughs">
                <TextF value={wins} onChange={setWins} placeholder="What clicked or was confirmed today…" multiline />
              </Field>
              <Field label="🎯 Focus before next lesson" style={{ marginBottom: 0 }}>
                <TextF value={nextFocus} onChange={setNextFocus} placeholder="Overall priority until next lesson…" multiline />
              </Field>
            </GlassCard>

            <Btn label="Save lesson" variant="primary" onPress={handleSave} style={{ marginTop: 4 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
