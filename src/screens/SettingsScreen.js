import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS } from '../theme';
import { SectionTitle } from '../components/UI';
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  clearSupabaseCredentials,
  getClient,
  getSession,
  signInWithMagicLink,
  signOut,
} from '../lib/supabase';
import { pushRecord } from '../db/sync';

function Field({ label, value, onChangeText, placeholder, secureTextEntry, autoCapitalize, keyboardType }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: 12, color: COLOURS.textDim, letterSpacing: 0.4, marginBottom: 6, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <BlurView intensity={30} tint="light" style={{ borderRadius: RADIUS.md, overflow: 'hidden' }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLOURS.textDim}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize || 'none'}
          autoCorrect={false}
          keyboardType={keyboardType}
          style={{
            fontFamily: 'Lato',
            fontSize: 14,
            color: COLOURS.text,
            backgroundColor: 'rgba(255,255,255,0.55)',
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: RADIUS.md,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.70)',
          }}
        />
      </BlurView>
    </View>
  );
}

function StatusBadge({ connected, email }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 14, paddingVertical: 10,
      borderRadius: RADIUS.pill,
      backgroundColor: connected ? 'rgba(0,180,120,0.12)' : 'rgba(214,40,40,0.08)',
      alignSelf: 'flex-start',
      marginBottom: 20,
    }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: connected ? '#00B478' : COLOURS.red }} />
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: connected ? '#00825A' : COLOURS.red }}>
        {connected ? `Signed in as ${email}` : 'Not signed in'}
      </Text>
    </View>
  );
}

function GlassSection({ children }) {
  return (
    <BlurView intensity={36} tint="light" style={{ borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 16, shadowColor: 'rgba(9,99,126,0.10)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 14, elevation: 4 }}>
      <View style={{ backgroundColor: 'rgba(255,255,255,0.55)', padding: 16 }}>
        {children}
      </View>
    </BlurView>
  );
}

export default function SettingsScreen({ isDesktop, sessions = [], lessons = [], compositions = [] }) {
  const [url,        setUrl]        = useState('');
  const [anonKey,    setAnonKey]    = useState('');
  const [email,      setEmail]      = useState('');
  const [session,    setSession]    = useState(null);
  const [credsSaved, setCredsSaved] = useState(false);
  const [phase,      setPhase]      = useState('idle'); // idle | sending | sent | signing-out | syncing
  const [syncResult, setSyncResult] = useState(null);  // null | { pushed, errors }
  const [error,      setError]      = useState(null);
  const [savedBanner, setSavedBanner] = useState(false);

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

  // Listen for magic link redirect on web
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

  async function handleSendMagicLink() {
    setError(null);
    setPhase('sending');
    try {
      await signInWithMagicLink(email);
      setPhase('sent');
    } catch (e) {
      setError(e.message || 'Failed to send magic link.');
      setPhase('idle');
    }
  }

  async function handleSignOut() {
    setPhase('signing-out');
    await signOut();
    setSession(null);
    setPhase('idle');
  }

  async function handleSyncAll() {
    setPhase('syncing');
    setSyncResult(null);
    let pushed = 0, errors = 0;
    const all = [
      ...sessions.map(r     => ({ table: 'sessions',     record: r })),
      ...lessons.map(r      => ({ table: 'lessons',      record: r })),
      ...compositions.map(r => ({ table: 'compositions', record: r })),
    ];
    for (const { table, record } of all) {
      try {
        await pushRecord(table, record);
        pushed++;
      } catch {
        errors++;
      }
    }
    setSyncResult({ pushed, errors });
    setPhase('idle');
  }

  function handleClearCredentials() {
    clearSupabaseCredentials();
    setUrl(''); setAnonKey(''); setCredsSaved(false); setSession(null);
  }

  const isSignedIn = !!session;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingLeft: isDesktop ? 226 : 16, paddingBottom: 60 }}>

        <SectionTitle style={{ marginTop: 4 }}>Sync</SectionTitle>
        <StatusBadge connected={isSignedIn} email={session?.user?.email} />

        {/* Credentials */}
        <GlassSection>
          <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 18, color: COLOURS.navy, marginBottom: 14 }}>
            Supabase credentials
          </Text>
          <Field label="Project URL" value={url} onChangeText={setUrl} placeholder="https://xxxx.supabase.co" keyboardType="url" />
          <Field label="Anon key" value={anonKey} onChangeText={setAnonKey} placeholder="eyJhbGci..." secureTextEntry />
          {error && <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.red, marginBottom: 10 }}>{error}</Text>}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={handleSaveCredentials} activeOpacity={0.8}
              style={{ flex: 1, paddingVertical: 12, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navy, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: '#fff' }}>Save</Text>
            </TouchableOpacity>
            {credsSaved && (
              <TouchableOpacity onPress={handleClearCredentials} activeOpacity={0.8}
                style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: RADIUS.pill, backgroundColor: 'rgba(214,40,40,0.10)' }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.red }}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          {savedBanner && (
            <Text style={{ fontFamily: 'Lato', fontSize: 13, color: '#00825A', marginTop: 10 }}>✓ Credentials saved</Text>
          )}
        </GlassSection>

        {/* Sign in */}
        {credsSaved && !isSignedIn && (
          <GlassSection>
            <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 18, color: COLOURS.navy, marginBottom: 14 }}>Sign in</Text>
            {phase !== 'sent' ? (
              <>
                <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
                <TouchableOpacity onPress={handleSendMagicLink} activeOpacity={0.8} disabled={phase === 'sending'}
                  style={{ paddingVertical: 12, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navy, alignItems: 'center' }}>
                  {phase === 'sending'
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: '#fff' }}>Send magic link</Text>
                  }
                </TouchableOpacity>
              </>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 12, gap: 8 }}>
                <Text style={{ fontSize: 28 }}>📬</Text>
                <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 18, color: COLOURS.navy }}>Check your email</Text>
                <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, textAlign: 'center' }}>
                  Click the link in the email from Supabase, then come back here.
                </Text>
                <TouchableOpacity onPress={() => { setPhase('idle'); loadState(); }} style={{ marginTop: 8 }}>
                  <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.navy }}>I've clicked the link ↗</Text>
                </TouchableOpacity>
              </View>
            )}
          </GlassSection>
        )}

        {/* Signed in */}
        {isSignedIn && (
          <>
            <GlassSection>
              <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 18, color: COLOURS.navy, marginBottom: 14 }}>Data</Text>
              <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginBottom: 16 }}>
                {sessions.length} sessions · {lessons.length} lessons · {compositions.length} pieces
              </Text>
              <TouchableOpacity onPress={handleSyncAll} activeOpacity={0.8} disabled={phase === 'syncing'}
                style={{ paddingVertical: 12, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navy, alignItems: 'center' }}>
                {phase === 'syncing'
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: '#fff' }}>⬆ Push all to Supabase</Text>
                }
              </TouchableOpacity>
              {syncResult && (
                <Text style={{ fontFamily: 'Lato', fontSize: 13, marginTop: 10,
                  color: syncResult.errors > 0 ? COLOURS.red : '#00825A' }}>
                  {syncResult.errors > 0
                    ? `✓ ${syncResult.pushed} pushed · ✕ ${syncResult.errors} failed`
                    : `✓ ${syncResult.pushed} records pushed successfully`
                  }
                </Text>
              )}
            </GlassSection>
            <GlassSection>
              <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 18, color: COLOURS.navy, marginBottom: 6 }}>Account</Text>
              <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginBottom: 16 }}>{session.user.email}</Text>
              <TouchableOpacity onPress={handleSignOut} activeOpacity={0.8} disabled={phase === 'signing-out'}
                style={{ paddingVertical: 12, borderRadius: RADIUS.pill, backgroundColor: 'rgba(214,40,40,0.10)', alignItems: 'center' }}>
                {phase === 'signing-out'
                  ? <ActivityIndicator color={COLOURS.red} size="small" />
                  : <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.red }}>Sign out</Text>
                }
              </TouchableOpacity>
            </GlassSection>
          </>
        )}

        {/* About */}
        <SectionTitle style={{ marginTop: 4 }}>About</SectionTitle>
        <GlassSection>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 22, color: COLOURS.text }}>
              music<Text style={{ color: COLOURS.practiceText }}>.</Text>
              <Text style={{ color: COLOURS.lessonText }}>log</Text>
            </Text>
            <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim }}>v1.0.0</Text>
          </View>
        </GlassSection>

      </ScrollView>
    </SafeAreaView>
  );
}
