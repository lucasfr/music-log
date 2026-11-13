// The form fields used by the piece editor: difficulty, tags, an autocomplete field, keys and time
// signatures. Moved out of CompositionsScreen.js unchanged.

import React, { useState, useRef } from 'react';
import { View, Text, PanResponder } from 'react-native';
import { Tap as TouchableOpacity } from '../../components/Motion';
import { COLOURS, RADIUS, SIZES, TOUCH_PILL, HIT_PILL, HIT_TEXT } from '../../theme';
import { Field, TextF, SelectF } from '../../components/Form';
import { KEYS, MODES, TIME_SIGS } from '../../constants';

// ─── Zelda-style 🎹 difficulty ───────────────────────────────────────────────

const CELL_W = 36;
const TOTAL_CELLS = 5;

export function DifficultyPicker({ value, onChange }) {
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
            <Text key={n} style={{ fontSize: SIZES.display, opacity: n <= value ? 1 : COLOURS.ratingEmpty, transform: [{ scale: n <= value ? 1 : 0.88 }] }}>🎹</Text>
          ))}
        </View>
        {value > 0 && (
          <TouchableOpacity onPress={() => onChange(0)} activeOpacity={0.7} hitSlop={HIT_TEXT}>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>clear</Text>
          </TouchableOpacity>
        )}
      </View>
    </Field>
  );
}

// ─── Tag input ────────────────────────────────────────────────────────────────

export function TagInput({ value = [], onChange }) {
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
            hitSlop={HIT_PILL} style={{ ...TOUCH_PILL, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: COLOURS.accentLight, shadowColor: COLOURS.accentMid, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 1 }}
          >
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.navy }}>{t}</Text>
            <Text style={{ fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>✕</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <TextF value={input} onChange={setInput} placeholder="Add tag…" />
        </View>
        <TouchableOpacity onPress={addTag} activeOpacity={0.8}
          hitSlop={HIT_PILL} style={{ ...TOUCH_PILL, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.sm, backgroundColor: COLOURS.navy, justifyContent: 'center', shadowColor: COLOURS.glassShadowMd, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 }}>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.onNavy }}>Add</Text>
        </TouchableOpacity>
      </View>
    </Field>
  );
}

// ─── Autocomplete field ───────────────────────────────────────────────────────

export function AutocompleteField({ label, value, onChange, placeholder, suggestions }) {
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
            backgroundColor: COLOURS.float,
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
                  minHeight: 44,
                  justifyContent: 'center',
                  paddingVertical: 10,
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopColor: COLOURS.glassBorderSubtle,
                }}
              >
                <Text style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.text }}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </Field>
  );
}

// ─── Keys picker ─────────────────────────────────────────────────────────────
// Manages an array of { root, mode } objects for pieces with multiple keys

export function KeysPicker({ value = [], onChange }) {
  // Migrate legacy single-key data on first render
  const keys = value;

  function addKey() {
    onChange([...keys, { root: '', mode: 'major' }]);
  }
  function updateKey(i, field, v) {
    const updated = keys.map((k, idx) => idx === i ? { ...k, [field]: v } : k);
    onChange(updated);
  }
  function removeKey(i) {
    onChange(keys.filter((_, idx) => idx !== i));
  }

  return (
    <Field label="🎹 Keys">
      <View style={{ gap: 8 }}>
        {keys.map((k, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <SelectF
                label=""
                value={k.root || ''}
                onChange={v => updateKey(i, 'root', v)}
                options={KEYS}
                placeholder="Root"
              />
            </View>
            <View style={{ flex: 1 }}>
              <SelectF
                label=""
                value={k.mode || 'major'}
                onChange={v => updateKey(i, 'mode', v)}
                options={MODES}
                placeholder="Mode"
              />
            </View>
            <TouchableOpacity
              onPress={() => removeKey(i)}
              hitSlop={{ top: 12, bottom: 4, left: 14, right: 14 }}
              style={{ paddingBottom: 14 }}
            >
              <Text style={{ fontSize: SIZES.body, color: COLOURS.danger, fontWeight: '300' }}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          onPress={addKey}
          activeOpacity={0.75}
          hitSlop={HIT_PILL} style={{ ...TOUCH_PILL,
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill,
            backgroundColor: COLOURS.w(0.55), alignSelf: 'flex-start',
            shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2,
          }}
        >
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.navy }}>+ Add key</Text>
        </TouchableOpacity>
      </View>
    </Field>
  );
}

// ─── Time sig picker ─────────────────────────────────────────────────────────

export function TimeSigPicker({ value = [], onChange }) {
  function toggle(sig) {
    onChange(value.includes(sig) ? value.filter(s => s !== sig) : [...value, sig]);
  }
  return (
    <Field label="⏱ Time signatures">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {TIME_SIGS.map(sig => {
          const active = value.includes(sig);
          return (
            <TouchableOpacity key={sig} onPress={() => toggle(sig)} activeOpacity={0.75}
              hitSlop={HIT_PILL} style={{ ...TOUCH_PILL,
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill,
                backgroundColor: active ? COLOURS.steelA(0.14) : COLOURS.w(0.55),
                shadowColor: active ? COLOURS.tealBorder : COLOURS.glassShadow,
                shadowOffset: { width: 0, height: active ? 3 : 1 },
                shadowOpacity: 1, shadowRadius: active ? 8 : 4, elevation: active ? 3 : 1,
              }}>
              <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: SIZES.bodySmall, color: active ? COLOURS.navy : COLOURS.textMuted }}>{sig}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Field>
  );
}
