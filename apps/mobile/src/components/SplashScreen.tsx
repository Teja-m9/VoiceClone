import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  FadeInDown,
} from 'react-native-reanimated';
import { Text } from './Text';
import { gradients, palette, radius, spacing } from '@/theme';

/** Branded launch screen — a pulsing Auralis mark with a rotating accent ring. */
export function SplashScreen() {
  const pulse = useSharedValue(1);
  const spin = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
    spin.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.linear }), -1, false);
  }, [pulse, spin]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.center}>
        <View style={styles.logoWrap}>
          <Animated.View style={[styles.ring, spinStyle]} />
          <Animated.View style={pulseStyle}>
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logo}>
              <Ionicons name="musical-note" size={40} color={palette.textInverse} />
            </LinearGradient>
          </Animated.View>
        </View>
        <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.textWrap}>
          <Text variant="displayXl" center style={{ letterSpacing: -1 }}>
            Auralis
          </Text>
          <Text variant="caption" center color={palette.textMuted}>
            your voice, every song
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center' },
  logoWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: palette.lime,
    borderRightColor: palette.violet,
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { marginTop: spacing.xl, gap: 2 },
});
