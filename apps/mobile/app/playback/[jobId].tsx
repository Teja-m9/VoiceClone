import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  runOnJS,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, Text, GradientButton, BentoCard } from '@/components';
import { api, type JobOut } from '@/lib/api';
import { jiosaavn } from '@/lib/jiosaavn';
import { supabase } from '@/lib/supabase';
import { usePublishedCovers } from '@/hooks/usePublishedCovers';
import { useProfile } from '@/hooks/useProfile';
import { gradients, palette, radius, shadow, spacing, motion } from '@/theme';

const PREVIEW_SECONDS = 30;

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
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
  const [saved, setSaved] = useState(false);
  // Seek/scrub: live drag fraction (null when not dragging) + a ref to the current total.
  const [scrubFrac, setScrubFrac] = useState<number | null>(null);
  const trackW = useSharedValue(0);
  const totalRef = useRef(0);

  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;

  // Spinning disc — seamless (3600° is a multiple of 360°) while playing; freezes on pause.
  const rot = useSharedValue(0);
  useEffect(() => {
    if (playing) {
      rot.value = withRepeat(withTiming(rot.value + 3600, { duration: 96000, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(rot);
    }
  }, [playing, rot]);
  const discStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Free tier: stop at the 30s preview mark.
  useEffect(() => {
    if (!isPremium && status.playing && status.currentTime >= PREVIEW_SECONDS) {
      player.pause();
      setPreviewEnded(true);
    }
  }, [isPremium, status.playing, status.currentTime, player]);

  const togglePlay = () => {
    if (!job?.output_audio_url) return;
    if (playing) {
      player.pause();
      return;
    }
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
      const target = `${FileSystem.cacheDirectory}auralis-cover.${ext}`;
      const { uri } = await FileSystem.downloadAsync(url, target);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch {
      setError('Could not prepare the file to share.');
    }
  };

  // Download the mp3 straight onto the device (saved to the Music/media library). Falls
  // back to the system save sheet if the user denies storage permission.
  const onDownload = async () => {
    if (!job?.output_audio_url) return;
    setError(null);
    try {
      const safe = (params.title || 'cover').replace(/[^a-z0-9]+/gi, '_').slice(0, 40);
      const target = `${FileSystem.cacheDirectory}Auralis-${safe}.mp3`;
      const { uri } = await FileSystem.downloadAsync(job.output_audio_url, target);
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (perm.granted) {
        await MediaLibrary.createAssetAsync(uri); // → saved to the device's music/media
        setSaved(true);
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'audio/mpeg', dialogTitle: 'Save your cover' });
      } else {
        setError('Storage permission is needed to save the file.');
      }
    } catch {
      setError('Could not download the cover.');
    }
  };

  // Re-generate: a fresh cover of the same song with the same voice.
  const onRegenerate = async () => {
    if (!job) return;
    setError(null);
    try {
      player.pause();
      const t = await jiosaavn.getSongById(job.song_id);
      const key = `${job.voice_profile_id}:${job.song_id}:${Date.now()}`;
      const fresh = await api.createJob(job.song_id, job.voice_profile_id, key, t?.streamUrl);
      router.replace({
        pathname: '/processing/[jobId]',
        params: {
          jobId: fresh.id,
          title: params.title || '',
          artist: params.artist || '',
          cover: params.cover || '',
          voice: params.voice || '',
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not re-generate.');
    }
  };

  const onDelete = () =>
    Alert.alert('Delete this cover?', params.title || 'This cover', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          player.pause();
          await supabase.from('jobs').delete().eq('id', jobId);
          router.replace('/(tabs)/songs');
        },
      },
    ]);

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={palette.violet} size="large" />
        </View>
      </Screen>
    );
  }

  const total = isPremium ? status.duration || 0 : Math.min(status.duration || 0, PREVIEW_SECONDS);
  const pct = total > 0 ? Math.min(1, status.currentTime / total) : 0;
  totalRef.current = total;

  // Drag-to-seek: while dragging show the dragged position; on release jump the audio there.
  const onScrubMove = (f: number) => setScrubFrac(f);
  const onScrubEnd = (f: number) => {
    if (totalRef.current > 0) player.seekTo(f * totalRef.current);
    setPreviewEnded(false);
    setScrubFrac(null);
  };
  const seekGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => runOnJS(onScrubMove)(Math.max(0, Math.min(1, e.x / (trackW.value || 1)))))
    .onUpdate((e) => runOnJS(onScrubMove)(Math.max(0, Math.min(1, e.x / (trackW.value || 1)))))
    .onEnd((e) => runOnJS(onScrubEnd)(Math.max(0, Math.min(1, e.x / (trackW.value || 1)))));
  const shownFrac = scrubFrac ?? pct;

  return (
    <Screen scroll>
      {/* Header */}
      <View style={styles.head}>
        <Pressable onPress={() => router.replace('/(tabs)/songs')} hitSlop={12} accessibilityLabel="Close">
          <Ionicons name="chevron-down" size={28} color={palette.textPrimary} />
        </Pressable>
        <Text variant="overline" color={palette.violet}>
          NOW PLAYING
        </Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Spinning disc */}
      <Animated.View entering={FadeIn.duration(motion.duration.slow)} style={styles.discWrap}>
        <View style={[styles.discGlow, shadow.glow]} />
        <Animated.View style={[styles.disc, discStyle]}>
          {params.cover ? (
            <Image source={{ uri: params.cover }} style={styles.discArt} />
          ) : (
            <LinearGradient colors={gradients.aurora} style={styles.discArt} />
          )}
          <View style={styles.discRing} />
          <View style={styles.discHole} />
        </Animated.View>
      </Animated.View>

      {/* Title */}
      <View style={styles.titleWrap}>
        <Text variant="display" center numberOfLines={2}>
          {params.title || 'Your cover'}
        </Text>
        <Text variant="body" center>
          {params.artist ? `${params.artist} · ` : ''}in your voice
        </Text>
      </View>

      {/* Progress — draggable to scrub */}
      <View style={styles.progressWrap}>
        <GestureDetector gesture={seekGesture}>
          <View
            style={styles.touchTrack}
            onLayout={(e) => (trackW.value = e.nativeEvent.layout.width)}
          >
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${shownFrac * 100}%` }]}>
                <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              </View>
            </View>
            <View
              style={[
                styles.thumb,
                { left: `${shownFrac * 100}%` },
                scrubFrac !== null && styles.thumbActive,
              ]}
            />
          </View>
        </GestureDetector>
        <View style={styles.times}>
          <Text variant="caption" color={palette.textMuted}>
            {fmt((scrubFrac !== null ? shownFrac * total : status.currentTime) || 0)}
          </Text>
          <Text variant="caption" color={palette.textMuted}>
            {isPremium ? fmt(status.duration || 0) : '0:30'}
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Pressable onPress={() => player.seekTo(0)} hitSlop={10} style={styles.ctrlSmall}>
          <Ionicons name="play-skip-back" size={22} color={palette.textSecondary} />
        </Pressable>
        <Pressable onPress={togglePlay} style={styles.playBtn} accessibilityLabel={playing ? 'Pause' : 'Play'}>
          <LinearGradient colors={gradients.primary} style={styles.playInner}>
            <Ionicons name={playing ? 'pause' : 'play'} size={38} color={palette.textInverse} />
          </LinearGradient>
        </Pressable>
        <Pressable onPress={onShare} hitSlop={10} style={styles.ctrlSmall}>
          <Ionicons name="share-social-outline" size={22} color={palette.textSecondary} />
        </Pressable>
      </View>

      {/* Free preview gate */}
      {!isPremium && (
        <BentoCard accent={previewEnded ? 'primary' : null} style={styles.previewCard}>
          <View style={styles.previewRow}>
            <Ionicons
              name={previewEnded ? 'lock-closed' : 'time-outline'}
              size={20}
              color={previewEnded ? palette.violet : palette.textMuted}
            />
            <View style={{ flex: 1 }}>
              <Text variant="title">{previewEnded ? 'Preview ended' : '30-second preview'}</Text>
              <Text variant="caption">
                {previewEnded ? 'Unlock the full song with Premium.' : 'Free covers play the first 30s.'}
              </Text>
            </View>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <GradientButton label="Unlock full song" gradient="ember" onPress={() => router.push('/billing')} />
          </View>
        </BentoCard>
      )}

      {error && (
        <Text variant="caption" color={palette.danger} center style={{ marginTop: spacing.md }}>
          {error}
        </Text>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <GradientButton
          label={published ? '✓ Published to Shared' : 'Publish to Shared'}
          onPress={onPublish}
          loading={publishing}
          disabled={published}
        />
        <GradientButton
          label={saved ? '✓  Saved to device' : '⬇  Download'}
          variant="outline"
          onPress={onDownload}
          disabled={saved}
        />
        <GradientButton label="↻  Re-generate" variant="outline" onPress={() => void onRegenerate()} />
        <GradientButton label="Make another" variant="outline" onPress={() => router.replace('/(tabs)/create')} />
        <Pressable onPress={onDelete} style={styles.deleteLink} hitSlop={8} accessibilityLabel="Delete this cover">
          <Ionicons name="trash-outline" size={16} color={palette.danger} />
          <Text variant="label" color={palette.danger}>
            Delete this cover
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  discWrap: { alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
  discGlow: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: palette.lime,
    opacity: 0.25,
  },
  disc: {
    width: 240,
    height: 240,
    borderRadius: 120,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.black,
    padding: 8,
  },
  discArt: { width: '100%', height: '100%', borderRadius: 116 },
  discRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 6,
    borderColor: 'rgba(0,0,0,0.35)',
  },
  discHole: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.bg,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.3)',
  },
  titleWrap: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xl },
  progressWrap: { marginBottom: spacing.xl },
  touchTrack: { height: 28, justifyContent: 'center' }, // tall hit area for easy dragging
  track: { height: 6, borderRadius: 3, backgroundColor: palette.surfaceAlt, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, overflow: 'hidden' },
  thumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    backgroundColor: palette.violet,
    borderWidth: 2,
    borderColor: palette.surface,
  },
  thumbActive: { transform: [{ scale: 1.4 }] },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxl,
    marginBottom: spacing.xl,
  },
  ctrlSmall: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  playBtn: {},
  playInner: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  previewCard: { marginBottom: spacing.md },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actions: { gap: spacing.md, marginTop: spacing.sm },
  deleteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
});
