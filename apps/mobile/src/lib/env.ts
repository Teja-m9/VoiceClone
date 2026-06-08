import Constants from 'expo-constants';

/**
 * Central runtime config accessor. Reads from expo-constants `extra` (populated by
 * app.config.ts from EXPO_PUBLIC_* env vars). The ONLY place the app reads config —
 * components/hooks import `env` from here, never `process.env` directly.
 */
type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  apiBaseUrl?: string;
  saavnApiUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

function required(value: string | undefined, name: string): string {
  if (!value) {
    // Surface misconfiguration loudly in dev rather than failing cryptically later.
    console.warn(`[env] Missing config "${name}". Set it in .env (see .env.example).`);
    return '';
  }
  return value;
}

const supabaseUrl = required(extra.supabaseUrl, 'EXPO_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = required(extra.supabaseAnonKey, 'EXPO_PUBLIC_SUPABASE_ANON_KEY');

/**
 * Demo/mock mode: on whenever Supabase isn't really configured (missing or placeholder
 * keys). In this mode the app runs fully offline against src/lib/mock.ts. Set real keys
 * in .env to turn it off automatically.
 */
export const MOCK_MODE =
  !supabaseUrl || supabaseUrl.includes('placeholder') || !supabaseAnonKey || supabaseAnonKey.includes('placeholder');

export const env = {
  supabaseUrl: supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey: supabaseAnonKey || 'placeholder-anon-key',
  apiBaseUrl: required(extra.apiBaseUrl, 'EXPO_PUBLIC_API_BASE_URL'),
  // JioSaavn API (override with your own instance via EXPO_PUBLIC_SAAVN_API_URL).
  saavnApiUrl: extra.saavnApiUrl || 'https://saavn.sumit.co',
} as const;
