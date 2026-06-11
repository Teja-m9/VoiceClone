import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, Text, SongTile, GradientButton } from '@/components';
import { jiosaavn } from '@/lib/jiosaavn';
import { gradients, palette, radius, spacing, typography } from '@/theme';
import type { Track, Album } from '@/types/track';

const PAGE = 20;

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'songs' | 'albums'>('songs');

  const [songs, setSongs] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // Album drill-down
  const [openAlbum, setOpenAlbum] = useState<Album | null>(null);
  const [albumSongs, setAlbumSongs] = useState<Track[]>([]);
  const [albumLoading, setAlbumLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSongs([]);
      setAlbums([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setPage(0);
    const handle = setTimeout(async () => {
      const [s, a] = await Promise.all([
        jiosaavn.searchSongs(q, PAGE, 0),
        jiosaavn.searchAlbums(q, PAGE),
      ]);
      if (cancelled) return;
      setSongs(s);
      setAlbums(a);
      setLoading(false);
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  const loadMore = async () => {
    const next = page + 1;
    setLoadingMore(true);
    const more = await jiosaavn.searchSongs(query.trim(), PAGE, next);
    setSongs((prev) => [...prev, ...more.filter((m) => !prev.some((p) => p.id === m.id))]);
    setPage(next);
    setLoadingMore(false);
  };

  const openAlbumSongs = async (album: Album) => {
    setOpenAlbum(album);
    setAlbumLoading(true);
    setAlbumSongs(await jiosaavn.getAlbumSongs(album.id));
    setAlbumLoading(false);
  };

  // Picking any track → Create screen with that track preselected.
  const pick = (track: Track) =>
    router.push({ pathname: '/(tabs)/create', params: { trackId: track.id } });

  return (
    <Screen scroll>
      {/* Header */}
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close search">
          <Ionicons name="chevron-down" size={28} color={palette.textPrimary} />
        </Pressable>
        <Text variant="overline" color={palette.violet}>
          FIND A SONG
        </Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Search box */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={palette.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Songs, artists, albums…"
          placeholderTextColor={palette.textMuted}
          selectionColor={palette.violet}
          style={styles.searchInput}
          autoFocus
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={palette.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['songs', 'albums'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => {
              setTab(t);
              setOpenAlbum(null);
            }}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text variant="label" color={tab === t ? palette.textInverse : palette.textSecondary}>
              {t === 'songs' ? 'Songs' : 'Albums'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={palette.violet} style={{ marginTop: spacing.xl }} />
      ) : !query.trim() ? (
        <Text variant="body" center style={{ marginTop: spacing.xxl }} color={palette.textMuted}>
          Search for any song or album to cover.
        </Text>
      ) : tab === 'songs' ? (
        <>
          <View style={styles.grid}>
            {songs.map((track, i) => (
              <SongTile key={track.id} track={track} index={Math.min(i, 8)} onPress={pick} />
            ))}
          </View>
          {songs.length > 0 && (
            <View style={{ marginTop: spacing.xl }}>
              <GradientButton
                label="Load more songs"
                variant="outline"
                loading={loadingMore}
                onPress={() => void loadMore()}
              />
            </View>
          )}
        </>
      ) : openAlbum ? (
        // Album drill-down: its songs
        <>
          <Pressable onPress={() => setOpenAlbum(null)} style={styles.backRow} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={palette.violet} />
            <Text variant="label" color={palette.violet}>
              All albums
            </Text>
          </Pressable>
          <Text variant="h2" numberOfLines={1} style={{ marginBottom: spacing.md }}>
            {openAlbum.name}
          </Text>
          {albumLoading ? (
            <ActivityIndicator color={palette.violet} style={{ marginTop: spacing.lg }} />
          ) : (
            <View style={styles.grid}>
              {albumSongs.map((track, i) => (
                <SongTile key={track.id} track={track} index={Math.min(i, 8)} onPress={pick} />
              ))}
            </View>
          )}
        </>
      ) : (
        // Albums list
        <View style={styles.cardList}>
          {albums.map((album) => (
            <Pressable key={album.id} onPress={() => void openAlbumSongs(album)} style={styles.albumRow}>
              {album.coverUrl ? (
                <Image source={{ uri: album.coverUrl }} style={styles.albumArt} />
              ) : (
                <LinearGradient colors={gradients.aurora} style={styles.albumArt}>
                  <Ionicons name="albums" size={22} color={palette.textInverse} />
                </LinearGradient>
              )}
              <View style={{ flex: 1 }}>
                <Text variant="title" numberOfLines={1}>
                  {album.name}
                </Text>
                <Text variant="caption" numberOfLines={1}>
                  {album.artist}
                  {album.year ? ` · ${album.year}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={palette.textMuted} />
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  searchInput: { ...typography.body, color: palette.textPrimary, flex: 1, paddingVertical: 0 },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.lg },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  tabActive: { backgroundColor: palette.violet, borderColor: palette.violet },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.lg },
  cardList: { gap: spacing.md },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.md },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.glassStroke,
    backgroundColor: palette.surface,
  },
  albumArt: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
