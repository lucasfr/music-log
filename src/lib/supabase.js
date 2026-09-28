import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_URL_KEY = 'supabase_url';
const STORAGE_KEY_KEY = 'supabase_anon_key';

// localStorage only exists on web; AsyncStorage is the native equivalent —
// this was the actual bug that made sync silently inert on the native app
// (getSupabaseCredentials() returned nulls there, so getClient() always
// returned null and every sync function no-op'd). Both AsyncStorage and
// localStorage conform to the same getItem/setItem/removeItem shape
// Supabase's own auth.storage option expects, so `storage` is passed
// straight through to createClient() below as well as used directly for
// our own credential storage — no separate adapter interface needed.
const storage = Platform.OS === 'web'
  ? (typeof localStorage !== 'undefined' ? localStorage : null)
  : AsyncStorage;

let _client = null;

// Credentials are read/written async now — AsyncStorage's API always is,
// unlike localStorage's synchronous one. Every caller of these three was
// already async or trivially made so (see SettingsScreen.js).
export async function getSupabaseCredentials() {
  if (!storage) return { url: null, anonKey: null };
  const [url, anonKey] = await Promise.all([
    storage.getItem(STORAGE_URL_KEY),
    storage.getItem(STORAGE_KEY_KEY),
  ]);
  return { url: url || null, anonKey: anonKey || null };
}

export async function saveSupabaseCredentials(url, anonKey) {
  if (!storage) throw new Error('No storage available on this platform');
  await storage.setItem(STORAGE_URL_KEY, url.trim());
  await storage.setItem(STORAGE_KEY_KEY, anonKey.trim());
  _client = null; // force re-init on next getClient()
}

export async function clearSupabaseCredentials() {
  if (!storage) return;
  await storage.removeItem(STORAGE_URL_KEY);
  await storage.removeItem(STORAGE_KEY_KEY);
  _client = null;
}

export async function getClient() {
  const { url, anonKey } = await getSupabaseCredentials();
  if (!url || !anonKey) return null;
  if (!_client) {
    _client = createClient(url, anonKey, {
      auth: {
        persistSession:     true,
        autoRefreshToken:   true,
        // detectSessionInUrl relies on window.location, which only makes
        // sense for the web OAuth/magic-link redirect flow.
        detectSessionInUrl: Platform.OS === 'web',
        storage: storage || undefined,
      },
    });
  }
  return _client;
}

export async function getSession() {
  const client = await getClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data?.session ?? null;
}

export async function signInWithMagicLink(email) {
  const client = await getClient();
  if (!client) throw new Error('Supabase not configured');
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function signInWithGitHub() {
  const client = await getClient();
  if (!client) throw new Error('Supabase not configured');
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { error } = await client.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo },
  });
  if (error) throw error;
}

export async function signOut() {
  const client = await getClient();
  if (!client) return;
  await client.auth.signOut();
}
