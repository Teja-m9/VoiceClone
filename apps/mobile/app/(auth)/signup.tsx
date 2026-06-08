import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen, Text, TextField, GradientButton } from '@/components';
import { useAuth } from '@/providers/AuthProvider';
import { palette, spacing, motion } from '@/theme';

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
        <Animated.View entering={FadeInDown.duration(motion.duration.slow)} style={styles.head}>
          <Text variant="overline" color={palette.magenta}>
            GET STARTED
          </Text>
          <Text variant="display" style={{ marginTop: spacing.sm }}>
            Create your account
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(120).duration(motion.duration.slow)}
          style={styles.form}
        >
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
            secureTextEntry
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
          <View style={{ marginTop: spacing.md }}>
            <GradientButton label="Create account" gradient="ember" onPress={onSubmit} loading={loading} />
          </View>
          <View style={styles.footer}>
            <Text variant="caption">Already have an account? </Text>
            <Link href="/(auth)/login">
              <Text variant="caption" color={palette.violet}>
                Log in
              </Text>
            </Link>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { marginTop: spacing.xxl, marginBottom: spacing.xl },
  form: { gap: spacing.lg },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
});
