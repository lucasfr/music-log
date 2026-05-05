import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, STATUS_COLOURS } from '../theme';

// Glass card — the core building block
export function GlassCard({ children, style, intensity = 40 }) {
  return (
    <BlurView
      intensity={intensity}
      tint="light"
      style={[{
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLOURS.glassBorder,
        overflow: 'hidden',
        marginBottom: 12,
        shadowColor: COLOURS.glassShadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 16,
        elevation: 4,
      }, style]}
    >
      <View style={{ backgroundColor: COLOURS.glass, padding: 16 }}>
        {children}
      </View>
    </BlurView>
  );
}

// Card alias for non-blurred surfaces (e.g. modals where blur nests badly)
export function Card({ children, style }) {
  return (
    <View style={[{
      backgroundColor: COLOURS.entryBg,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: COLOURS.glassBorder,
      padding: 16,
      marginBottom: 12,
      shadowColor: COLOURS.glassShadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 12,
      elevation: 3,
    }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children, style }) {
  return (
    <Text style={[{
      fontFamily: 'LibreBaskerville-Italic',
      fontSize: 19,
      color: COLOURS.text,
      marginBottom: 14,
      letterSpacing: -0.3,
    }, style]}>
      {children}
    </Text>
  );
}

export function Label({ children, style }) {
  return (
    <Text style={[{
      fontFamily: 'SourceSans3-Bold',
      fontSize: 11,
      color: COLOURS.textDim,
      marginBottom: 5,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    }, style]}>
      {children}
    </Text>
  );
}

export function Btn({ onPress, label, variant = 'default', style, disabled }) {
  const isPrimary = variant === 'primary';
  const isDanger  = variant === 'danger';
  const isGhost   = variant === 'ghost';

  if (isPrimary) {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8}
        style={[{
          backgroundColor: 'rgba(255,255,255,0.55)',
          borderRadius: RADIUS.sm,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.80)',
          paddingVertical: 12,
          paddingHorizontal: 20,
          alignItems: 'center',
          shadowColor: 'rgba(44,100,160,0.15)',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 1,
          shadowRadius: 12,
          elevation: 4,
          opacity: disabled ? 0.4 : 1,
        }, style]}>
        <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 14, color: COLOURS.text }}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.75}
      style={[{
        backgroundColor: isGhost ? 'transparent' : COLOURS.glass,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: isDanger ? COLOURS.danger : isGhost ? 'transparent' : COLOURS.glassBorder,
        paddingVertical: 9,
        paddingHorizontal: 14,
        alignItems: 'center',
        opacity: disabled ? 0.4 : 1,
      }, style]}>
      <Text style={{ fontFamily: 'SourceSans3', fontSize: 13, color: isDanger ? COLOURS.danger : COLOURS.textMuted }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function BtnRow({ children, style }) {
  return (
    <View style={[{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4, flexWrap: 'wrap' }, style]}>
      {children}
    </View>
  );
}

export function StatusPill({ status }) {
  const c = STATUS_COLOURS[status] || STATUS_COLOURS.learning;
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, borderWidth: 1, backgroundColor: c.bg, borderColor: c.border }}>
      <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 11, color: c.text }}>{status}</Text>
    </View>
  );
}

export function MetaChip({ label }) {
  if (!label) return null;
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLOURS.glassBorder, backgroundColor: COLOURS.glass }}>
      <Text style={{ fontFamily: 'SourceSans3', fontSize: 12, color: COLOURS.textMuted }}>{label}</Text>
    </View>
  );
}

export function TagCloud({ tags, selected, onToggle }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
      {tags.map(t => {
        const active = selected.includes(t);
        return (
          <TouchableOpacity
            key={t}
            onPress={() => onToggle(t)}
            activeOpacity={0.75}
            style={{
              paddingHorizontal: 11,
              paddingVertical: 5,
              borderRadius: RADIUS.pill,
              borderWidth: 1,
              borderColor: active ? COLOURS.steel : COLOURS.glassBorder,
              backgroundColor: active ? COLOURS.accent2Light : 'rgba(255,255,255,0.62)',
            }}
          >
            <Text style={{ fontFamily: active ? 'SourceSans3-Bold' : 'SourceSans3', fontSize: 12, color: active ? COLOURS.navy : COLOURS.textMuted }}>
              {t}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function Divider({ style }) {
  return <View style={[{ height: 1, backgroundColor: COLOURS.glassBorder, marginVertical: 14 }, style]} />;
}

export function EmptyState({ icon, text }) {
  return (
    <View style={{ alignItems: 'center', padding: 48 }}>
      <Text style={{ fontSize: 36, marginBottom: 12 }}>{icon}</Text>
      <Text style={{ fontFamily: 'SourceSans3', fontSize: 15, color: COLOURS.textDim, textAlign: 'center', lineHeight: 22 }}>{text}</Text>
    </View>
  );
}
