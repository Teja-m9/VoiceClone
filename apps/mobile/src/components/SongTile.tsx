import { Image, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from './Text';
import { gradients, palette, radius, shadow, spacing, motion } from '@/theme';
import type { Track } from '@/types/track';

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface SongTileProps {
  track: Track;
  index?: number;
  selected?: boolean;
  onPress: (track: Track) => void;
}

/** Compact square-art tile for a 2-column song grid. */
export function SongTile({ track, index = 0, selected, onPress }: SongTileProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * motion.stagger).duration(motion.duration.base)}
      style={styles.cell}
    >
      <Pressable
        onPress={() => onPress(track)}
        style={[styles.tile, shadow.card, selected && styles.selected]}
        accessibilityRole="button"
        accessibilityLabel={`${track.title} by ${track.artist}`}
      >
        <View style={styles.artWrap}>
          {track.coverUrl ? (
            <Image source={{ uri: track.coverUrl }} style={styles.art} />
          ) : (
            <LinearGradient colors={gradients.aurora} style={styles.art}>
              <Text variant="h1" color={palette.textInverse}>
                {track.title.charAt(0)}
              </Text>
            </LinearGradient>
          )}
          {track.isPremium && (
            <View style={styles.proTag}>
              <Text variant="overline" color={palette.amber}>
                PRO
              </Text>
            </View>
          )}
          {selected && (
            <View style={styles.check}>
              <Text variant="label" color={palette.textInverse}>
                ✓
              </Text>
            </View>
          )}
        </View>
        <Text variant="title" numberOfLines={1} style={styles.title}>
          {track.title}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {track.artist}
          {track.durationMs > 0 ? ` · ${formatDuration(track.durationMs)}` : ''}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cell: { width: '48%' },
  tile: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.glassStroke,
    padding: spacing.sm,
    gap: 2,
  },
  selected: { borderColor: palette.lime, borderWidth: 2 },
  artWrap: { width: '100%', aspectRatio: 1, marginBottom: spacing.xs },
  art: {
    width: '100%',
    height: '100%',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { paddingHorizontal: 2 },
  proTag: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: palette.scrim,
    borderWidth: 1,
    borderColor: palette.amber,
  },
  check: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
