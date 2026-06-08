import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { palette } from '@/theme';

const AView = Animated.createAnimatedComponent(View);

/** A single slow-drifting pale blob (very subtle on the light canvas). */
function Blob({
  colors,
  size,
  startX,
  startY,
  delay,
}: {
  colors: readonly [string, string, ...string[]];
  size: number;
  startX: number;
  startY: number;
  delay: number;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 11000, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
  }, [t, delay]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value, [0, 1], [0, 32]) },
      { translateY: interpolate(t.value, [0, 1], [0, -38]) },
      { scale: interpolate(t.value, [0, 1], [1, 1.12]) },
    ],
    opacity: interpolate(t.value, [0, 1], [0.18, 0.32]),
  }));

  return (
    <AView
      style={[
        { position: 'absolute', left: startX, top: startY, width: size, height: size },
        style,
      ]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, borderRadius: size / 2 }}
      />
    </AView>
  );
}

/**
 * Ambient light backdrop — a warm off-white canvas with two barely-there pale blobs
 * (lime + sky blue) that drift slowly. Keeps the app feeling alive while staying clean
 * and airy, matching the light travel-app aesthetic.
 */
export function AnimatedBackground() {
  const { width, height } = useWindowDimensions();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg }]} />
      <Blob
        colors={[palette.lime, '#E8FBA8']}
        size={width * 0.85}
        startX={-width * 0.2}
        startY={-height * 0.02}
        delay={0}
      />
      <Blob
        colors={['#BFE6FF', '#E9F6FF']}
        size={width * 0.8}
        startX={width * 0.4}
        startY={height * 0.5}
        delay={2000}
      />
    </View>
  );
}
