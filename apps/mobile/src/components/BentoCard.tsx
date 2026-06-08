import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { gradients, palette, radius, shadow, spacing, motion, type GradientName } from '@/theme';

const APressable = Animated.createAnimatedComponent(Pressable);

interface BentoCardProps {
  children: ReactNode;
  onPress?: () => void;
  /** Show a neon gradient hairline border (the ctrl bento accent). */
  accent?: GradientName | null;
  /** Index for staggered entrance animation. */
  index?: number;
  style?: ViewStyle;
  padded?: boolean;
}

/**
 * Glassy rounded "bento" card with a staggered entrance and springy press feedback.
 * Optional neon gradient hairline gives the ctrl.xyz vibrant-grid look.
 */
export function BentoCard({
  children,
  onPress,
  accent = null,
  index = 0,
  style,
  padded = true,
}: BentoCardProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const body = (
    <View style={[styles.inner, padded && styles.padded, style]}>{children}</View>
  );

  const content = accent ? (
    <LinearGradient
      colors={gradients[accent]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.accentBorder}
    >
      <View style={styles.accentInner}>{body}</View>
    </LinearGradient>
  ) : (
    <View style={styles.plainBorder}>{body}</View>
  );

  return (
    <Animated.View entering={FadeInDown.delay(index * motion.stagger).duration(motion.duration.slow)}>
      {onPress ? (
        <APressable
          onPress={onPress}
          onPressIn={() => (scale.value = withSpring(0.97, motion.spring.snappy))}
          onPressOut={() => (scale.value = withSpring(1, motion.spring.snappy))}
          style={[shadow.card, animatedStyle]}
        >
          {content}
        </APressable>
      ) : (
        <View style={shadow.card}>{content}</View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  accentBorder: { borderRadius: radius.lg, padding: 1.5 },
  accentInner: { borderRadius: radius.lg - 1.5, overflow: 'hidden', backgroundColor: palette.surface },
  plainBorder: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.glassStroke,
    overflow: 'hidden',
    backgroundColor: palette.surface,
  },
  inner: { backgroundColor: palette.glassFill },
  padded: { padding: spacing.lg },
});
