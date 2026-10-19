import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from './Icon';
import { COLOURS, RADIUS } from '../theme';
import { useSyncIssue } from '../db/useSyncIssue';

// A banner for a sync problem that needs attention (not for being offline, see db/syncIssue.js).
// Shown at the top of Home; tapping it opens Settings, where the full message and the fix are.
export function SyncIssueBanner({ onPress }) {
  const issue = useSyncIssue();
  if (!issue) return null;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${issue.title}. ${onPress ? 'Open Settings for details.' : ''}`}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44,
        marginBottom: 16, padding: 12, borderRadius: RADIUS.md,
        backgroundColor: 'rgba(214,40,40,0.10)', borderWidth: 1, borderColor: 'rgba(214,40,40,0.30)',
      }}
    >
      <Ionicons name="alert-circle-outline" size={22} color={COLOURS.red} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.text }}>{issue.title}</Text>
        <Text numberOfLines={3} style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textMuted, marginTop: 2, lineHeight: 17 }}>{issue.message}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={COLOURS.textDim} /> : null}
    </TouchableOpacity>
  );
}
