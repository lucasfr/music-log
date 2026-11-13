// Settings > Sync: the Supabase connection (credentials and sign-in), edits replaced by sync, and, once
// signed in, Push all, Check sync and the account. Moved out of SettingsScreen.js unchanged, apart from
// telling the screen whether anyone is signed in (onSignedInChange), which the Danger zone's wording needs.

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Platform, ActivityIndicator } from 'react-native';
import { Tap as TouchableOpacity } from '../../components/Motion';
import { COLOURS, RADIUS, SIZES, HIT_TEXT, TOUCH_PILL, HIT_PILL, TINT_TEXT } from '../../theme';
import { notify } from '../../utils/notify';
import { usePref } from '../../utils/usePref';
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  clearSupabaseCredentials,
  getClient,
  getSession,
  signInWithMagicLink,
  signInWithGitHub,
  signOut,
} from '../../lib/supabase';
import { pushRecord, pullTable, checkSync } from '../../db/sync';
import { summariseSelfTest } from '../../db/selfTest';
import { getSyncStatus, subscribeSyncStatus } from '../../db/syncStatus';
import { parseConflicts, parseOutbox, dirtyCount, tombstoneIndex, blockedByDeletion } from '../../utils/syncQueue';
import { outbox } from '../../db/outbox';
import { describeConflictChanges } from '../../utils/conflictDiff';
import { GlassCard, SectionHeader, Row, GlassInput, ResultBanner } from './parts';

// GitHub's own button colours. They belong to GitHub's brand, not to the app palette.
const GITHUB = { bg: '#24292e', fg: '#ffffff' }; // design: ok brand colours

function timeAgo(iso) {
  if (!iso) return null;
  const diffSec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

function StatusDot({ connected }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: connected ? COLOURS.success : COLOURS.textDim }} />
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: connected ? TINT_TEXT.success : COLOURS.textDim }}>
        {connected ? 'Connected' : 'Not connected'}
      </Text>
    </View>
  );
}

// The results of "Check sync": a verdict line, then one line per check with a coloured dot.
function CheckList({ checks }) {
  if (!checks) return null;
  const verdict = summariseSelfTest(checks);
  const colour = s => (s === 'ok' ? COLOURS.success : s === 'warn' ? COLOURS.amber : COLOURS.red);
  const tint = s => (s === 'ok' ? COLOURS.successLight : s === 'warn' ? COLOURS.amberLight || COLOURS.navyA(0.08) : COLOURS.dangerLight);
  return (
    <View accessibilityLiveRegion="polite" style={{ marginHorizontal: 16, marginBottom: 14 }}>
      <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm, backgroundColor: tint(verdict.status), marginBottom: 8 }}>
        <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: verdict.status === 'ok' ? TINT_TEXT.success : verdict.status === 'warn' ? COLOURS.text : COLOURS.red }}>
          {verdict.text}
        </Text>
      </View>
      {checks.map((c, i) => (
        <View key={`${c.label}-${i}`} accessible accessibilityLabel={`${c.label}: ${c.status === 'ok' ? 'fine' : c.status === 'warn' ? 'look at this' : 'problem'}. ${c.detail}`}
          style={{ flexDirection: 'row', gap: 10, paddingVertical: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: colour(c.status) }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.text }}>{c.label}</Text>
            <Text selectable style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, lineHeight: 19 }}>{c.detail}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function SyncSection({ sessions, lessons, compositions, onSaveSession, onSaveLesson, onSaveComposition, onSignedInChange }) {
  const [url,        setUrl]        = useState('');
  const [anonKey,    setAnonKey]    = useState('');
  const [email,      setEmail]      = useState('');
  const [session,    setSession]    = useState(null);
  const [credsSaved, setCredsSaved] = useState(false);
  const [phase,      setPhase]      = useState('idle');
  const [savedBanner, setSavedBanner] = useState(false);
  const [syncResult,  setSyncResult]  = useState(null);
  const [checks,      setChecks]      = useState(null);
  const [checking,    setChecking]    = useState(false);
  const [error,        setError]        = useState(null);
  const [syncStatus,   setSyncStatus]   = useState(getSyncStatus());

  // Sync is fire-and-forget by design (push/pull shouldn't block whatever
  // UI triggered them), which previously meant a failure was only ever a
  // silent console.warn — no signal anywhere that a session never actually
  // reached Supabase short of noticing it missing on another device later.
  useEffect(() => subscribeSyncStatus(setSyncStatus), []);

  const loadState = useCallback(async () => {
    const { url: savedUrl, anonKey: savedKey } = await getSupabaseCredentials();
    if (savedUrl) setUrl(savedUrl);
    if (savedKey) setAnonKey(savedKey);
    setCredsSaved(!!(savedUrl && savedKey));
    const s = await getSession();
    setSession(s);
    if (s?.user?.email) setEmail(s.user.email);
  }, []);

  useEffect(() => { loadState(); }, [loadState]);

  // The screen's Danger zone words its warning differently when other devices are involved.
  useEffect(() => { if (onSignedInChange) onSignedInChange(!!session); }, [session, onSignedInChange]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = async () => {
      const client = await getClient();
      if (!client) return;
      const s = await getSession();
      if (s) { setSession(s); setPhase('idle'); }
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  async function handleSaveCredentials() {
    setError(null);
    if (!url.trim() || !anonKey.trim()) { setError('Both fields are required.'); return; }
    await saveSupabaseCredentials(url, anonKey);
    setCredsSaved(true);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
    const s = await getSession();
    setSession(s);
    if (s?.user?.email) setEmail(s.user.email);
  }

  async function handleGitHub() {
    setError(null);
    try { await signInWithGitHub(); } catch (e) { setError(e.message || 'GitHub sign-in failed.'); }
  }

  async function handleSendMagicLink() {
    setError(null);
    setPhase('sending');
    try { await signInWithMagicLink(email); setPhase('sent'); }
    catch (e) { setError(e.message || 'Failed to send magic link.'); setPhase('idle'); }
  }

  async function handleSignOut() {
    setPhase('signing-out');
    await signOut();
    setSession(null);
    setPhase('idle');
  }

  async function handleSyncAll() {
    setPhase('syncing'); setSyncResult(null);
    let pushed = 0, errors = 0;
    const all = [
      ...sessions.map(r     => ({ table: 'sessions',     record: r })),
      ...lessons.map(r      => ({ table: 'lessons',      record: r })),
      ...compositions.map(r => ({ table: 'compositions', record: r })),
    ];
    // Pieces are stamped as just edited, so another device takes this copy even when its own
    // has the same timestamp (it had the piece before the tempo could be synced).
    const stamp = new Date().toISOString();
    // Look at what the server has first, so a record another device has deleted is not pushed back over
    // its deletion. A table the server can't be read for is not pushed blind.
    const deletions = {};
    for (const table of ['sessions', 'lessons', 'compositions']) {
      const rows = await pullTable(table);
      deletions[table] = rows ? tombstoneIndex(rows) : null;
    }
    let skipped = 0;
    for (const { table, record } of all) {
      try {
        if (!deletions[table]) { errors++; continue; }
        if (blockedByDeletion(record, deletions[table])) { skipped++; continue; }
        const ok = await pushRecord(table, table === 'compositions' ? { ...record, updated_at: stamp } : record);
        if (ok) pushed++; else errors++;
      } catch { errors++; }
    }
    const left = skipped ? ` · ${skipped} deleted elsewhere, left alone` : '';
    setSyncResult({ pushed, errors, message: errors > 0 ? `${pushed} pushed · ${errors} failed${left}` : `${pushed} records synced${left}` });
    setPhase('idle');
  }

  async function handleClearCredentials() {
    await clearSupabaseCredentials();
    setUrl(''); setAnonKey(''); setCredsSaved(false); setSession(null);
  }

  // Edits still waiting to reach Supabase, and versions that sync replaced because two devices
  // edited the same entry (kept so they can be restored). Both live in preferences, so these
  // update by themselves when the sync logic changes them.
  const [outboxRaw] = usePref('syncOutbox', '');
  const [conflictsRaw] = usePref('syncConflicts', '[]');
  const waiting = dirtyCount(parseOutbox(outboxRaw));
  const conflicts = parseConflicts(conflictsRaw);
  const savers = { sessions: onSaveSession, lessons: onSaveLesson, compositions: onSaveComposition };
  async function restoreConflict(c) {
    try {
      await savers[c.table](c.record);
      outbox.resolveConflict(c.table, c.id, c.record.updated_at);
    } catch {
      notify("Couldn't restore", 'It could not be saved on this device. Try again.');
    }
  }
  const dismissConflict = c => outbox.resolveConflict(c.table, c.id, c.record.updated_at);

  // "Check sync": the schema, a write/read/remove round trip, record counts here and on the server,
  // and what is still waiting (see db/selfTest.js). Run it on each device to compare them.
  async function handleCheckSync() {
    setChecking(true); setChecks(null);
    try {
      setChecks(await checkSync(
        { sessions: sessions.length, lessons: lessons.length, compositions: compositions.length },
        { edits: waiting, deletes: outbox.pendingDeleteCount(), conflicts: conflicts.length },
      ));
    } catch (e) {
      setChecks([{ label: 'Check sync', status: 'fail', detail: `Couldn't run the check: ${e.message}` }]);
    }
    setChecking(false);
  }

  const isSignedIn = !!session;
  const totalRecords = sessions.length + lessons.length + compositions.length;
  const syncSublabel = !isSignedIn
    ? 'Device sync'
    : syncStatus.lastError
      ? `Sync error: ${syncStatus.lastError}`
      : syncStatus.pending > 0
        ? 'Syncing…'
        : syncStatus.lastSuccessAt
          ? `Last synced ${timeAgo(syncStatus.lastSuccessAt)}`
          : 'Device sync';

  return (
    <>
      {/* ── Sync section ─────────────────────────────────────────── */}
      <SectionHeader>Sync</SectionHeader>

      <GlassCard>
        <Row
          icon="cloud-outline"
          label="Supabase"
          sublabel={isSignedIn && waiting > 0 ? `${syncSublabel} · ${waiting} edit${waiting === 1 ? '' : 's'} waiting to sync` : syncSublabel}
          right={<StatusDot connected={isSignedIn} />}
          first last noBorder
        />
      </GlassCard>

      {conflicts.length > 0 && (
        <>
          <SectionHeader>Edits replaced by sync</SectionHeader>
          <GlassCard>
            <View style={{ padding: 16 }}>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, lineHeight: 19 }}>
                Two devices changed the same entry. The newer version was kept, and the other one is saved here so nothing is lost. Using a saved version makes it the current one on all your devices.
              </Text>
            </View>
            {conflicts.map(c => (
              <View
                key={`${c.table}:${c.id}:${c.record.updated_at}`}
                style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLOURS.navyA(0.07) }}
              >
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.text }}>{c.label}</Text>
                <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, marginTop: 2 }}>
                  {c.side === 'this device' ? 'Your edit on this device' : 'The edit from your other device'} · replaced {timeAgo(c.at)}
                </Text>
                {describeConflictChanges(({ sessions, lessons, compositions }[c.table] || []).find(r => r.id === c.id), c.record).map((line, i) => (
                  <Text key={`${i}-${line}`} style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.text, marginTop: 4 }}>{line}</Text>
                ))}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TouchableOpacity
                    onPress={() => restoreConflict(c)} activeOpacity={0.75} hitSlop={HIT_PILL}
                    accessibilityRole="button" accessibilityLabel={`Use this saved version of ${c.label} instead of the one that was kept`}
                    style={{ ...TOUCH_PILL, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navy }}
                  >
                    <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.onNavy }}>Use this version instead</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => dismissConflict(c)} activeOpacity={0.75} hitSlop={HIT_PILL}
                    accessibilityRole="button" accessibilityLabel={`Dismiss ${c.label}`}
                    style={{ ...TOUCH_PILL, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navyA(0.10) }}
                  >
                    <Text style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.textMuted }}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </GlassCard>
        </>
      )}

      {/* Credentials */}
      <GlassCard>
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
          <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.cardTitle, color: COLOURS.navy, marginBottom: 12 }}>Credentials</Text>
        </View>
        <GlassInput label="Project URL" value={url} onChangeText={setUrl} placeholder="https://xxxx.supabase.co" keyboardType="url" />
        <GlassInput label="Anon key" value={anonKey} onChangeText={setAnonKey} placeholder="eyJhbGci…" secureTextEntry />
        {error && (
          <View style={{ marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm, backgroundColor: COLOURS.dangerLight }}>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.red }}>{error}</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 14 }}>
          <TouchableOpacity onPress={handleSaveCredentials} activeOpacity={0.8}
            style={{ flex: 1, paddingVertical: 12, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navy, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.onNavy }}>Save</Text>
          </TouchableOpacity>
          {credsSaved && (
            <TouchableOpacity onPress={handleClearCredentials} activeOpacity={0.8}
              style={{ paddingHorizontal: 18, paddingVertical: 12, borderRadius: RADIUS.pill, backgroundColor: COLOURS.dangerLight }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.red }}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
        {savedBanner && (
          <View style={{ marginHorizontal: 16, marginBottom: 14, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm, backgroundColor: COLOURS.successLight }}>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.success }}>✓ Credentials saved</Text>
          </View>
        )}
      </GlassCard>

      {/* Sign in */}
      {credsSaved && !isSignedIn && (
        <GlassCard>
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
            <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.cardTitle, color: COLOURS.navy, marginBottom: 14 }}>Sign in</Text>
            {phase !== 'sent' ? (
              <>
                <TouchableOpacity onPress={handleGitHub} activeOpacity={0.8}
                  style={{ paddingVertical: 12, borderRadius: RADIUS.pill, backgroundColor: GITHUB.bg, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                  <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: GITHUB.fg }}>🐙  Continue with GitHub</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: COLOURS.navyA(0.10) }} />
                  <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>or</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: COLOURS.navyA(0.10) }} />
                </View>
                <View style={{ marginBottom: 8 }}>
                  <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>Email</Text>
                  <TextInput
                    value={email} onChangeText={setEmail}
                    placeholder="you@example.com" placeholderTextColor={COLOURS.textDim}
                    autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
                    style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.text, backgroundColor: COLOURS.navyA(0.06), paddingHorizontal: 14, paddingVertical: 12, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLOURS.navyA(0.10), marginBottom: 10 }}
                  />
                  <TouchableOpacity onPress={handleSendMagicLink} activeOpacity={0.8} disabled={phase === 'sending'}
                    style={{ paddingVertical: 12, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navyA(0.10), alignItems: 'center' }}>
                    {phase === 'sending'
                      ? <ActivityIndicator color={COLOURS.navy} size="small" />
                      : <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.navy }}>Send magic link</Text>
                    }
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 8, gap: 8 }}>
                {/* design: ok emoji */}
                <Text style={{ fontSize: 32 }}>📬</Text>
                <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.sectionTitle, color: COLOURS.navy }}>Check your email</Text>
                <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, textAlign: 'center', lineHeight: 20 }}>
                  Click the link from Supabase, then come back here.
                </Text>
                <TouchableOpacity onPress={() => { setPhase('idle'); loadState(); }} hitSlop={HIT_TEXT} style={{ marginTop: 4 }}>
                  <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.navy }}>I've clicked the link ↗</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </GlassCard>
      )}

      {/* Signed in — data + account */}
      {isSignedIn && (
        <>
          <SectionHeader>Data</SectionHeader>
          <GlassCard>
            <Row icon="cloud-upload-outline" label="Push all to Supabase"
              sublabel={`${totalRecords} records`}
              onPress={phase === 'syncing' ? null : handleSyncAll}
              right={phase === 'syncing' ? <ActivityIndicator color={COLOURS.navy} size="small" /> : undefined}
              first
            />
            <ResultBanner result={syncResult} />
            <Row icon="checkmark-circle-outline" label="Check sync"
              sublabel="Tables, a test write, and record counts"
              onPress={checking ? null : handleCheckSync}
              right={checking ? <ActivityIndicator color={COLOURS.navy} size="small" /> : undefined}
              last={!checks}
              noBorder={!!checks}
            />
            <CheckList checks={checks} />
          </GlassCard>

          <SectionHeader>Account</SectionHeader>
          <GlassCard>
            <Row icon="person-outline" label={session.user.email}
              sublabel="Signed in via GitHub / magic link"
              first noBorder
            />
            <Row icon="log-out-outline" label="Sign out"
              onPress={phase === 'signing-out' ? null : handleSignOut}
              right={phase === 'signing-out' ? <ActivityIndicator color={COLOURS.red} size="small" /> : undefined}
              danger last
            />
          </GlassCard>
        </>
      )}
    </>
  );
}
