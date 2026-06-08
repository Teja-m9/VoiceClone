import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './Text';
import { BentoCard } from './BentoCard';
import { gradients, palette, radius, spacing } from '@/theme';
import type { Track } from '@/types/track';

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface SongCardProps {
  track: Track;
  index?: number;
  selected?: boolean;
  onPress: (track: Track) => void;
}

/** Catalog row: cover art, title/artist, duration + premium tag. */
export function SongCard({ track, index = 0, selected, onPress }: SongCardProps) {
  return (
    <BentoCard
      index={index}
      accent={selected ? 'primary' : null}
      onPress={() => onPress(track)}
      padded={false}
    >
      <View style={styles.row}>
        {track.coverUrl ? (
          <Image source={{ uri: track.coverUrl }} style={styles.cover} />
        ) : (
          <LinearGradient colors={gradients.aurora} style={styles.cover} />
        )}
        <View style={styles.meta}>
          <Text variant="title" numberOfLines={1}>
            {track.title}
          </Text>
          <Text variant="caption" numberOfLines={1}>
            {track.artist}
            {track.durationMs > 0 ? ` · ${formatDuration(track.durationMs)}` : ''}
          </Text>
        </View>
        {track.isPremium && (
          <View style={styles.proTag}>
            <Text variant="overline" color={palette.amber}>
              PRO
            </Text>
          </View>
        )}
      </View>
    </BentoCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  cover: { width: 54, height: 54, borderRadius: radius.sm },
  meta: { flex: 1, gap: 2 },
  proTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.amber,
  },
});
