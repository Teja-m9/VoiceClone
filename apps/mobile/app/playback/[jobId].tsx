import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, Text, GradientButton, BentoCard } from '@/components';
import { api, type JobOut } from '@/lib/api';
import { usePublishedCovers } from '@/hooks/usePublishedCovers';
import { useProfile } from '@/hooks/useProfile';
import { gradients, palette, spacing } from '@/theme';

/** Free tier hears a 30s preview; full song is Premium. */
const PREVIEW_SECONDS = 30;

/** Animated bar in the faux equalizer. */
function EqBar({ delay, playing }: { delay: number; playing: boolean }) {
  const h = useSharedValue(0.3);
  useEffect(() => {
    if (playing) {
      h.value = withRepeat(withTiming(1, { duration: 420 + delay, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else {
      h.value = withTiming(0.3);
    }
  }, [playing, h, delay]);
  const style = useAnimatedStyle(() => ({ height: `${h.value * 100}%` }));
  return <Animated.View style={[styles.eqBar, style]} />;
}

export default function PlaybackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    jobId: string;
    title?: string;
    artist?: string;
    cover?: string;
    voice?: string;
  }>();
  const { jobId } = params;
  const { publish } = usePublishedCovers();
  const { isPremium } = useProfile();
  const [job, setJob] = useState<JobOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previewEnded, setPreviewEnded] = useState(false);

  // Player created without a source; we swap in the URL once the job loads.
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;

  // Free tier: stop at the 30s preview mark and prompt to upgrade for the full song.
  useEffect(() => {
    if (!isPremium && status.playing && status.currentTime >= PREVIEW_SECONDS) {
      player.pause();
      setPreviewEnded(true);
    }
  }, [isPremium, status.playing, status.currentTime, player]);

  // Fetch fresh presigned output URLs, then point the player at the audio.
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    api
      .getJob(jobId)
      .then(async (j) => {
        if (cancelled) return;
        setJob(j);
        if (j.output_audio_url) {
          await setAudioModeAsync({ playsInSilentMode: true });
          player.replace({ uri: j.output_audio_url });
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load cover'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // player identity is stable for the screen's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const togglePlay = () => {
    if (!job?.output_audio_url) return;
    if (playing) {
      player.pause();
      return;
    }
    // Replay the 30s preview from the start for free users.
    if (previewEnded || status.didJustFinish || status.currentTime >= (status.duration || 0)) {
      player.seekTo(0);
      setPreviewEnded(false);
    }
    player.play();
  };

  const onPublish = async () => {
    if (published || !job?.output_audio_url) return;
    setPublishing(true);
    setError(null);
    try {
      await publish({
        songTitle: params.title || 'My cover',
        artist: params.artist || null,
        coverUrl: params.cover || null,
        audioUrl: job.output_audio_url,
        voiceName: params.voice || null,
      });
      setPublished(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not publish');
    } finally {
      setPublishing(false);
    }
  };

  const onShare = async () => {
    const url = job?.output_reel_url ?? job?.output_audio_url;
    if (!url) return;
    try {
      const ext = job?.output_reel_url ? 'mp4' : 'm4a';
      const target = `${FileSystem.cacheDirectory}realmvp-cover.${ext}`;
      const { uri } = await FileSystem.downloadAsync(url, target);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      }
    } catch {
      setError('Could not prepare the file to share.');
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={palette.violet} size="large" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen plain>
      <LinearGradient colors={gradients.aurora} style={styles.hero}>
        <View style={styles.heroScrim} />
        <Pressable onPress={() => router.replace('/(tabs)/home')} hitSlop={12} style={styles.close}>
          <Ionicons name="chevron-down" size={28} color={palette.textPrimary} />
        </Pressable>
        <Text variant="overline" color="#0B0B12">
          YOUR COVER
        </Text>
        <Text variant="displayXl" color="#0B0B12">
          {params.title || "It's ready."}
        </Text>
        {!!params.artist && (
          <Text variant="body" color="#1B3A2E">
            {params.artist} · in your voice
          </Text>
        )}
      </LinearGradient>

      <View style={styles.body}>
        {/* Equalizer */}
        <View style={styles.eq}>
          {Array.from({ length: 16 }).map((_, i) => (
            <EqBar key={i} delay={i * 40} playing={playing} />
          ))}
        </View>

        {/* Play */}
        <Pressable onPress={togglePlay} style={styles.playBtn}>
          <LinearGradient colors={gradients.primary} style={styles.playInner}>
            <Ionicons name={playing ? 'pause' : 'play'} size={40} color="#0B0B12" />
          </LinearGradient>
        </Pressable>

        {/* Free-tier 30s preview gate */}
        {!isPremium && (
          <BentoCard accent={previewEnded ? 'primary' : null} style={styles.previewCard}>
            <View style={styles.previewRow}>
              <Ionicons
                name={previewEnded ? 'lock-closed' : 'time-outline'}
                size={20}
                color={previewEnded ? palette.violet : palette.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text variant="title">
                  {previewEnded ? 'Preview ended' : '30-second preview'}
                </Text>
                <Text variant="caption">
                  {previewEnded
                    ? 'Upgrade to hear & share the full song.'
                    : 'Free covers play the first 30s. Go Premium for the full track.'}
                </Text>
              </View>
            </View>
            <View style={{ marginTop: spacing.md }}>
              <GradientButton
                label="Unlock full song"
                gradient="ember"
                onPress={() => router.push('/billing')}
              />
            </View>
          </BentoCard>
        )}

        {error && (
          <Text variant="caption" color={palette.danger} center>
            {error}
          </Text>
        )}

        <View style={styles.actions}>
          <GradientButton
            label={published ? '✓ Published to Shared' : 'Publish to Shared'}
            onPress={onPublish}
            loading={publishing}
            disabled={published}
          />
          <GradientButton label="Share cover" variant="outline" onPress={onShare} />
          <GradientButton
            label="Make another"
            variant="outline"
            onPress={() => router.replace('/(tabs)/create')}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { paddingTop: spacing.huge, paddingBottom: spacing.xxl, paddingHorizontal: spacing.xl },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.04)' },
  close: { position: 'absolute', top: spacing.xxl, right: spacing.lg },
  body: { flex: 1, padding: spacing.xl, justifyContent: 'space-between' },
  eq: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
    height: 120,
    marginTop: spacing.xl,
  },
  eqBar: { width: 8, borderRadius: 4, backgroundColor: palette.violet },
  previewCard: { marginBottom: spacing.sm },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  playBtn: { alignSelf: 'center' },
  playInner: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: spacing.md },
});
