import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, Mark, TextField, GradientButton, AuthSocial } from '@/components';
import { useAuth } from '@/providers/AuthProvider';
import { gradients, palette, spacing, motion } from '@/theme';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setInfo(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim());
      setInfo('Account created! Check your email to confirm, then log in.');
      setTimeout(() => router.replace('/(auth)/login'), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View entering={FadeIn.duration(motion.duration.slow)} style={styles.brandWrap}>
          <View style={styles.brandRow}>
            <LinearGradient colors={gradients.primary} style={styles.logo}>
              <Ionicons name="musical-note" size={20} color={palette.textInverse} />
            </LinearGradient>
            <Text variant="title">Auralis</Text>
          </View>
          <Text variant="displayXl" style={{ marginTop: spacing.xl }}>
            <Mark>Welcome!</Mark>
          </Text>
          <Text variant="body" style={{ marginTop: spacing.sm }}>
            Start your journey today — clone your voice and make your first cover.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(motion.duration.slow)} style={styles.form}>
          <TextField label="Display name" value={name} onChangeText={setName} placeholder="Your name" />
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureToggle
          />
          {error && (
            <Text variant="caption" color={palette.danger}>
              {error}
            </Text>
          )}
          {info && (
            <Text variant="caption" color={palette.success}>
              {info}
            </Text>
          )}

          <View style={{ marginTop: spacing.sm }}>
            <GradientButton label="Create your account" onPress={onSubmit} loading={loading} />
          </View>

          <AuthSocial onPress={(p) => setInfo(`${p} sign-in is coming soon.`)} />

          <View style={styles.footer}>
            <Text variant="caption">Already have an account? </Text>
            <Link href="/(auth)/login">
              <Text variant="caption" color={palette.violet}>
                Sign in
              </Text>
            </Link>
          </View>
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
});
