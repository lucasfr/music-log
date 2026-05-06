import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, PanResponder } from 'react-native';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS } from '../theme';
import { TagCloud, Label } from './UI';
import { Field, TextF, NumberF, SelectF } from './Form';
import { TECH_GROUPS, SCALE_OPTIONS, CHALLENGE_TAGS, PROGRESS_TAGS } from '../constants';

// ─── Zelda bar (reused from LogModal pattern) ────────────────────────────────

const CELL_W = 36;
const CELLS  = 5;

function ZeldaBar({ label, emoji, value, onChange }) {
  const lastValue = useRef(value);

  lastValue.current = value;

  function valueFromX(x) {
    const raw = Math.floor(x / CELL_W) + 1;
    return Math.max(1, Math.min(CELLS, raw));
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: e => {
        const v = valueFromX(e.nativeEvent.locationX);
        onChange(v === lastValue.current ? 0 : v);
      },
      onPanResponderMove: e => onChange(valueFromX(e.nativeEvent.locationX)),
    })
  ).current;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          {...panResponder.panHandlers}
          style={{ flexDirection: 'row', gap: 2, cursor: 'default' }}
        >
          {[1, 2, 3, 4, 5].map(n => (
            <Text key={n} style={{ fontSize: 22, opacity: n <= value ? 1 : 0.18, transform: [{ scale: n <= value ? 1 : 0.88 }], userSelect: 'none' }}>
              {emoji}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Scales / arpeggios picker ─────────────────────────────────────────────
// Multi-select with search filter and + to add more

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
      {/* Selected chips */}
      {selected.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {selected.map(s => (
            <TouchableOpacity
              key={s}
              onPress={() => toggle(s)}
              activeOpacity={0.75}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill, backgroundColor: 'rgba(8,131,149,0.14)', shadowColor: COLOURS.tealBorder, shadowOffset:{width:0,height:1}, shadowOpacity:1, shadowRadius:4, elevation:1 }}
            >
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.navy }}>{s}</Text>
              <Text style={{ fontSize: 11, color: COLOURS.textDim }}>✕</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search */}
      <TextF
        value={filter}
        onChange={setFilter}
        placeholder="Search scales…"
        style={{ marginBottom: 8 }}
      />

      {/* Options grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {visible.map(s => {
          const active = selected.includes(s);
          return (
            <TouchableOpacity
              key={s}
              onPress={() => toggle(s)}
              activeOpacity={0.75}
              style={{
                paddingHorizontal: 10, paddingVertical: 5,
                borderRadius: RADIUS.pill,
                backgroundColor: active ? 'rgba(8,131,149,0.14)' : 'rgba(255,255,255,0.55)',
                shadowColor: active ? COLOURS.tealBorder : COLOURS.glassShadow,
                shadowOffset: { width: 0, height: active ? 3 : 1 },
                shadowOpacity: 1, shadowRadius: active ? 8 : 4, elevation: active ? 3 : 1,
              }}
            >
              <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: 12, color: active ? COLOURS.navy : COLOURS.textMuted }}>{s}</Text>
            </TouchableOpacity>
          );
        })}
        {hasMore && (
          <TouchableOpacity
            onPress={() => setShowAll(true)}
            activeOpacity={0.75}
            style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill, backgroundColor: COLOURS.tealAccent, shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:1}, shadowOpacity:1, shadowRadius:4, elevation:1 }}
          >
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.navy }}>+ more</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export function SegmentEditor({ segment, onChange, onRemove, compositions }) {
  const [open, setOpen] = useState(true);
  const isTech = segment.type === 'technique';
  const field = (k, v) => onChange({ ...segment, [k]: v });
  const toggleTag = (key, tag) => {
    const cur = segment[key] || [];
    field(key, cur.includes(tag) ? cur.filter(t => t !== tag) : [...cur, tag]);
  };
  const linkedComp = compositions.find(c => c.id === segment.compositionId);
  const accentColor = isTech ? COLOURS.steel : COLOURS.navy;

  return (
    <BlurView
      intensity={36}
      tint="light"
      style={{
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLOURS.glassBorder,
        overflow: 'hidden',
        marginBottom: 10,
        shadowColor: COLOURS.glassShadow,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 3,
      }}
    >
      {/* Header */}
      <TouchableOpacity
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.75}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, backgroundColor: COLOURS.glass }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: isTech ? COLOURS.accent2Light : COLOURS.accentLight }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 10, color: accentColor, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {isTech ? 'technique' : 'repertoire'}
              </Text>
            </View>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.text }}>
              {segment.title || (isTech ? 'Technical work' : 'Piece')}
            </Text>
          </View>
          {segment.duration ? (
            <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim, marginTop: 2 }}>{segment.duration} min</Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ fontSize: 16, color: COLOURS.danger, fontWeight: '300' }}>✕</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 11, color: COLOURS.textDim }}>{open ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {open && (
        <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()} style={{ padding: 14, borderTopWidth: 1, borderTopColor: COLOURS.glassBorder, backgroundColor: 'rgba(255,255,255,0.30)' }}>
          {isTech ? (
            <>
              <Field label="🎹 Technique group">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                  {TECH_GROUPS.map(g => {
                    const active = segment.group === g;
                    return (
                      <TouchableOpacity
                        key={g}
                        onPress={() => field('group', g)}
                        activeOpacity={0.75}
                        style={{
                          paddingHorizontal: 12, paddingVertical: 6,
                          borderRadius: RADIUS.pill,
                          backgroundColor: active ? 'rgba(8,131,149,0.14)' : 'rgba(255,255,255,0.55)',
                          shadowColor: active ? COLOURS.tealBorder : COLOURS.glassShadow,
                          shadowOffset: { width: 0, height: active ? 3 : 1 },
                          shadowOpacity: 1, shadowRadius: active ? 8 : 4, elevation: active ? 3 : 1,
                        }}
                      >
                        <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: 13, color: active ? COLOURS.navy : COLOURS.textMuted }}>
                          {g}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Field>

              {(segment.group === 'Scales' || segment.group === 'Arpeggios') && (
                <Field label={`🎵 ${segment.group} practiced`}>
                  <ScalesPicker
                    selected={segment.scales || []}
                    onChange={v => field('scales', v)}
                  />
                </Field>
              )}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field label="🏷️ Label (optional)">
                    <TextF value={segment.title || ''} onChange={v => field('title', v)} placeholder="e.g. Hanon No. 1" />
                  </Field>
                </View>
                <View style={{ width: 90 }}>
                  <Field label="⏱ Duration (min)">
                    <NumberF value={segment.duration || ''} onChange={v => field('duration', v)} />
                  </Field>
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <SelectF
                    label="Piece"
                    value={segment.compositionId || ''}
                    onChange={id => {
                      const comp = compositions.find(c => c.id === id);
                      onChange({ ...segment, compositionId: id, title: comp ? comp.title : segment.title });
                    }}
                    options={compositions.map(c => ({ value: c.id, label: c.title }))}
                    placeholder="— Select or type —"
                  />
                </View>
                <View style={{ width: 90 }}>
                  <Field label="⏱ Duration (min)">
                    <NumberF value={segment.duration || ''} onChange={v => field('duration', v)} />
                  </Field>
                </View>
              </View>
              {!linkedComp && (
                <Field label="Piece name (if not in library)">
                  <TextF value={segment.title || ''} onChange={v => field('title', v)} placeholder="Title" />
                </Field>
              )}
              <Field label="🎼 Section practiced">
                <TextF value={segment.section || ''} onChange={v => field('section', v)} placeholder="e.g. Bars 1–16, full piece…" />
              </Field>
            </>
          )}

          <Field label="📝 Notes">
            <TextF value={segment.notes || ''} onChange={v => field('notes', v)} placeholder="Observations, what clicked, what to work on…" multiline />
          </Field>

          <Field label="🎵 Felt difficulty">
            <ZeldaBar emoji="🎵" value={segment.feltDifficulty || 0} onChange={v => field('feltDifficulty', v)} />
          </Field>

          <Field label="🚧 Challenge tags">
            <TagCloud tags={CHALLENGE_TAGS} selected={segment.challenges || []} onToggle={t => toggleTag('challenges', t)} />
          </Field>

          <Field label="✅ Progress tags" style={{ marginBottom: 0 }}>
            <TagCloud tags={PROGRESS_TAGS} selected={segment.progress || []} onToggle={t => toggleTag('progress', t)} />
          </Field>
        </TouchableOpacity>
      )}
    </BlurView>
  );
}
