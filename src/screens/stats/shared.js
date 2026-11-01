import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '../../components/Icon';
import { COLOURS, RADIUS, SIZES, TOUCH_PILL, HIT_PILL } from '../../theme';
import { Tap as TouchableOpacity } from '../../components/Motion';

export const STATUS_EMOJI = {
  new:                 '🌿',
  learning:            '🌱',
  consolidating:       '💧',
  'performance-ready': '✨',
  shelved:             '📦',
  ambition:            '🌟',
};

export function ZeldaBarFractional({ emoji, fill, total = 5, size = 22 }) {
  return (
    <View style={{ flexDirection: 'row', position: 'relative' }}>
      {/* Dim base row */}
      {Array.from({ length: total }, (_, i) => (
        <Text key={i} style={{ fontSize: size, opacity: COLOURS.ratingEmpty }}>{emoji}</Text>
      ))}
      {/* Filled overlay — clipped to fill width */}
      <View style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${(fill / total) * 100}%`,
        overflow: 'hidden',
        flexDirection: 'row',
      }}>
        {Array.from({ length: total }, (_, i) => (
          <Text key={i} style={{ fontSize: size }}>{emoji}</Text>
        ))}
      </View>
    </View>
  );
}

// Helpers shared by the Stats sections.

export function weekLabel(isoWeek) {
  const [year, w] = isoWeek.split('-W');
  const jan4 = new Date(Number(year), 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1) + (Number(w) - 1) * 7);
  return monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Which x-axis date labels fit, and where they anchor, is in utils/chartLabels.js (labelIndices,
// labelAnchor): the newest label is always shown and no two are closer than a label's width.

// A diamond marker, so a second series on a chart differs from the first in shape as well as colour.
export function diamondPath(x, y, r = 4.5) {
  return `M${x},${y - r} L${x + r},${y} L${x},${y + r} L${x - r},${y} Z`;
}

export function TouchableYear({ onPress, icon, label, disabled = false }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }} activeOpacity={0.7}
      accessibilityRole="button" accessibilityLabel={label || (icon === 'chevron-back' ? 'Previous year' : 'Next year')}
      style={{ ...TOUCH_PILL, width: 48, alignItems: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.55), opacity: disabled ? 0.3 : 1 }}>
      <Ionicons name={icon} size={24} color={COLOURS.navy} />
    </TouchableOpacity>
  );
}

// Generic pill-row toggle used for the scale coverage filters below.
// A row of filter toggles. Any number can be on, and none on means everything, so there is no "All".
// Tapping a pill switches it on or off; "Clear" appears only while something is on.
function TogglePills({ options, selected, onToggle }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {options.map(o => {
        const active = selected.includes(o.key);
        return (
          <TouchableOpacity key={String(o.key)} onPress={() => onToggle(o.key)} activeOpacity={0.75}
            hitSlop={HIT_PILL}
            accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`${o.label} filter`}
            style={{ ...TOUCH_PILL,
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill,
              backgroundColor: active ? COLOURS.navy : COLOURS.w(0.55),
              shadowColor: active ? COLOURS.glassShadowMd : COLOURS.glassShadow,
              shadowOffset: { width: 0, height: active ? 2 : 1 },
              shadowOpacity: 1, shadowRadius: active ? 6 : 3, elevation: active ? 2 : 1,
            }}>
            <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: SIZES.labelSmall, color: active ? COLOURS.onNavy : COLOURS.textMuted }}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function FilterRow({ label, options, selected, onToggle, onClear }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.tiny, color: COLOURS.textDim }}>{label}</Text>
        {selected.length > 0 ? (
          <TouchableOpacity onPress={onClear} activeOpacity={0.75} hitSlop={HIT_PILL}
            accessibilityRole="button" accessibilityLabel={`Clear the ${label} filter`}>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.tiny, color: COLOURS.steel }}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <TogglePills options={options} selected={selected} onToggle={onToggle} />
      </ScrollView>
    </View>
  );
}
