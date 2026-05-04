import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, RADIUS } from '../theme';

export function Card({ children, style }) {
  const C = useTheme();
  return (
    <View style={[{ backgroundColor: C.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 12 }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children, style }) {
  const C = useTheme();
  return (
    <Text style={[{ fontFamily: 'serif', fontSize: 17, color: C.ink, marginBottom: 14, letterSpacing: -0.2 }, style]}>
      {children}
    </Text>
  );
}

export function Label({ children }) {
  const C = useTheme();
  return (
    <Text style={{ fontSize: 11, fontWeight: '600', color: C.ink3, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {children}
    </Text>
  );
}

export function Btn({ onPress, label, variant = 'default', style, disabled }) {
  const C = useTheme();
  const isPrimary = variant === 'primary';
  const isDanger  = variant === 'danger';
  const isGhost   = variant === 'ghost';

  const bg = isPrimary ? C.accent : isGhost ? 'transparent' : C.card;
  const borderColor = isPrimary ? C.accent : isDanger ? C.danger : isGhost ? 'transparent' : C.border2;
  const textColor = isPrimary ? '#fff' : isDanger ? C.danger : C.ink;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 9, paddingHorizontal: 16,
        borderRadius: RADIUS.sm, borderWidth: 1,
        backgroundColor: bg, borderColor,
        opacity: disabled ? 0.4 : 1,
      }, style]}
    >
      <Text style={{ fontSize: 13, fontWeight: isPrimary ? '500' : '400', color: textColor }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function BtnRow({ children }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
      {children}
    </View>
  );
}

export function StatusPill({ status }) {
  const colors = {
    learning:            { bg: '#FFF7ED', text: '#92400E', border: '#FED7AA' },
    consolidating:       { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
    'performance-ready': { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
  };
  const c = colors[status] || colors.learning;
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, borderWidth: 1, backgroundColor: c.bg, borderColor: c.border }}>
      <Text style={{ fontSize: 11, fontWeight: '500', color: c.text }}>{status}</Text>
    </View>
  );
}

export function MetaChip({ label }) {
  const C = useTheme();
  if (!label) return null;
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface }}>
      <Text style={{ fontSize: 12, color: C.ink3 }}>{label}</Text>
    </View>
  );
}

export function TagCloud({ tags, selected, onToggle }) {
  const C = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {tags.map(t => {
        const active = selected.includes(t);
        return (
          <TouchableOpacity
            key={t}
            onPress={() => onToggle(t)}
            activeOpacity={0.7}
            style={{
              paddingHorizontal: 10, paddingVertical: 4,
              borderRadius: 20, borderWidth: 1,
              borderColor: active ? C.accent : C.border2,
              backgroundColor: active ? C.accentLight : C.surface,
            }}
          >
            <Text style={{ fontSize: 12, color: active ? C.accent : C.ink2, fontWeight: active ? '500' : '400' }}>
              {t}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function Divider({ style }) {
  const C = useTheme();
  return <View style={[{ height: 1, backgroundColor: C.border, marginVertical: 14 }, style]} />;
}

export function EmptyState({ icon, text }) {
  const C = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: 40 }}>
      <Text style={{ fontSize: 32, marginBottom: 10 }}>{icon}</Text>
      <Text style={{ fontSize: 14, color: C.ink3, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}
