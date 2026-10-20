import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Platform, ActivityIndicator, Alert } from 'react-native';
import { Tap as TouchableOpacity } from '../components/Motion';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '../components/Icon';
import { COLOURS, RADIUS, HIT_TEXT, TOUCH_PILL, HIT_PILL, TINT_TEXT } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { notify } from '../utils/notify';
import { usePref } from '../utils/usePref';
import { setLocalPref, todayISO, fmtDate } from '../utils';
import { GOAL_OPTIONS, REMINDER_TIMES } from '../utils/planning';
import { setDailyReminder } from '../utils/reminders';
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  clearSupabaseCredentials,
  getClient,
  getSession,
  signInWithMagicLink,
  signInWithGitHub,
  signOut,
} from '../lib/supabase';
import { pushRecord, pullTable } from '../db/sync';
import { getSyncStatus, subscribeSyncStatus } from '../db/syncStatus';
import { exportAllJSON, copyAllJSON, parseImportJSON, planImport, describeImport, pickJSONFile } from '../utils/export';
import { parseConflicts, parseOutbox, dirtyCount, tombstoneIndex, blockedByDeletion } from '../utils/syncQueue';
import { outbox } from '../db/outbox';

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

// ─── Design primitives ────────────────────────────────────────────────────────

function GlassCard({ children, style }) {
  return (
    <BlurView intensity={40} tint={COLOURS.blurTint} style={[{
      borderRadius: 18,
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

function SectionHeader({ children }) {
  return (
    <Text style={{
      fontFamily: 'Lato-Bold',
      fontSize: 12,
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
function Row({ icon, label, sublabel, right, onPress, danger, first, last, noBorder }) {
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
          width: 34, height: 34, borderRadius: 10,
          backgroundColor: danger ? 'rgba(214,40,40,0.10)' : COLOURS.navyA(0.10),
          alignItems: 'center', justifyContent: 'center',
          marginRight: 12,
        }}>
          <Ionicons name={icon} size={18} color={danger ? COLOURS.red : COLOURS.navy} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: danger ? COLOURS.red : COLOURS.text }}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginTop: 1 }}>{sublabel}</Text>
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

function GlassInput({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.textDim, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
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
          fontSize: 14,
          color: COLOURS.text,
          backgroundColor: COLOURS.navyA(0.06),
          paddingHorizontal: 14,
          paddingVertical: 11,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: COLOURS.navyA(0.10),
        }}
      />
    </View>
  );
}

function StatusDot({ connected }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: connected ? '#00B478' : COLOURS.textDim }} />
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: connected ? TINT_TEXT.success : COLOURS.textDim }}>
        {connected ? 'Connected' : 'Not connected'}
      </Text>
    </View>
  );
}

function ResultBanner({ result, errorKey = 'errors' }) {
  if (!result) return null;
  const hasErrors = result[errorKey] > 0;
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 14, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: hasErrors ? 'rgba(214,40,40,0.07)' : 'rgba(0,180,120,0.08)' }}>
      <Text style={{ fontFamily: 'Lato', fontSize: 13, color: hasErrors ? COLOURS.red : TINT_TEXT.success }}>
        {result.message}
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen({ isDesktop, sessions = [], lessons = [], compositions = [], onSaveSession, onSaveLesson, onSaveComposition }) {
  const [url,        setUrl]        = useState('');
  const [anonKey,    setAnonKey]    = useState('');
  const [email,      setEmail]      = useState('');
  const [session,    setSession]    = useState(null);
  const [credsSaved, setCredsSaved] = useState(false);
  const [phase,      setPhase]      = useState('idle');
  const [savedBanner, setSavedBanner] = useState(false);
  const [syncResult,  setSyncResult]  = useState(null);
  const [importResult, setImportResult] = useState(null);
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

  async function handleImport() {
    setError(null); setImportResult(null);
    try {
      const json = await pickJSONFile();
      // Only what isn't already on this device is saved: a record with an id that is here is
      // skipped (unless the file's copy is newer), so importing a backup twice adds nothing.
      const plan = planImport(parseImportJSON(json), { sessions, lessons, compositions });
      let errors = 0;
      // Pieces go first, so the segments that point at them are saved after them.
      for (const r of plan.compositions) { try { await onSaveComposition(r); } catch { errors++; } }
      for (const r of plan.sessions)     { try { await onSaveSession(r);     } catch { errors++; } }
      for (const r of plan.lessons)      { try { await onSaveLesson(r);      } catch { errors++; } }
      const summary = describeImport(plan.stats);
      setImportResult({ errors, message: errors > 0 ? `${summary} · ${errors} failed to save` : summary });
    } catch (e) { setError(e.message || 'Import failed.'); }
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

  const { pref: themePref, setTheme, options: themeOptions } = useTheme();
  const THEME_ICONS = { system: 'phone-portrait-outline', light: 'sunny-outline', dark: 'moon-outline' };
  const [goalRaw, setGoalRaw] = usePref('weeklyGoalMin', '0');
  const [reminderTime, setReminderTime] = usePref('reminderTime', '');
  const [lastBackup] = usePref('lastBackup', '');
  const markBackedUp = () => setLocalPref('lastBackup', todayISO());
  const chooseReminder = async t => {
    const r = await setDailyReminder(t);
    if (r.ok) setReminderTime(t);
    else notify('Reminder not set', r.reason);
  };
  const chip = (key, label, active, onPress, a11y) => (
    <TouchableOpacity
      key={key} onPress={onPress} activeOpacity={0.75} hitSlop={HIT_PILL}
      accessibilityRole="radio" accessibilityLabel={a11y} accessibilityState={{ selected: active }}
      style={{ ...TOUCH_PILL, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: active ? COLOURS.navy : COLOURS.navyA(0.10) }}
    >
      <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: 14, color: active ? '#fff' : COLOURS.textMuted }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingLeft: isDesktop ? 238 : 16, paddingTop: 8, paddingBottom: 60 }}>

        {/* Page title */}
        <View style={{ marginBottom: 4, marginTop: 4 }}>
          <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 30, color: COLOURS.text, letterSpacing: -0.3 }}>Settings</Text>
        </View>

        {/* Appearance: one chip per registered theme, plus System */}
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
                    <Ionicons name={THEME_ICONS[o.key] || 'color-palette-outline'} size={16} color={active ? '#fff' : COLOURS.textMuted} />
                    <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: 14, color: active ? '#fff' : COLOURS.textMuted }}>{o.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginTop: 10 }}>
              System follows your device's light or dark setting.
            </Text>
          </View>
        </GlassCard>

        {/* Practice: weekly goal (shown on Home) and, in the app, a daily reminder */}
        <SectionHeader>Practice</SectionHeader>
        <GlassCard>
          <View style={{ padding: 14 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.text, marginBottom: 8 }}>Weekly goal</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {GOAL_OPTIONS.map(g => chip(
                `g${g}`, g ? `${g / 60}h` : 'Off', Number(goalRaw) === g,
                () => setGoalRaw(String(g)),
                g ? `${g / 60} hours a week` : 'No weekly goal',
              ))}
            </View>
            <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginTop: 10 }}>
              Shown on Home as progress through your week.
            </Text>
            {Platform.OS !== 'web' && (
              <>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.text, marginTop: 18, marginBottom: 8 }}>Daily reminder</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {['', ...REMINDER_TIMES].map(t => chip(
                    `r${t}`, t || 'Off', reminderTime === t,
                    () => chooseReminder(t),
                    t ? `Remind me at ${t}` : 'No daily reminder',
                  ))}
                </View>
              </>
            )}
          </View>
        </GlassCard>

        {/* Backup: always available (it used to appear only when signed in to sync) */}
        <SectionHeader>Backup</SectionHeader>
        <GlassCard>
          <Row icon="arrow-down-outline" label="Export all as JSON"
            sublabel={lastBackup ? `Last backup ${fmtDate(lastBackup)}` : 'Not backed up yet'}
            onPress={() => exportAllJSON(sessions, lessons, compositions).then(markBackedUp).catch(() => {})}
            first
          />
          <Row icon="copy-outline" label="Copy all as JSON"
            onPress={() =>
              copyAllJSON(sessions, lessons, compositions)
                .then(() => { markBackedUp(); notify('Copied', 'All data copied to clipboard.'); })
                .catch(() => {})
            }
          />
          <Row icon="arrow-up-outline" label="Import from JSON"
            onPress={handleImport}
            last
          />
          <ResultBanner result={importResult} />
        </GlassCard>

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
                <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, lineHeight: 19 }}>
                  Two devices changed the same entry. The newer version was kept, and the other one is saved here so nothing is lost.
                </Text>
              </View>
              {conflicts.map(c => (
                <View
                  key={`${c.table}:${c.id}:${c.record.updated_at}`}
                  style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLOURS.navyA(0.07) }}
                >
                  <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.text }}>{c.label}</Text>
                  <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginTop: 2 }}>
                    {c.side === 'this device' ? 'Your edit on this device' : 'The edit from your other device'} · replaced {timeAgo(c.at)}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity
                      onPress={() => restoreConflict(c)} activeOpacity={0.75} hitSlop={HIT_PILL}
                      accessibilityRole="button" accessibilityLabel={`Restore this version of ${c.label}`}
                      style={{ ...TOUCH_PILL, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navy }}
                    >
                      <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: '#fff' }}>Restore this version</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => dismissConflict(c)} activeOpacity={0.75} hitSlop={HIT_PILL}
                      accessibilityRole="button" accessibilityLabel={`Dismiss ${c.label}`}
                      style={{ ...TOUCH_PILL, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navyA(0.10) }}
                    >
                      <Text style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.textMuted }}>Dismiss</Text>
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
            <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 17, color: COLOURS.navy, marginBottom: 12 }}>Credentials</Text>
          </View>
          <GlassInput label="Project URL" value={url} onChangeText={setUrl} placeholder="https://xxxx.supabase.co" keyboardType="url" />
          <GlassInput label="Anon key" value={anonKey} onChangeText={setAnonKey} placeholder="eyJhbGci…" secureTextEntry />
          {error && (
            <View style={{ marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(214,40,40,0.07)' }}>
              <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.red }}>{error}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 14 }}>
            <TouchableOpacity onPress={handleSaveCredentials} activeOpacity={0.8}
              style={{ flex: 1, paddingVertical: 11, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navy, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: '#fff' }}>Save</Text>
            </TouchableOpacity>
            {credsSaved && (
              <TouchableOpacity onPress={handleClearCredentials} activeOpacity={0.8}
                style={{ paddingHorizontal: 18, paddingVertical: 11, borderRadius: RADIUS.pill, backgroundColor: 'rgba(214,40,40,0.08)' }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.red }}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          {savedBanner && (
            <View style={{ marginHorizontal: 16, marginBottom: 14, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(0,180,120,0.08)' }}>
              <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.success }}>✓ Credentials saved</Text>
            </View>
          )}
        </GlassCard>

        {/* Sign in */}
        {credsSaved && !isSignedIn && (
          <GlassCard>
            <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
              <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 17, color: COLOURS.navy, marginBottom: 14 }}>Sign in</Text>
              {phase !== 'sent' ? (
                <>
                  <TouchableOpacity onPress={handleGitHub} activeOpacity={0.8}
                    style={{ paddingVertical: 11, borderRadius: RADIUS.pill, backgroundColor: '#24292e', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                    <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: '#fff' }}>🐙  Continue with GitHub</Text>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: COLOURS.navyA(0.10) }} />
                    <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim }}>or</Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: COLOURS.navyA(0.10) }} />
                  </View>
                  <View style={{ marginBottom: 8 }}>
                    <Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.textDim, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>Email</Text>
                    <TextInput
                      value={email} onChangeText={setEmail}
                      placeholder="you@example.com" placeholderTextColor={COLOURS.textDim}
                      autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
                      style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.text, backgroundColor: COLOURS.navyA(0.06), paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: COLOURS.navyA(0.10), marginBottom: 10 }}
                    />
                    <TouchableOpacity onPress={handleSendMagicLink} activeOpacity={0.8} disabled={phase === 'sending'}
                      style={{ paddingVertical: 11, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navyA(0.10), alignItems: 'center' }}>
                      {phase === 'sending'
                        ? <ActivityIndicator color={COLOURS.navy} size="small" />
                        : <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.navy }}>Send magic link</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 8, gap: 8 }}>
                  <Text style={{ fontSize: 32 }}>📬</Text>
                  <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 20, color: COLOURS.navy }}>Check your email</Text>
                  <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, textAlign: 'center', lineHeight: 20 }}>
                    Click the link from Supabase, then come back here.
                  </Text>
                  <TouchableOpacity onPress={() => { setPhase('idle'); loadState(); }} hitSlop={HIT_TEXT} style={{ marginTop: 4 }}>
                    <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.navy }}>I've clicked the link ↗</Text>
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
                last
              />
              <ResultBanner result={syncResult} />
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

      </ScrollView>
    </SafeAreaView>
  );
}
