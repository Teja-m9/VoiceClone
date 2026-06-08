import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, Text, GradientButton, JobStatusBadge } from '@/components';
import { useRealtimeJob } from '@/hooks/useRealtimeJob';
import { gradients, palette, radius, spacing, motion } from '@/theme';

const STEPS = ['Splitting the vocals', 'Cloning your timbre', 'Mixing the track', 'Rendering your cover'];

/** Pulsing gradient core. */
function Core() {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withRepeat(withTiming(1.12, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={[styles.core, style]}>
      <LinearGradient colors={gradients.aurora} style={styles.coreGrad}>
        <Ionicons name="musical-note" size={34} color={palette.textPrimary} />
      </LinearGradient>
    </Animated.View>
  );
}

/** A rotating arc ring (spinner). */
function ArcRing({ size, color, duration, reverse }: { size: number; color: string; duration: number; reverse?: boolean }) {
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = withRepeat(withTiming(reverse ? -1 : 1, { duration, easing: Easing.linear }), -1, false);
  }, [r, duration, reverse]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 360}deg` }] }));
  return (
    <Animated.View
      style={[
        styles.arc,
        { width: size, height: size, borderRadius: size / 2, borderTopColor: color },
        style,
      ]}
      pointerEvents="none"
    />
  );
}

/** Dots orbiting the core. */
function Orbit({ size, color, duration, count }: { size: number; color: string; duration: number; count: number }) {
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
  }, [r, duration]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 360}deg` }] }));
  return (
    <Animated.View
      style={[styles.orbit, { width: size, height: size }, style]}
      pointerEvents="none"
    >
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.orbitDot,
            { backgroundColor: color, transform: [{ rotate: `${(360 / count) * i}deg` }, { translateY: -size / 2 }] },
          ]}
        />
      ))}
    </Animated.View>
  );
}

export default function ProcessingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    jobId: string;
    title?: string;
    artist?: string;
    cover?: string;
    voice?: string;
  }>();
  const { jobId } = params;
  const { job } = useRealtimeJob(jobId ?? null);
  const failed = job?.status === 'failed';

  // Progress through the visual steps while the job runs.
  const [step, setStep] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (failed) return;
    progress.value = withTiming(1, { duration: 5200, easing: Easing.out(Easing.cubic) });
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1200);
    return () => clearInterval(id);
  }, [failed, progress]);

  // When done, advance to playback (carrying the song info for publishing).
  useEffect(() => {
    if (job?.status === 'done') {
      setStep(STEPS.length);
      const t = setTimeout(
        () =>
          router.replace({
            pathname: '/playback/[jobId]',
            params: {
              jobId: job.id,
              title: params.title ?? '',
              artist: params.artist ?? '',
              cover: params.cover ?? '',
              voice: params.voice ?? '',
            },
          }),
        650,
      );
      return () => clearTimeout(t);
    }
  }, [job?.status, job?.id, router, params.title, params.artist, params.cover, params.voice]);

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <Screen>
      <View style={styles.center}>
        {/* Animated loader */}
        <View style={styles.stage}>
          {!failed ? (
            <>
              <Orbit size={232} color={palette.cyan} duration={9000} count={2} />
              <ArcRing size={196} color={palette.lime} duration={2600} />
              <ArcRing size={156} color={palette.violet} duration={2100} reverse />
              <Orbit size={120} color={palette.magenta} duration={4200} count={3} />
              <Core />
            </>
          ) : (
            <View style={[styles.coreGrad, styles.failOrb]}>
              <Ionicons name="alert" size={44} color={palette.danger} />
            </View>
          )}
        </View>

        <Animated.View entering={FadeIn.duration(motion.duration.base)} style={styles.titleWrap}>
          <Text variant="display" center>
            {failed ? 'Something went wrong' : 'Creating your cover'}
          </Text>
          {!!params.title && !failed && (
            <Text variant="body" center style={{ marginTop: spacing.xs }}>
              {params.title} · in your voice
            </Text>
          )}
        </Animated.View>

        <View style={{ marginTop: spacing.lg }}>
          <JobStatusBadge status={failed ? 'failed' : job?.status ?? 'queued'} />
        </View>

        {!failed && (
          <>
            {/* Progress bar */}
            <View style={styles.track}>
              <Animated.View style={[styles.fill, barStyle]}>
                <LinearGradient colors={gradients.primary} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
              </Animated.View>
            </View>

            {/* Steps */}
            <View style={styles.steps}>
              {STEPS.map((label, i) => {
                const done = i < step;
                const activeNow = i === step;
                return (
                  <Animated.View
                    key={label}
                    entering={FadeInDown.delay(i * 80).duration(motion.duration.base)}
                    style={styles.stepRow}
                  >
                    <Ionicons
                      name={done ? 'checkmark-circle' : activeNow ? 'ellipse' : 'ellipse-outline'}
                      size={done ? 18 : 12}
                      color={done ? palette.success : activeNow ? palette.violet : palette.textMuted}
                    />
                    <Text variant="label" color={done || activeNow ? palette.textPrimary : palette.textMuted}>
                      {label}
                    </Text>
                  </Animated.View>
                );
              })}
            </View>
          </>
        )}
      </View>

      {failed ? (
        <View style={{ gap: spacing.md }}>
          <GradientButton label="Try again" onPress={() => router.replace('/(tabs)/create')} />
          <GradientButton label="Back home" variant="outline" onPress={() => router.replace('/(tabs)/home')} />
        </View>
      ) : (
        <GradientButton label="Notify me when ready" variant="outline" onPress={() => router.replace('/(tabs)/home')} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stage: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center' },
  core: { position: 'absolute' },
  coreGrad: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  failOrb: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  arc: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  orbit: { position: 'absolute', alignItems: 'center' },
  orbitDot: { position: 'absolute', top: 0, width: 10, height: 10, borderRadius: 5 },
  titleWrap: { marginTop: spacing.xxl, paddingHorizontal: spacing.lg },
  track: {
    width: 240,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.surfaceAlt,
    overflow: 'hidden',
    marginTop: spacing.xl,
  },
  fill: { height: 8, borderRadius: 4, overflow: 'hidden' },
  steps: { marginTop: spacing.xl, gap: spacing.md, alignSelf: 'stretch', paddingHorizontal: spacing.xxl },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
