import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, Mark, TextField, GradientButton, AuthSocial } from '@/components';
import { useAuth } from '@/providers/AuthProvider';
import { MOCK_MODE } from '@/lib/env';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/mock';
import { gradients, palette, radius, spacing, motion } from '@/theme';

export default function LoginScreen() {
  const { signInWithPassword } = useAuth();
  const [email, setEmail] = useState(MOCK_MODE ? DEMO_EMAIL : '');
  const [password, setPassword] = useState(MOCK_MODE ? DEMO_PASSWORD : '');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPassword(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Brand + welcome */}
        <Animated.View entering={FadeIn.duration(motion.duration.slow)} style={styles.brandWrap}>
          <View style={styles.brandRow}>
            <LinearGradient colors={gradients.primary} style={styles.logo}>
              <Ionicons name="musical-note" size={20} color={palette.textInverse} />
            </LinearGradient>
            <Text variant="title">Auralis</Text>
          </View>
          <Text variant="displayXl" style={{ marginTop: spacing.xl }}>
            Welcome{'\n'}
            <Mark>back.</Mark>
          </Text>
          <Text variant="body" style={{ marginTop: spacing.sm }}>
            Sing anything in your own voice. Pick up where you left off.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(motion.duration.slow)} style={styles.form}>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureToggle
            autoComplete="password"
          />
          {error && (
            <Text variant="caption" color={palette.danger}>
              {error}
            </Text>
          )}
          {info && (
            <Text variant="caption" color={palette.info}>
              {info}
            </Text>
          )}

          <View style={{ marginTop: spacing.sm }}>
            <GradientButton label="Log in" onPress={onSubmit} loading={loading} />
          </View>

          <AuthSocial onPress={(p) => setInfo(`${p} sign-in is coming soon.`)} />

          <View style={styles.footer}>
            <Text variant="caption">New to Auralis? </Text>
            <Link href="/(auth)/signup">
              <Text variant="caption" color={palette.violet}>
                Create an account
              </Text>
            </Link>
          </View>

          {MOCK_MODE && (
            <View style={styles.demoBanner}>
              <Text variant="overline" color={palette.cyan}>
                DEMO MODE
              </Text>
              <Text variant="caption">Tap Log in — any credentials work on seeded data.</Text>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandWrap: { marginTop: spacing.xl, marginBottom: spacing.xxl },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  form: { gap: spacing.lg },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm },
  demoBanner: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.glassFill,
    gap: spacing.xs,
  },
});
