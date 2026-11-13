// Settings > Appearance: one chip per registered theme (plus System), and the colour scheme chips.
// Moved out of SettingsScreen.js unchanged.

import React from 'react';
import { View, Text } from 'react-native';
import { Tap as TouchableOpacity } from '../../components/Motion';
import { Ionicons } from '../../components/Icon';
import { COLOURS, RADIUS, SIZES, TOUCH_PILL, HIT_PILL, THEMES, themeKey } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import { GlassCard, SectionHeader } from './parts';

export function AppearanceSection() {
  const { pref: themePref, setTheme, options: themeOptions, scheme: themeScheme, setScheme, schemes } = useTheme();
  const THEME_ICONS = { system: 'phone-portrait-outline', light: 'sunny-outline', dark: 'moon-outline' };

  return (
    <>
      <SectionHeader>Appearance</SectionHeader>
      <GlassCard>
        <View style={{ padding: 14 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {themeOptions.map(o => {
              const active = themePref === o.key;
              return (
                <TouchableOpacity
                  key={o.key}
                  onPress={() => { if (!active) setTheme(o.key, { resume: 'Settings' }); }}
                  activeOpacity={0.75}
                  hitSlop={HIT_PILL}
                  accessibilityRole="radio"
                  accessibilityLabel={`${o.label} theme`}
                  accessibilityState={{ selected: active }}
                  style={{
                    ...TOUCH_PILL, flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 14, borderRadius: RADIUS.pill,
                    backgroundColor: active ? COLOURS.navy : COLOURS.navyA(0.10),
                  }}
                >
                  <Ionicons name={THEME_ICONS[o.key] || 'color-palette-outline'} size={16} color={active ? COLOURS.onNavy : COLOURS.textMuted} />
                  <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: SIZES.bodySmall, color: active ? COLOURS.onNavy : COLOURS.textMuted }}>{o.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.text, marginTop: 18, marginBottom: 8 }}>Colour scheme</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {schemes.map(s => {
              const active = themeScheme === s.key;
              // The dots show the scheme in the mode you are in now: its base colour, its second colour and its page.
              const p = THEMES[themeKey(s.key, COLOURS.isDark ? 'dark' : 'light')].colours;
              return (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => { if (!active) setScheme(s.key, { resume: 'Settings' }); }}
                  activeOpacity={0.75}
                  hitSlop={HIT_PILL}
                  accessibilityRole="radio"
                  accessibilityLabel={`${s.label} colour scheme`}
                  accessibilityState={{ selected: active }}
                  style={{
                    ...TOUCH_PILL, flexDirection: 'row', alignItems: 'center', gap: 8,
                    paddingHorizontal: 14, borderRadius: RADIUS.pill,
                    backgroundColor: active ? COLOURS.navy : COLOURS.navyA(0.10),
                  }}
                >
                  <View style={{ flexDirection: 'row' }}>
                    {[p.navy, p.steel, p.bg].map((c, i) => (
                      <View key={i} style={{ width: 14, height: 14, borderRadius: RADIUS.pill, backgroundColor: c, marginLeft: i ? -4 : 0, borderWidth: 1, borderColor: active ? COLOURS.onNavy : COLOURS.navyA(0.25) }} />
                    ))}
                  </View>
                  <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: SIZES.bodySmall, color: active ? COLOURS.onNavy : COLOURS.textMuted }}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginTop: 10 }}>
            System follows your device's light or dark setting. A colour scheme changes the base colour and the page; practice stays burgundy, lessons amber and pieces gold.
          </Text>
        </View>
      </GlassCard>
    </>
  );
}
