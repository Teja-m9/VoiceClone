import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Text } from './Text';
import { gradients, palette, radius, shadow, spacing, motion, type GradientName } from '@/theme';

const APressable = Animated.createAnimatedComponent(Pressable);

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  gradient?: GradientName;
  variant?: 'solid' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

/** Primary CTA: gradient fill, neon glow, springy press-scale, haptic tap. */
export function GradientButton({
  label,
  onPress,
  gradient = 'primary',
  variant = 'solid',
  loading,
  disabled,
  fullWidth = true,
}: GradientButtonProps) {
  const scale = useSharedValue(1);
  const glow = useSharedValue(0.55);

  // Computed unconditionally (rules of hooks): solid uses scale+glow, outline uses scale only.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: glow.value,
  }));
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const isDisabled = disabled || loading;

  const onPressIn = () => {
    scale.value = withSpring(0.96, motion.spring.snappy);
    glow.value = withTiming(0.85, { duration: motion.duration.fast });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, motion.spring.snappy);
    glow.value = withTiming(0.55, { duration: motion.duration.base });
  };

  const handlePress = () => {
    if (isDisabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  if (variant === 'outline') {
    return (
      <APressable
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
        style={[
          styles.outline,
          fullWidth && styles.fullWidth,
          isDisabled && styles.disabled,
          scaleStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={palette.textPrimary} />
        ) : (
          <Text variant="title" color={palette.textPrimary}>
            {label}
          </Text>
        )}
      </APressable>
    );
  }

  return (
    <APressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={isDisabled}
      style={[
        styles.wrap,
        shadow.glow,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        animatedStyle,
      ]}
    >
      <LinearGradient
        colors={gradients[gradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color={palette.textInverse} />
        ) : (
          <Text variant="title" color="#0B0B12">
            {label}
          </Text>
        )}
      </LinearGradient>
    </APressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.pill, overflow: 'visible' },
  fullWidth: { alignSelf: 'stretch' },
  gradient: {
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: {
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: palette.glassFill,
  },
  disabled: { opacity: 0.45 },
});
