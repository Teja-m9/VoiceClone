import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen, Text, BentoCard, GradientButton } from '@/components';
import { useMySongs, type MySong } from '@/hooks/useMySongs';
import { useProfile } from '@/hooks/useProfile';
import { gradients, palette, radius, shadow, spacing, motion } from '@/theme';

function MySongCard({
  item,
  index,
  onPress,
  onDelete,
}: {
  item: MySong;
  index: number;
  onPress: (i: MySong) => void;
  onDelete: (i: MySong) => void;
}) {
  const title = item.track?.title ?? 'My cover';
  const artist = item.track?.artist ?? 'in your voice';
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * motion.stagger).duration(motion.duration.base)}
      style={styles.cell}
    >
      <Pressable onPress={() => onPress(item)} style={[styles.tile, shadow.card]}>
        <View style={styles.artWrap}>
          {item.track?.coverUrl ? (
            <Image source={{ uri: item.track.coverUrl }} style={styles.art} />
          ) : (
            <LinearGradient colors={gradients.aurora} style={styles.art}>
              <Ionicons name="musical-note" size={26} color={palette.textInverse} />
            </LinearGradient>
          )}
          <Pressable
            onPress={() => onDelete(item)}
            hitSlop={10}
            style={styles.deleteBadge}
            accessibilityLabel={`Delete ${title}`}
          >
            <Ionicons name="trash" size={15} color={palette.textInverse} />
          </Pressable>
          <View style={styles.playBadge}>
            <Ionicons name="play" size={16} color={palette.textInverse} />
          </View>
        </View>
        <Text variant="title" numberOfLines={1} style={{ paddingHorizontal: 2 }}>
          {title}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {artist}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function MySongsScreen() {
  const router = useRouter();
  const { items, loading, remove } = useMySongs();
  const { isPremium } = useProfile();

  const open = (i: MySong) =>
    router.push({
      pathname: '/playback/[jobId]',
      params: {
        jobId: i.jobId,
        title: i.track?.title ?? '',
        artist: i.track?.artist ?? '',
        cover: i.track?.coverUrl ?? '',
      },
    });

  const confirmDelete = (i: MySong) =>
    Alert.alert('Delete this cover?', i.track?.title ?? 'This cover', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove(i.jobId) },
    ]);

  return (
    <Screen scroll>
      <Text variant="overline" color={palette.violet}>
        YOUR LIBRARY
      </Text>
      <Text variant="h1" style={{ marginBottom: spacing.xs }}>
        My Songs
      </Text>
      <Text variant="body" style={{ marginBottom: spacing.xl }}>
        {isPremium
          ? 'Your AI covers — full songs, watermark-free.'
          : 'Your AI covers play a 30s preview. Go Premium for full songs.'}
      </Text>

      {loading ? (
        <ActivityIndicator color={palette.violet} style={{ marginTop: spacing.xl }} />
      ) : items.length === 0 ? (
        <BentoCard index={0} style={styles.empty}>
          <Ionicons name="mic-outline" size={32} color={palette.textMuted} />
          <Text variant="title" center style={{ marginTop: spacing.md }}>
            No covers yet
          </Text>
          <Text variant="body" center>
            Head to Create, pick a song, and generate your first cover.
          </Text>
          <View style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}>
            <GradientButton label="Make a cover" onPress={() => router.push('/(tabs)/create')} />
          </View>
        </BentoCard>
      ) : (
        <View style={styles.grid}>
          {items.map((it, i) => (
            <MySongCard key={it.jobId} item={it} index={i} onPress={open} onDelete={confirmDelete} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.lg },
  cell: { width: '48%' },
  tile: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.glassStroke,
    padding: spacing.sm,
    gap: 2,
  },
  artWrap: { width: '100%', aspectRatio: 1, marginBottom: spacing.xs },
  art: { width: '100%', height: '100%', borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  playBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(11,11,18,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
});
