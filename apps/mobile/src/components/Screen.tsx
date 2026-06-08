import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AnimatedBackground } from './AnimatedBackground';
import { palette, spacing } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  contentStyle?: ViewStyle;
  /** Hide the ambient aurora background (e.g. for media-heavy playback screen). */
  plain?: boolean;
}

/**
 * Standard screen shell: dark canvas + ambient animated background + safe-area insets.
 * Use `scroll` for long content. Keeps every screen visually consistent.
 */
export function Screen({ children, scroll, padded = true, contentStyle, plain }: ScreenProps) {
  const inner = (
    <View
      style={[
        styles.content,
        padded && { paddingHorizontal: spacing.xl },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <View style={styles.root}>
      {!plain && <AnimatedBackground />}
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {inner}
          </ScrollView>
        ) : (
          inner
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  safe: { flex: 1 },
  content: { flex: 1, paddingTop: spacing.lg },
  // Generous bottom space so content clears the floating tab bar (≈64h + insets).
  scrollContent: { paddingBottom: 128, flexGrow: 1 },
});
