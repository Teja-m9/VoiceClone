import { useEffect } from 'react';
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
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, Text, GradientButton, JobStatusBadge } from '@/components';
import { useRealtimeJob } from '@/hooks/useRealtimeJob';
import { gradients, palette, spacing, motion } from '@/theme';

const STEPS = ['Splitting vocals', 'Cloning your timbre', 'Mixing the track', 'Rendering reel'];

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
  const { job, isTerminal } = useRealtimeJob(jobId ?? null);

  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.linear }), -1, false);
  }, [spin]);
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  // When the job finishes, auto-advance to playback.
  useEffect(() => {
    if (job?.status === 'done') {
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
        700,
      );
      return () => clearTimeout(t);
    }
  }, [job?.status, job?.id, router, params.title, params.artist, params.cover, params.voice]);

  const failed = job?.status === 'failed';

  return (
    <Screen>
      <View style={styles.center}>
        <Animated.View entering={FadeIn.duration(motion.duration.base)} style={styles.orbWrap}>
          {!failed ? (
            <Animated.View style={spinStyle}>
              <LinearGradient colors={gradients.aurora} style={styles.orb} />
            </Animated.View>
          ) : (
            <View style={[styles.orb, { backgroundColor: palette.surface }]}>
              <Ionicons name="alert" size={48} color={palette.danger} />
            </View>
          )}
        </Animated.View>

        <Text variant="display" center style={{ marginTop: spacing.xxl }}>
          {failed ? 'Something went wrong' : 'Creating your cover'}
        </Text>
        <Text variant="body" center style={{ marginTop: spacing.sm }}>
          {failed
            ? 'The generation failed. You can try again — this won\'t use a credit.'
            : 'This usually takes under a minute. Keep the app open.'}
        </Text>

        <View style={{ marginTop: spacing.xl }}>
          {job ? <JobStatusBadge status={job.status} /> : <JobStatusBadge status="queued" />}
        </View>

        {/* Step list */}
        {!failed && (
          <View style={styles.steps}>
            {STEPS.map((label, i) => {
              const active = job?.status === 'processing';
              return (
                <View key={label} style={styles.stepRow}>
                  <Ionicons
                    name={active ? 'ellipse' : 'ellipse-outline'}
                    size={10}
                    color={active ? palette.violet : palette.textMuted}
                  />
                  <Text variant="label" color={active ? palette.textPrimary : palette.textMuted}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {failed && (
        <View style={{ gap: spacing.md }}>
          <GradientButton label="Try again" onPress={() => router.replace('/(tabs)/create')} />
          <GradientButton label="Back home" variant="outline" onPress={() => router.replace('/(tabs)/home')} />
        </View>
      )}

      {!failed && !isTerminal && (
        <GradientButton
          label="Notify me when ready"
          variant="outline"
          onPress={() => router.replace('/(tabs)/home')}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  orbWrap: { alignItems: 'center', justifyContent: 'center' },
  orb: { width: 132, height: 132, borderRadius: 66, alignItems: 'center', justifyContent: 'center' },
  steps: { marginTop: spacing.xxl, gap: spacing.md, alignSelf: 'stretch', paddingHorizontal: spacing.xl },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
