import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { Screen, Text, BentoCard } from '@/components';
import { usePublishedCovers } from '@/hooks/usePublishedCovers';
import { gradients, palette, radius, shadow, spacing, motion } from '@/theme';
import type { PublishedCoverRow } from '@/types/db';

function plays(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

/** Big featured cover at the top of the feed. */
function FeaturedCover({
  cover,
  playing,
  onToggle,
}: {
  cover: PublishedCoverRow;
  playing: boolean;
  onToggle: (c: PublishedCoverRow) => void;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(motion.duration.slow)} style={shadow.glow}>
      <LinearGradient
        colors={gradients.aurora}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.featured}
      >
        <View style={styles.featuredTop}>
          <View style={styles.trendingPill}>
            <Ionicons name="flame" size={13} color={palette.textInverse} />
            <Text variant="overline" color={palette.textInverse}>
              TRENDING NOW
            </Text>
          </View>
          <View style={styles.playsPill}>
            <Ionicons name="headset" size={13} color={palette.textPrimary} />
            <Text variant="label" color={palette.textPrimary}>
              {plays(cover.plays)}
            </Text>
          </View>
        </View>

        <Text variant="display" color={palette.textPrimary} numberOfLines={2} style={styles.featuredTitle}>
          {cover.song_title}
        </Text>
        <Text variant="body" color="#1B3A2E">
          {cover.voice_name || cover.author_name} · {cover.artist ?? 'AI cover'}
        </Text>

        <View style={styles.featuredFooter}>
          <View style={styles.authorChip}>
            <Ionicons name="person-circle" size={18} color={palette.textPrimary} />
            <Text variant="label" color={palette.textPrimary}>
              {cover.author_name}
            </Text>
          </View>
          <Pressable
            onPress={() => onToggle(cover)}
            style={styles.featuredPlay}
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause' : 'Play'}
          >
            <Ionicons name={playing ? 'pause' : 'play'} size={28} color={palette.lime} />
          </Pressable>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

/** Ranked row card for the rest of the feed. */
function CoverRow({
  cover,
  rank,
  index,
  playing,
  onToggle,
}: {
  cover: PublishedCoverRow;
  rank: number;
  index: number;
  playing: boolean;
  onToggle: (c: PublishedCoverRow) => void;
}) {
  return (
    <BentoCard index={index} accent={playing ? 'primary' : null} padded={false}>
      <View style={styles.row}>
        <Text variant="h2" color={palette.textMuted} style={styles.rank}>
          {rank}
        </Text>
        {cover.cover_url ? (
          <Image source={{ uri: cover.cover_url }} style={styles.art} />
        ) : (
          <LinearGradient colors={gradients.ember} style={styles.art}>
            <Ionicons name="musical-notes" size={20} color={palette.textInverse} />
          </LinearGradient>
        )}
        <View style={styles.meta}>
          <Text variant="title" numberOfLines={1}>
            {cover.song_title}
          </Text>
          <Text variant="caption" numberOfLines={1}>
            {cover.author_name} · {plays(cover.plays)} plays
          </Text>
        </View>
        <Pressable
          onPress={() => onToggle(cover)}
          style={[styles.playBtn, playing && styles.playBtnActive]}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause' : 'Play'}
        >
          <Ionicons name={playing ? 'pause' : 'play'} size={18} color={palette.textInverse} />
        </Pressable>
      </View>
    </BentoCard>
  );
}

export default function FeedScreen() {
  const { items, loading } = usePublishedCovers();
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const activeId = status.playing ? playingId : null;

  const onToggle = async (cover: PublishedCoverRow) => {
    if (playingId === cover.id) {
      if (status.playing) player.pause();
      else player.play();
      return;
    }
    if (!cover.audio_url) return;
    await setAudioModeAsync({ playsInSilentMode: true });
    player.replace({ uri: cover.audio_url });
    player.play();
    setPlayingId(cover.id);
  };

  const featured = items[0];
  const rest = items.slice(1);

  return (
    <Screen scroll>
      <Text variant="overline" color={palette.violet}>
        COMMUNITY
      </Text>
      <Text variant="h1" style={{ marginBottom: spacing.xs }}>
        Shared covers
      </Text>
      <Text variant="body" style={{ marginBottom: spacing.xl }}>
        AI covers from the Auralis community. Make one and publish yours.
      </Text>

      {loading ? (
        <ActivityIndicator color={palette.violet} style={{ marginTop: spacing.xl }} />
      ) : !featured ? (
        <BentoCard index={0}>
          <Text variant="title">Nothing shared yet</Text>
          <Text variant="body">Be the first — generate a cover and tap Publish.</Text>
        </BentoCard>
      ) : (
        <>
          <FeaturedCover cover={featured} playing={activeId === featured.id} onToggle={onToggle} />

          {rest.length > 0 && (
            <Text variant="h2" style={styles.sectionHead}>
              More from the community
            </Text>
          )}
          <View style={styles.list}>
            {rest.map((c, i) => (
              <CoverRow
                key={c.id}
                cover={c}
                rank={i + 2}
                index={Math.min(i, 6)}
                playing={activeId === c.id}
                onToggle={onToggle}
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  featured: { borderRadius: radius.xl, padding: spacing.xl, gap: spacing.xs, overflow: 'hidden' },
  featuredTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  playsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.45)',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  featuredTitle: { marginTop: spacing.lg, letterSpacing: -0.5 },
  featuredFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  authorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  featuredPlay: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: palette.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHead: { marginTop: spacing.xxl, marginBottom: spacing.lg },
  list: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  rank: { width: 22, textAlign: 'center' },
  art: { width: 52, height: 52, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  meta: { flex: 1, gap: 2 },
  playBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: palette.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnActive: { backgroundColor: palette.magenta },
});
