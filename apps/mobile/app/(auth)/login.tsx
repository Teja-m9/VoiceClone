import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, Text, Mark, TextField, GradientButton } from '@/components';
import { useAuth } from '@/providers/AuthProvider';
import { MOCK_MODE } from '@/lib/env';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/mock';
import { gradients, palette, radius, spacing, motion } from '@/theme';

export default function LoginScreen() {
  const { signInWithPassword } = useAuth();
  const [email, setEmail] = useState(MOCK_MODE ? DEMO_EMAIL : '');
  const [password, setPassword] = useState(MOCK_MODE ? DEMO_PASSWORD : '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPassword(email.trim(), password);
      // AuthGate redirects on session change.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View entering={FadeIn.duration(motion.duration.slow)} style={styles.brandWrap}>
          <LinearGradient colors={gradients.aurora} style={styles.logo} />
          <Text variant="overline" color={palette.violet}>
            REALMVP
          </Text>
          <Text variant="displayXl" style={{ marginTop: spacing.sm }}>
            Hear yourself{'\n'}
            <Mark>sing anything.</Mark>
          </Text>
          <Text variant="body" style={{ marginTop: spacing.sm }}>
            Clone your voice in 60 seconds and turn any track into your own cover.
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(120).duration(motion.duration.slow)}
          style={styles.form}
        >
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
            secureTextEntry
            autoComplete="password"
          />
          {error && (
            <Text variant="caption" color={palette.danger}>
              {error}
            </Text>
          )}
          <View style={{ marginTop: spacing.md }}>
            <GradientButton label="Log in" onPress={onSubmit} loading={loading} />
          </View>

          <View style={styles.footer}>
            <Text variant="caption">New here? </Text>
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
              <Text variant="caption">
                No backend configured — running on seeded data. Just tap{' '}
                <Text variant="caption" color={palette.textPrimary}>
                  Log in
                </Text>{' '}
                (any credentials work).
              </Text>
              <Text variant="caption" color={palette.textMuted}>
                {DEMO_EMAIL} · {DEMO_PASSWORD}
              </Text>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandWrap: { marginTop: spacing.xxl, marginBottom: spacing.xxl },
  logo: { width: 56, height: 56, borderRadius: 18, marginBottom: spacing.lg },
  form: { gap: spacing.lg },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  demoBanner: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.glassFill,
    gap: spacing.xs,
  },
});
