import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Text } from './Text';
import { palette, radius, spacing } from '@/theme';
import type { JobStatus } from '@/types/db';

const META: Record<JobStatus, { label: string; color: string; pulse: boolean }> = {
  queued: { label: 'In queue', color: palette.info, pulse: true },
  processing: { label: 'Generating', color: palette.violet, pulse: true },
  done: { label: 'Ready', color: palette.success, pulse: false },
  failed: { label: 'Failed', color: palette.danger, pulse: false },
};

/** Pill badge with a pulsing dot for in-flight states. */
export function JobStatusBadge({ status }: { status: JobStatus }) {
  const meta = META[status];
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (meta.pulse) {
      pulse.value = withRepeat(withTiming(0.3, { duration: 700 }), -1, true);
    } else {
      pulse.value = 1;
    }
  }, [meta.pulse, pulse]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={[styles.pill, { borderColor: meta.color }]}>
      <Animated.View style={[styles.dot, { backgroundColor: meta.color }, dotStyle]} />
      <Text variant="label" color={meta.color}>
        {meta.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: palette.glassFill,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
