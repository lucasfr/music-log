// Settings > Danger zone: delete every session, lesson and piece (here, and on Supabase and other devices
// when signed in). Needs the word typed, because there is no undo. Moved out of SettingsScreen.js unchanged.

import React, { useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Tap as TouchableOpacity } from '../../components/Motion';
import { COLOURS, RADIUS, SIZES, TOUCH_PILL, HIT_PILL } from '../../theme';
import { exportAllJSON } from '../../utils/export';
import { describeClear } from '../../utils/clearData';
import { GlassCard, SectionHeader, Row, GlassInput, ResultBanner, markBackedUp } from './parts';

export function DangerSection({ sessions, lessons, compositions, onClearAll, isSignedIn }) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearText,    setClearText]    = useState('');
  const [clearing,     setClearing]     = useState(false);
  const [clearResult,  setClearResult]  = useState(null);
  const totalRecords = sessions.length + lessons.length + compositions.length;

  const clearReady = clearText.trim().toLowerCase() === 'delete' && !clearing;
  async function handleClearAll() {
    if (!clearReady || !onClearAll) return;
    setClearing(true); setClearResult(null);
    try {
      const r = await onClearAll();
      setClearResult({ errors: 0, message: describeClear(r) });
      setConfirmClear(false); setClearText('');
    } catch (e) {
      setClearResult({ errors: 1, message: e.message || 'Clearing failed. Nothing more was deleted.' });
    } finally {
      setClearing(false);
    }
  }

  return (
    <>
      {/* Danger zone: always available, like Backup. Deleting is behind a typed confirmation. */}
      <SectionHeader>Danger zone</SectionHeader>
      <GlassCard>
        <Row icon="trash-outline" label="Clear all data"
          sublabel={`Delete all ${totalRecords} sessions, lessons and pieces`}
          onPress={() => { setConfirmClear(c => !c); setClearText(''); setClearResult(null); }}
          danger first last={!confirmClear} noBorder={!confirmClear}
        />
        {confirmClear && (
          <View>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, lineHeight: 19, paddingHorizontal: 16, paddingBottom: 12 }}>
              This permanently deletes {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}, {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'} and {compositions.length} {compositions.length === 1 ? 'piece' : 'pieces'} on this device{isSignedIn ? ', in Supabase and on your other devices' : ''}. It can't be undone from the app, so export a backup first.
            </Text>
            <View style={{ paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row' }}>
              <TouchableOpacity
                onPress={() => exportAllJSON(sessions, lessons, compositions).then(markBackedUp).catch(() => {})}
                activeOpacity={0.75} hitSlop={HIT_PILL}
                accessibilityRole="button" accessibilityLabel="Export a backup before clearing"
                style={{ ...TOUCH_PILL, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navyA(0.10) }}
              >
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.navy }}>Export a backup first</Text>
              </TouchableOpacity>
            </View>
            <GlassInput label={'Type "delete" to confirm'} value={clearText} onChangeText={setClearText} placeholder="delete" />
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 16 }}>
              <TouchableOpacity
                onPress={() => { setConfirmClear(false); setClearText(''); }}
                activeOpacity={0.75} hitSlop={HIT_PILL} disabled={clearing}
                accessibilityRole="button" accessibilityLabel="Cancel clearing all data"
                style={{ ...TOUCH_PILL, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navyA(0.10) }}
              >
                <Text style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.textMuted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleClearAll}
                activeOpacity={0.75} hitSlop={HIT_PILL} disabled={!clearReady}
                accessibilityRole="button" accessibilityLabel="Delete all data" accessibilityState={{ disabled: !clearReady }}
                style={{ ...TOUCH_PILL, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: COLOURS.dangerLight, opacity: clearReady ? 1 : 0.4 }}
              >
                {clearing
                  ? <ActivityIndicator color={COLOURS.red} size="small" />
                  : <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.red }}>Delete everything</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
        <ResultBanner result={clearResult} />
      </GlassCard>
    </>
  );
}
