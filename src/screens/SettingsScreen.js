import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { COLOURS, RADIUS } from '../theme';
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
import { pushRecord } from '../db/sync';
import { exportAllJSON, parseImportJSON, pickJSONFile } from '../utils/export';

// ─── Design primitives ────────────────────────────────────────────────────────

function GlassCard({ children, style }) {
  return (
    <BlurView intensity={40} tint="light" style={[{
      borderRadius: 18,
      overflow: 'hidden',
      marginBottom: 12,
      shadowColor: 'rgba(9,99,126,0.10)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 16,
      elevation: 4,
    }, style]}>
      <View style={{ backgroundColor: 'rgba(255,255,255,0.58)' }}>
        {children}
      </View>
    </BlurView>
  );
}

function SectionHeader({ children }) {
  return (
    <Text style={{
      fontFamily: 'Lato-Bold',
      fontSize: 11,
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
      borderBottomColor: 'rgba(9,99,126,0.07)',
    }, radius]}>
      {icon && (
        <View style={{
          width: 34, height: 34, borderRadius: 10,
          backgroundColor: danger ? 'rgba(214,40,40,0.10)' : 'rgba(9,99,126,0.10)',
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
          <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginTop: 1 }}>{sublabel}</Text>
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
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
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
          backgroundColor: 'rgba(9,99,126,0.06)',
          paddingHorizontal: 14,
          paddingVertical: 11,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(9,99,126,0.10)',
        }}
      />
    </View>
  );
}

function StatusDot({ connected }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: connected ? '#00B478' : COLOURS.textDim }} />
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: connected ? '#00825A' : COLOURS.textDim }}>
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
      <Text style={{ fontFamily: 'Lato', fontSize: 13, color: hasErrors ? COLOURS.red : '#00825A' }}>
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

  const loadState = useCallback(async () => {
    const { url: savedUrl, anonKey: savedKey } = getSupabaseCredentials();
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
      const client = getClient();
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
    saveSupabaseCredentials(url, anonKey);
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
    for (const { table, record } of all) {
      try { await pushRecord(table, record); pushed++; } catch { errors++; }
    }
    setSyncResult({ pushed, errors, message: errors > 0 ? `${pushed} pushed · ${errors} failed` : `${pushed} records synced` });
    setPhase('idle');
  }

  async function handleImport() {
    setError(null); setImportResult(null);
    try {
      const json = await pickJSONFile();
      const parsed = parseImportJSON(json);
      let s = 0, l = 0, c = 0, errors = 0;
      for (const r of parsed.sessions)      { try { await onSaveSession(r);     s++; } catch { errors++; } }
      for (const r of parsed.lessons)       { try { await onSaveLesson(r);      l++; } catch { errors++; } }
      for (const r of parsed.compositions)  { try { await onSaveComposition(r); c++; } catch { errors++; } }
      setImportResult({ errors, message: errors > 0 ? `${s}s / ${l}l / ${c}p imported · ${errors} failed` : `${s} sessions, ${l} lessons, ${c} pieces imported` });
    } catch (e) { setError(e.message || 'Import failed.'); }
  }

  function handleClearCredentials() {
    clearSupabaseCredentials();
    setUrl(''); setAnonKey(''); setCredsSaved(false); setSession(null);
  }

  const isSignedIn = !!session;
  const totalRecords = sessions.length + lessons.length + compositions.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingLeft: isDesktop ? 238 : 16, paddingTop: 8, paddingBottom: 60 }}>

        {/* Page title */}
        <View style={{ marginBottom: 4, marginTop: 4 }}>
          <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 30, color: COLOURS.text, letterSpacing: -0.3 }}>Settings</Text>
        </View>

        {/* ── Sync section ─────────────────────────────────────────── */}
        <SectionHeader>Sync</SectionHeader>

        <GlassCard>
          <Row
            icon="cloud-outline"
            label="Supabase"
            sublabel="Device sync"
            right={<StatusDot connected={isSignedIn} />}
            first last noBorder
          />
        </GlassCard>

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
              <Text style={{ fontFamily: 'Lato', fontSize: 13, color: '#00825A' }}>✓ Credentials saved</Text>
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
                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(9,99,126,0.10)' }} />
                    <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim }}>or</Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(9,99,126,0.10)' }} />
                  </View>
                  <View style={{ marginBottom: 8 }}>
                    <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>Email</Text>
                    <TextInput
                      value={email} onChangeText={setEmail}
                      placeholder="you@example.com" placeholderTextColor={COLOURS.textDim}
                      autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
                      style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.text, backgroundColor: 'rgba(9,99,126,0.06)', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(9,99,126,0.10)', marginBottom: 10 }}
                    />
                    <TouchableOpacity onPress={handleSendMagicLink} activeOpacity={0.8} disabled={phase === 'sending'}
                      style={{ paddingVertical: 11, borderRadius: RADIUS.pill, backgroundColor: 'rgba(9,99,126,0.10)', alignItems: 'center' }}>
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
                  <TouchableOpacity onPress={() => { setPhase('idle'); loadState(); }} style={{ marginTop: 4 }}>
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
              />
              <Row icon="arrow-down-outline" label="Export all as JSON"
                onPress={() => exportAllJSON(sessions, lessons, compositions).catch(() => {})}
              />
              <Row icon="arrow-up-outline" label="Import from JSON"
                onPress={handleImport}
                last
              />
              <ResultBanner result={syncResult} />
              <ResultBanner result={importResult} />
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

        {/* About */}
        <SectionHeader>About</SectionHeader>

        {/* Hero */}
        <View style={{ alignItems: 'center', paddingVertical: 28, gap: 4 }}>
          <Text style={{ fontSize: 72 }}>🎹</Text>
          <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 34, color: COLOURS.text, marginTop: 8, letterSpacing: -0.5 }}>
            music<Text style={{ color: COLOURS.practiceText }}>.</Text><Text style={{ color: COLOURS.lessonText }}>log</Text>
          </Text>
          <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, letterSpacing: 1.2 }}>v1.0.0</Text>
        </View>

        {/* Why this exists */}
        <GlassCard>
          <View style={{ padding: 18 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.steel, letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 10 }}>Why this exists</Text>
            <Text style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.textMuted, lineHeight: 24 }}>
              Starting piano as an adult is humbling. Progress is real but hard to see day to day — and practice without reflection tends to plateau. music.log is a quiet space to record what you worked on, how it felt, and watch the arc of improvement over weeks and months.
            </Text>
          </View>
        </GlassCard>

        {/* How it works */}
        <GlassCard>
          <View style={{ padding: 18 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.steel, letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 14 }}>How it works</Text>
            {[
              ['🎹', 'Log a session',    'Record duration, energy, pieces practised, and what you worked on in each segment.'],
              ['🎓', 'Log lessons',       'Capture teacher feedback, assignments, and what was covered — before you forget.'],
              ['📜', 'Build a library',   'Keep a catalogue of your repertoire with status, key, and time signature.'],
              ['📊', 'Track over time',   'Charts, streaks, and monthly stats show you the bigger picture.'],
            ].map(([icon, title, body]) => (
              <View key={title} style={{ flexDirection: 'row', gap: 14, marginBottom: 14, alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 22, width: 28, textAlign: 'center', marginTop: 1 }}>{icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.text, marginBottom: 2 }}>{title}</Text>
                  <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textMuted, lineHeight: 20 }}>{body}</Text>
                </View>
              </View>
            ))}
          </View>
        </GlassCard>

        {/* Built with */}
        <GlassCard>
          <View style={{ padding: 18, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.text, marginBottom: 14 }}>Made with ❤️ and 🎹</Text>
            <View style={{ height: 1, backgroundColor: 'rgba(9,99,126,0.08)', width: '100%', marginBottom: 14 }} />
            <View style={{ alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <View style={{ paddingVertical: 3, paddingHorizontal: 10, backgroundColor: COLOURS.navy, borderRadius: 6 }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: '#fff', letterSpacing: 0.5 }}>MIT</Text>
              </View>
              <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textMuted, lineHeight: 18, textAlign: 'center' }}>
                {`Licensed under the MIT Licence\nCopyright © ${new Date().getFullYear()} Lucas França\nOpen source, free to use and modify.`}
              </Text>
            </View>
            <TouchableOpacity onPress={() => { if (typeof window !== 'undefined') window.open('https://lfranca.uk', '_blank'); }}>
              <Text style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.steel, textDecorationLine: 'underline' }}>lfranca.uk</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

      </ScrollView>
    </SafeAreaView>
  );
}
