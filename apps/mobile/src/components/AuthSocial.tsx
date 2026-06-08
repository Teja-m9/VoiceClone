import { StyleSheet, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { palette, radius, spacing } from '@/theme';

type Provider = { name: 'logo-google' | 'logo-facebook' | 'logo-apple'; color: string; label: string };

const PROVIDERS: Provider[] = [
  { name: 'logo-google', color: '#EA4335', label: 'Google' },
  { name: 'logo-facebook', color: '#1877F2', label: 'Facebook' },
  { name: 'logo-apple', color: palette.textPrimary, label: 'Apple' },
];

/** "or" divider + social sign-in buttons. onPress is optional (wired later per provider). */
export function AuthSocial({ onPress }: { onPress?: (provider: string) => void }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text variant="caption" color={palette.textMuted}>
          or continue with
        </Text>
        <View style={styles.line} />
      </View>
      <View style={styles.row}>
        {PROVIDERS.map((p) => (
          <Pressable
            key={p.label}
            style={styles.btn}
            onPress={() => onPress?.(p.label)}
            accessibilityRole="button"
            accessibilityLabel={`Continue with ${p.label}`}
          >
            <Ionicons name={p.name} size={22} color={p.color} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { flex: 1, height: 1, backgroundColor: palette.border },
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  btn: {
    width: 64,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
