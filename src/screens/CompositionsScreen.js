import React, { useState } from 'react';
import { View, Text, ScrollView, Platform } from 'react-native';
import { Tap as TouchableOpacity } from '../components/Motion';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '../components/Icon';
import { COLOURS, RADIUS, SIZES, STATUS_COLOURS, TOUCH_PILL, HIT_PILL } from '../theme';
import { SectionTitle, EmptyState } from '../components/UI';
import { SwipeRow } from '../components/Gestures';
import { Field, TextF } from '../components/Form';
import { STATUS_OPTIONS } from '../constants';
import { uid } from '../utils';
import { PIECE_SORTS, sortPieces } from '../utils/planning';
import { parseTarget } from '../utils/insights';
import { usePref } from '../utils/usePref';
import { PieceDetailModal } from '../components/PieceDetailModal';
import { CompModal } from './compositions/CompModal';
import { CompCard } from './compositions/CompCard';

// The library. The piece form's fields, the form itself and a piece's card are in ./compositions; this
// file keeps the screen: the list, search, filters, sort and the add button.

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CompositionsScreen({ compositions, sessions, lessons, onSave, onDelete, isDesktop, onOpenTimeline }) {
  const [modal, setModal] = useState(null);
  // A piece's page (progress, tempo, tricky spots, lesson notes), opened from its card.
  const [pageId, setPageId] = useState(null);
  const [targetRaw] = usePref('gradeTarget', '');
  const examDate = (parseTarget(targetRaw) || {}).date || '';
  const pagePiece = pageId ? (compositions.find(c => c.id === pageId) || null) : null;
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('title');

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
    status: 'ambition', grade: '', keys: [], timeSigs: [],
    difficulty: 0, liking: 0, year: '', tags: [],
    dateStarted: '', dateCompleted: '',
    info: '', technicalChallenges: '', musicalFocus: '', practiceNotes: '',
    kerrinNotes: '', teacherFeedback: '', myNotes: '',
    resourceSheet: '', resourceRecordings: '', resourceTutorials: '',
    createdAt: new Date().toISOString(),
  });

  const filtered = sortPieces(compositions, sessions, sortBy).filter(c => {
    const ms = c.title.toLowerCase().includes(search.toLowerCase())
      || (c.composer || '').toLowerCase().includes(search.toLowerCase())
      || (c.tags || []).some(t => t.includes(search.toLowerCase()));
    return ms && (filterStatus === 'all' || c.status === filterStatus);
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingLeft: isDesktop ? 226 : 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ marginBottom: 14, marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionTitle style={{ marginBottom: 0 }}>Compositions</SectionTitle>
          {/* The Timeline isn't in the tab bar, so this is how you reach it on a phone. */}
          {onOpenTimeline ? (
            <TouchableOpacity onPress={onOpenTimeline} activeOpacity={0.75} hitSlop={HIT_PILL}
              accessibilityRole="button" accessibilityLabel="Open the timeline of your library"
              style={{ ...TOUCH_PILL, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: COLOURS.steelA(0.14) }}>
              <Ionicons name="git-branch" size={16} color={COLOURS.navy} />
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.navy }}>Timeline</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Field label="">
          <TextF value={search} onChange={setSearch} placeholder="Search title, composer, or tag…" />
        </Field>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {['all', ...STATUS_OPTIONS].map(s => {
            const active = filterStatus === s;
            return (
              <TouchableOpacity key={s} onPress={() => setFilterStatus(s)} activeOpacity={0.75}
                hitSlop={HIT_PILL} style={{ ...TOUCH_PILL,
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill,
                  backgroundColor: active && s !== 'all' ? (STATUS_COLOURS[s]?.bg || COLOURS.accent2Light) : active ? COLOURS.accent2Light : COLOURS.w(0.55),
                  shadowColor: active && s !== 'all' ? (STATUS_COLOURS[s]?.border || COLOURS.accent2Mid) : active ? COLOURS.accent2Mid : COLOURS.glassShadow,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: active ? 0.6 : 0.5,
                  shadowRadius: active ? 10 : 6,
                  elevation: active ? 4 : 1,
                }}>
                <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: SIZES.label, color: active ? COLOURS.navy : COLOURS.textMuted }}>{s}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 2 }}>Sort</Text>
          {PIECE_SORTS.map(o => {
            const active = sortBy === o.key;
            return (
              <TouchableOpacity key={o.key} onPress={() => setSortBy(o.key)} activeOpacity={0.75} hitSlop={HIT_PILL}
                accessibilityRole="radio" accessibilityLabel={`Sort by ${o.label}`} accessibilityState={{ selected: active }}
                style={{ ...TOUCH_PILL, paddingHorizontal: 12, borderRadius: RADIUS.pill, backgroundColor: active ? COLOURS.navy : COLOURS.w(0.55) }}>
                <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: SIZES.label, color: active ? COLOURS.onNavy : COLOURS.textMuted }}>{o.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {filtered.length === 0 && <EmptyState icon="♩" text="No pieces yet. Add your current repertoire." />}

        {filtered.map((comp, idx) => (
          <SwipeRow key={comp.id} bottomInset={12} hint={idx === 0} label="Remove"
            onDelete={() => onDelete(comp.id)}>
            <CompCard comp={comp} sessions={sessions} onEdit={c => setModal({ ...c })} onDelete={onDelete} onOpenPage={setPageId} />
          </SwipeRow>
        ))}
      </ScrollView>

      <TouchableOpacity
        onPress={() => setModal(blank())}
        activeOpacity={0.85}
        style={{
          position: 'absolute',
          bottom: Platform.OS === 'web' ? 100 : Platform.OS === 'ios' ? 140 : 120,
          right: 20,
          width: 58, height: 58, borderRadius: RADIUS.pill,
          backgroundColor: COLOURS.float,
          borderWidth: 1, borderColor: COLOURS.w(0.9),
          alignItems: 'center', justifyContent: 'center',
          shadowColor: COLOURS.accentMid, shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.55, shadowRadius: 16, elevation: 8,
        }}
      >
        <Text style={{ fontSize: SIZES.screenTitle, color: COLOURS.text, lineHeight: 32, marginTop: -2 }}>+</Text>
      </TouchableOpacity>

      {modal && (
        <CompModal
          key={modal.id}
          comp={modal}
          onSave={c => { onSave(c); setModal(null); }}
          onClose={() => setModal(null)}
          composerSuggestions={composerSuggestions}
          arrangementSuggestions={arrangementSuggestions}
        />
      )}
    <PieceDetailModal
      visible={!!pagePiece}
      piece={pagePiece}
      sessions={sessions}
      lessons={lessons || []}
      examDate={examDate}
      onSavePiece={onSave}
      onClose={() => setPageId(null)}
    />
    </SafeAreaView>
  );
}
