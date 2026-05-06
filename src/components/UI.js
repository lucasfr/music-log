import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, SIZES, STATUS_COLOURS } from '../theme';

// ─── Glass card ───────────────────────────────────────────────────────────────

export function GlassCard({ children, style, intensity = 50 }) {
  return (
    <BlurView
      intensity={intensity}
      tint="light"
      style={[{
        borderRadius: RADIUS.md,
        overflow: 'hidden',
        marginBottom: 12,
        shadowColor: COLOURS.glassShadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 1,
        shadowRadius: 20,
        elevation: 5,
      }, style]}
    >
      <View style={{ backgroundColor: COLOURS.glass, padding: 16 }}>
        {children}
      </View>
    </BlurView>
  );
}

// ─── Non-blurred card (for use inside modals) ─────────────────────────────────

export function Card({ children, style }) {
  return (
    <View style={[{
      backgroundColor: COLOURS.entryBg,
      borderRadius: RADIUS.md,
      padding: 16,
      marginBottom: 12,
      shadowColor: COLOURS.glassShadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 14,
      elevation: 3,
    }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children, style }) {
  return (
    <Text style={[{
      fontFamily: 'CormorantGaramond',
      fontSize: SIZES.sectionTitle,
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
      fontFamily: 'Lato-Bold',
      fontSize: SIZES.label,
      color: COLOURS.textDim,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    }, style]}>
      {children}
    </Text>
  );
}

// ─── Buttons ──────────────────────────────────────────────────────────────────

export function Btn({ onPress, label, variant = 'default', style, disabled }) {
  const isPrimary = variant === 'primary';
  const isDanger  = variant === 'danger';

  if (isPrimary) {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.85}
        style={[{
          backgroundColor: COLOURS.navy,
          borderRadius: RADIUS.pill,
          paddingVertical: 16,
          paddingHorizontal: 20,
          alignItems: 'center',
          shadowColor: 'rgba(9,99,126,0.35)',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 1,
          shadowRadius: 16,
          elevation: 6,
          opacity: disabled ? 0.4 : 1,
        }, style]}>
        <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.body, color: '#fff', letterSpacing: 0.3 }}>{label}</Text>
      </TouchableOpacity>
    );
  }

  if (isDanger) {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.75}
        style={[{
          backgroundColor: COLOURS.dangerLight,
          borderRadius: RADIUS.sm,
          paddingVertical: 9,
          paddingHorizontal: 14,
          alignItems: 'center',
          shadowColor: 'rgba(214,40,40,0.15)',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 1,
          shadowRadius: 10,
          elevation: 3,
          opacity: disabled ? 0.4 : 1,
        }, style]}>
        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.danger }}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.75}
      style={[{
        backgroundColor: 'rgba(255,255,255,0.50)',
        borderRadius: RADIUS.sm,
        paddingVertical: 9,
        paddingHorizontal: 14,
        alignItems: 'center',
        shadowColor: COLOURS.glassShadow,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 3,
        opacity: disabled ? 0.4 : 1,
      }, style]}>
      <Text style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.textMuted }}>{label}</Text>
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

// ─── Status pill ──────────────────────────────────────────────────────────────

export function StatusPill({ status }) {
  const c = STATUS_COLOURS[status] || STATUS_COLOURS.learning;
  return (
    <View style={{
      paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: RADIUS.pill,
      backgroundColor: c.bg,
      shadowColor: c.border,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 6,
      elevation: 2,
    }}>
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: c.text }}>{status}</Text>
    </View>
  );
}

// ─── Meta chip ────────────────────────────────────────────────────────────────

export function MetaChip({ label }) {
  if (!label) return null;
  return (
    <View style={{
      paddingHorizontal: 9, paddingVertical: 3,
      borderRadius: RADIUS.sm,
      backgroundColor: 'rgba(255,255,255,0.55)',
      shadowColor: COLOURS.glassShadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: 1,
    }}>
      <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textMuted }}>{label}</Text>
    </View>
  );
}

// ─── Tag cloud ────────────────────────────────────────────────────────────────

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
              backgroundColor: active ? 'rgba(247,127,0,0.14)' : 'rgba(255,255,255,0.55)',
              shadowColor: active ? COLOURS.accent2Mid : COLOURS.glassShadow,
              shadowOffset: { width: 0, height: active ? 3 : 1 },
              shadowOpacity: 1,
              shadowRadius: active ? 8 : 4,
              elevation: active ? 3 : 1,
            }}
          >
            <Text style={{
              fontFamily: active ? 'Lato-Bold' : 'Lato',
              fontSize: SIZES.label,
              color: active ? '#7A3A00' : COLOURS.textMuted,
            }}>
              {t}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function Divider({ style }) {
  return <View style={[{ height: 1, backgroundColor: COLOURS.glassBorderSubtle, marginVertical: 14 }, style]} />;
}

export function EmptyState({ icon, text }) {
  return (
    <View style={{ alignItems: 'center', padding: 48 }}>
      <Text style={{ fontSize: 36, marginBottom: 12 }}>{icon}</Text>
      <Text style={{ fontFamily: 'Lato', fontSize: 15, color: COLOURS.textDim, textAlign: 'center', lineHeight: 22 }}>{text}</Text>
    </View>
  );
}
