import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, PanResponder } from 'react-native';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS } from '../theme';
import { TagCloud, Label } from './UI';
import { Field, TextF, NumberF, SelectF } from './Form';
import { TECH_GROUPS, CHALLENGE_TAGS, PROGRESS_TAGS } from '../constants';

// ─── Zelda bar (reused from LogModal pattern) ────────────────────────────────

const CELL_W = 36;
const CELLS  = 5;

function ZeldaBar({ label, emoji, value, onChange }) {
  const containerRef = useRef(null);
  const containerX   = useRef(0);

  function valueFromX(x) {
    const raw = Math.ceil((x - containerX.current) / CELL_W);
    return Math.max(1, Math.min(CELLS, raw));
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: e => onChange(valueFromX(e.nativeEvent.pageX)),
      onPanResponderMove:  e => onChange(valueFromX(e.nativeEvent.pageX)),
    })
  ).current;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          ref={containerRef}
          onLayout={() => containerRef.current?.measure((_x, _y, _w, _h, pageX) => { containerX.current = pageX; })}
          {...panResponder.panHandlers}
          style={{ flexDirection: 'row', gap: 2 }}
        >
          {[1, 2, 3, 4, 5].map(n => (
            <Text key={n} style={{ fontSize: 22, opacity: n <= value ? 1 : 0.18, transform: [{ scale: n <= value ? 1 : 0.88 }] }}>
              {emoji}
            </Text>
          ))}
        </View>
        {value > 0 && (
          <TouchableOpacity onPress={() => onChange(0)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ fontFamily: 'SourceSans3', fontSize: 12, color: COLOURS.textDim }}>clear</Text>
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
              <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 10, color: accentColor, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {isTech ? 'technique' : 'repertoire'}
              </Text>
            </View>
            <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 14, color: COLOURS.text }}>
              {segment.title || (isTech ? 'Technical work' : 'Piece')}
            </Text>
          </View>
          {segment.duration ? (
            <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: COLOURS.textDim, marginTop: 2 }}>{segment.duration} min</Text>
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
        <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: COLOURS.glassBorder, backgroundColor: 'rgba(255,255,255,0.30)' }}>
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
                          borderRadius: RADIUS.pill, borderWidth: 1,
                          borderColor: active ? COLOURS.steel : COLOURS.glassBorder,
                          backgroundColor: active ? COLOURS.accent2Light : COLOURS.glass,
                        }}
                      >
                        <Text style={{ fontFamily: active ? 'SourceSans3-Bold' : 'SourceSans3', fontSize: 13, color: active ? COLOURS.navy : COLOURS.textMuted }}>
                          {g}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Field>
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
        </View>
      )}
    </BlurView>
  );
}
