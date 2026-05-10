import { createClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'supabase_url';
const STORAGE_KEY_KEY = 'supabase_anon_key';

let _client = null;

export function getSupabaseCredentials() {
  if (typeof localStorage === 'undefined') return { url: null, anonKey: null };
  return {
    url:     localStorage.getItem(STORAGE_URL_KEY)  || null,
    anonKey: localStorage.getItem(STORAGE_KEY_KEY)  || null,
  };
}

export function saveSupabaseCredentials(url, anonKey) {
  localStorage.setItem(STORAGE_URL_KEY, url.trim());
  localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
  _client = null; // force re-init on next getClient()
}

export function clearSupabaseCredentials() {
  localStorage.removeItem(STORAGE_URL_KEY);
  localStorage.removeItem(STORAGE_KEY_KEY);
  _client = null;
}

export function getClient() {
  const { url, anonKey } = getSupabaseCredentials();
  if (!url || !anonKey) return null;
  if (!_client) {
    _client = createClient(url, anonKey, {
      auth: {
        persistSession:     true,
        autoRefreshToken:   true,
        detectSessionInUrl: true,
        storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
      },
    });
  }
  return _client;
}

export async function getSession() {
  const client = getClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data?.session ?? null;
}

export async function signInWithMagicLink(email) {
  const client = getClient();
  if (!client) throw new Error('Supabase not configured');
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function signInWithGitHub() {
  const client = getClient();
  if (!client) throw new Error('Supabase not configured');
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { error } = await client.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo },
  });
  if (error) throw error;
}

export async function signOut() {
  const client = getClient();
  if (!client) return;
  await client.auth.signOut();
}
