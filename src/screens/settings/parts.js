// Shared pieces of the Settings screen: the card, the section header, a row, a text input and the result
// banner. Every section in this folder is built from these. Moved out of SettingsScreen.js unchanged.

import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { Tap as TouchableOpacity } from '../../components/Motion';
import { BlurView } from 'expo-blur';
import { Ionicons } from '../../components/Icon';
import { COLOURS, RADIUS, SIZES, TINT_TEXT } from '../../theme';
import { setLocalPref, todayISO } from '../../utils';

// Remembers that a backup was just taken (Backup shows the date; the nudge on Home reads it).
export const markBackedUp = () => setLocalPref('lastBackup', todayISO());

export function GlassCard({ children, style }) {
  return (
    <BlurView intensity={40} tint={COLOURS.blurTint} style={[{
      borderRadius: RADIUS.md,
      overflow: 'hidden',
      marginBottom: 12,
      shadowColor: COLOURS.navyA(0.10),
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 16,
      elevation: 4,
    }, style]}>
      <View style={{ backgroundColor: COLOURS.w(0.58) }}>
        {children}
      </View>
    </BlurView>
  );
}

export function SectionHeader({ children }) {
  return (
    <Text style={{
      fontFamily: 'Lato-Bold',
      fontSize: SIZES.labelSmall,
      color: COLOURS.textDim,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginTop: 24,
      marginBottom: 8,
      paddingHorizontal: 4,
    }}>
      {children}
    </Text>
  );
}

// A row inside a GlassCard — icon, label, right content
export function Row({ icon, label, sublabel, right, onPress, danger, first, last, noBorder }) {
  const radius = { borderTopLeftRadius: first ? 18 : 0, borderTopRightRadius: first ? 18 : 0, borderBottomLeftRadius: last ? 18 : 0, borderBottomRightRadius: last ? 18 : 0 };
  const inner = (
    <View style={[{
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: noBorder || last ? 0 : 1,
      borderBottomColor: COLOURS.navyA(0.07),
    }, radius]}>
      {icon && (
        <View style={{
          width: 34, height: 34, borderRadius: RADIUS.sm,
          backgroundColor: danger ? COLOURS.dangerLight : COLOURS.navyA(0.10),
          alignItems: 'center', justifyContent: 'center',
          marginRight: 12,
        }}>
          <Ionicons name={icon} size={18} color={danger ? COLOURS.red : COLOURS.navy} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: danger ? COLOURS.red : COLOURS.text }}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginTop: 1 }}>{sublabel}</Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={COLOURS.textDim} /> : null)}
    </View>
  );

  if (!onPress) return inner;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      {inner}
    </TouchableOpacity>
  );
}

export function GlassInput({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLOURS.textDim}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType}
        style={{
          fontFamily: 'Lato',
          fontSize: SIZES.bodySmall,
          color: COLOURS.text,
          backgroundColor: COLOURS.navyA(0.06),
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: RADIUS.sm,
          borderWidth: 1,
          borderColor: COLOURS.navyA(0.10),
        }}
      />
    </View>
  );
}

export function ResultBanner({ result, errorKey = 'errors' }) {
  if (!result) return null;
  const hasErrors = result[errorKey] > 0;
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 14, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm, backgroundColor: hasErrors ? COLOURS.dangerLight : COLOURS.successLight }}>
      <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: hasErrors ? COLOURS.red : TINT_TEXT.success }}>
        {result.message}
      </Text>
    </View>
  );
}
