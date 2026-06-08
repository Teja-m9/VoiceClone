import { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Expo app config. Public runtime config (Supabase URL/anon key, API base URL) is read
 * from EXPO_PUBLIC_* env vars at build time and exposed via `extra`. Never hardcode
 * secrets here — see docs/CODING_GUIDELINES.md.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Auralis',
  slug: 'realmvp',
  scheme: 'realmvp',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  splash: {
    resizeMode: 'cover',
    backgroundColor: '#EFEFE9',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'xyz.realmvp.app',
    infoPlist: {
      NSMicrophoneUsageDescription:
        'RealMVP needs your microphone to record a short sample of your voice for cloning.',
    },
  },
  android: {
    package: 'xyz.realmvp.app',
    permissions: ['RECORD_AUDIO'],
    adaptiveIcon: { backgroundColor: '#EFEFE9' },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-audio',
      {
        microphonePermission:
          'RealMVP needs your microphone to record a short sample of your voice for cloning.',
      },
    ],
    'expo-font',
    'expo-web-browser',
    [
      'expo-splash-screen',
      { backgroundColor: '#EFEFE9', resizeMode: 'cover' },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    saavnApiUrl: process.env.EXPO_PUBLIC_SAAVN_API_URL,
    router: { origin: false },
  },
});
