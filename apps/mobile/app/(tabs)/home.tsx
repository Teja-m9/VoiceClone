import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, Text, BentoCard, SongCard } from '@/components';
import { useProfile } from '@/hooks/useProfile';
import { useNotifications } from '@/hooks/useNotifications';
import { useSongSearch, LANGUAGES, type Language } from '@/hooks/useSongSearch';
import { gradients, palette, radius, spacing, typography, motion } from '@/theme';
import type { Track } from '@/types/track';

export default function HomeScreen() {
  const router = useRouter();
  const { profile, isPremium, quotaRemaining } = useProfile();
  const { unreadCount } = useNotifications();

  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState<Language>('Telugu');
  const { tracks, loading, usedFallback } = useSongSearch(query, language);

  const onPickSong = (track: Track) => {
    router.push({ pathname: '/(tabs)/create', params: { trackId: track.id } });
  };

  return (
    <Screen scroll>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(motion.duration.base)} style={styles.header}>
        <View>
          <Text variant="overline" color={palette.violet}>
            WELCOME BACK
          </Text>
          <Text variant="h1">{profile?.display_name || 'Artist'}</Text>
        </View>
        <View style={styles.bell}>
          <Ionicons name="notifications-outline" size={22} color={palette.textPrimary} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text variant="caption" color="#15161C" style={{ fontWeight: '800' }}>
                {unreadCount}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Hero CTA bento */}
      <BentoCard accent="primary" index={1} onPress={() => router.push('/record')} style={styles.hero}>
        <LinearGradient colors={gradients.primary} style={styles.heroIcon}>
          <Ionicons name="mic" size={26} color={palette.textInverse} />
        </LinearGradient>
        <Text variant="h2" style={{ marginTop: spacing.md }}>
          Clone your voice
        </Text>
        <Text variant="body">Record 30–60s once. Then sing any track in your own voice.</Text>
      </BentoCard>

      {/* Quota / plan bento */}
      <BentoCard index={2} accent={isPremium ? 'success' : null} style={{ marginTop: spacing.lg }}>
        <View style={styles.quotaRow}>
          <View>
            <Text variant="label" color={palette.textSecondary}>
              {isPremium ? 'Premium' : 'Free plan'}
            </Text>
            <Text variant="h2">
              {isPremium ? 'Unlimited covers' : `${quotaRemaining} of 3 covers left today`}
            </Text>
          </View>
          <Ionicons
            name={isPremium ? 'flash' : 'flash-outline'}
            size={28}
            color={isPremium ? palette.success : palette.amber}
          />
        </View>
      </BentoCard>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={palette.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search songs on JioSaavn…"
          placeholderTextColor={palette.textMuted}
          selectionColor={palette.violet}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={palette.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Language chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {LANGUAGES.map((lang) => {
          const active = lang === language;
          return (
            <Pressable
              key={lang}
              onPress={() => setLanguage(lang)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text variant="label" color={active ? palette.textInverse : palette.textSecondary}>
                {lang}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Results */}
      <View style={styles.sectionHead}>
        <Text variant="h2">{query.trim() ? 'Results' : `Trending · ${language}`}</Text>
        {usedFallback && <Text variant="caption">offline</Text>}
      </View>

      {loading ? (
        <ActivityIndicator color={palette.violet} style={{ marginTop: spacing.xl }} />
      ) : tracks.length === 0 ? (
        <BentoCard index={3}>
          <Text variant="title">No songs found</Text>
          <Text variant="body">Try another search term.</Text>
        </BentoCard>
      ) : (
        <View style={styles.list}>
          {tracks.map((track, i) => (
            <SongCard key={track.id} track={track} index={Math.min(i, 6)} onPress={onPickSong} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  bell: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: palette.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { gap: spacing.xs },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quotaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  searchInput: { ...typography.body, color: palette.textPrimary, flex: 1, paddingVertical: 0 },
  chips: { gap: spacing.sm, paddingVertical: spacing.lg },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  chipActive: { backgroundColor: palette.lime, borderColor: palette.lime },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
  },
  list: { gap: spacing.md },
});
