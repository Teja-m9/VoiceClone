import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { env } from './env';
import type { Database } from '@/types/db';

/**
 * SecureStore-backed auth storage so the session/JWT is persisted encrypted on device.
 * SecureStore has a ~2KB value limit and is native-only, so we fall back to in-memory
 * on web (dev only).
 */
const memoryStore = new Map<string, string>();

const ExpoSecureStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') return memoryStore.get(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      memoryStore.set(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      memoryStore.delete(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase: SupabaseClient<Database> = createClient<Database>(
  env.supabaseUrl,
  env.supabaseAnonKey,
  {
    auth: {
      storage: ExpoSecureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
