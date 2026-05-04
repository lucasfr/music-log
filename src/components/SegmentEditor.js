import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
} from 'react-native';
import { useTheme, RADIUS } from '../theme';
import { TagCloud, Label, Btn, BtnRow } from './UI';
import { Field, TextF, NumberF, SelectF } from './Form';
import {
  TECH_GROUPS, CHALLENGE_TAGS, PROGRESS_TAGS,
} from '../constants';

export function SegmentEditor({ segment, onChange, onRemove, compositions }) {
  const C = useTheme();
  const [open, setOpen] = useState(true);
  const isTech = segment.type === 'technique';

  const field = (k, v) => onChange({ ...segment, [k]: v });
  const toggleTag = (key, tag) => {
    const cur = segment[key] || [];
    field(key, cur.includes(tag) ? cur.filter(t => t !== tag) : [...cur, tag]);
  };

  const linkedComp = compositions.find(c => c.id === segment.compositionId);
  const typeColor = isTech ? C.accent2 : C.accent;

  return (
    <View style={{
      borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md,
      backgroundColor: C.card, marginBottom: 10, overflow: 'hidden',
    }}>
      {/* Header */}
      <TouchableOpacity
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: typeColor, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {isTech ? 'technique' : 'repertoire'}
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '500', color: C.ink }}>
              {segment.title || (isTech ? 'Technical work' : 'Piece')}
            </Text>
          </View>
          {segment.duration ? (
            <Text style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>{segment.duration} min</Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={onRemove}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ fontSize: 16, color: C.danger }}>✕</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 12, color: C.ink3 }}>{open ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {open && (
        <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: C.border }}>
          {isTech ? (
            <>
              <Field label="Technique group">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {TECH_GROUPS.map(g => {
                    const active = segment.group === g;
                    return (
                      <TouchableOpacity
                        key={g}
                        onPress={() => field('group', g)}
                        activeOpacity={0.7}
                        style={{
                          paddingHorizontal: 12, paddingVertical: 5,
                          borderRadius: 20, borderWidth: 1,
                          borderColor: active ? C.accent2 : C.border2,
                          backgroundColor: active ? C.accent2Light : C.surface,
                        }}
                      >
                        <Text style={{ fontSize: 12, color: active ? C.accent2 : C.ink2, fontWeight: active ? '500' : '400' }}>{g}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Field>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Label (optional)">
                    <TextF value={segment.title || ''} onChange={v => field('title', v)} placeholder="e.g. Hanon No. 1" />
                  </Field>
                </View>
                <View style={{ width: 90 }}>
                  <Field label="Duration (min)">
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
                  <Field label="Duration (min)">
                    <NumberF value={segment.duration || ''} onChange={v => field('duration', v)} />
                  </Field>
                </View>
              </View>
              {!linkedComp && (
                <Field label="Piece name (if not in library)">
                  <TextF value={segment.title || ''} onChange={v => field('title', v)} placeholder="Title" />
                </Field>
              )}
              <Field label="Section practiced">
                <TextF value={segment.section || ''} onChange={v => field('section', v)} placeholder="e.g. Bars 1–16, full piece…" />
              </Field>
            </>
          )}

          <Field label="Notes">
            <TextF value={segment.notes || ''} onChange={v => field('notes', v)} placeholder="Observations, what clicked, what to work on…" multiline />
          </Field>

          <Field label="Challenge tags">
            <TagCloud tags={CHALLENGE_TAGS} selected={segment.challenges || []} onToggle={t => toggleTag('challenges', t)} />
          </Field>

          <Field label="Progress tags" style={{ marginBottom: 0 }}>
            <TagCloud tags={PROGRESS_TAGS} selected={segment.progress || []} onToggle={t => toggleTag('progress', t)} />
          </Field>
        </View>
      )}
    </View>
  );
}
