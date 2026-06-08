import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, Text, BentoCard, SongCard } from '@/components';
import { useProfile } from '@/hooks/useProfile';
import { useNotifications } from '@/hooks/useNotifications';
import { useSongSearch, LANGUAGES, type Language } from '@/hooks/useSongSearch';
import { gradients, palette, radius, shadow, spacing, motion } from '@/theme';
import type { Track } from '@/types/track';

export default function HomeScreen() {
  const router = useRouter();
  const { isPremium, quotaRemaining } = useProfile();
  const { unreadCount } = useNotifications();

  const [language, setLanguage] = useState<Language>('Telugu');
  const { tracks, loading, usedFallback } = useSongSearch('', language);

  const goToCreate = (trackId?: string) =>
    router.push({ pathname: '/(tabs)/create', params: trackId ? { trackId } : {} });

  return (
    <Screen scroll>
      {/* Brand + notifications */}
      <Animated.View entering={FadeInDown.duration(motion.duration.base)} style={styles.header}>
        <View style={styles.brand}>
          <LinearGradient colors={gradients.primary} style={styles.brandMark}>
            <Ionicons name="musical-note" size={20} color={palette.textInverse} />
          </LinearGradient>
          <Text variant="displayXl" style={styles.brandName}>
            Auralis
          </Text>
        </View>
        <Pressable
          style={styles.bell}
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <Ionicons name="notifications-outline" size={22} color={palette.textPrimary} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text variant="caption" color={palette.textInverse} style={styles.badgeText}>
                {unreadCount}
              </Text>
            </View>
          )}
        </Pressable>
      </Animated.View>

      {/* Search → opens Create (search happens there) */}
      <Pressable
        style={styles.searchBar}
        onPress={() => goToCreate()}
        accessibilityRole="button"
        accessibilityLabel="Search songs"
      >
        <Ionicons name="search" size={18} color={palette.textMuted} />
        <Text variant="body" color={palette.textMuted} style={{ flex: 1 }}>
          Search any song to cover…
        </Text>
        <Ionicons name="arrow-forward" size={16} color={palette.textMuted} />
      </Pressable>

      {/* Hero banner */}
      <Animated.View entering={FadeInDown.delay(60).duration(motion.duration.slow)}>
        <Pressable onPress={() => router.push('/record')} style={shadow.glow}>
          <LinearGradient colors={gradients.aurora} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="mic" size={28} color={palette.textPrimary} />
            </View>
            <Text variant="display" color={palette.textPrimary} style={styles.heroTitle}>
              Clone your{'\n'}voice
            </Text>
            <Text variant="body" color="#1B3A2E">
              Record 30–60s once — then sing any track in your own voice.
            </Text>
            <View style={styles.heroCta}>
              <Text variant="label" color={palette.textPrimary}>
                Get started
              </Text>
              <Ionicons name="arrow-forward" size={16} color={palette.textPrimary} />
            </View>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* Bento stat grid */}
      <View style={styles.bentoRow}>
        <BentoCard index={2} style={styles.bentoCell}>
          <Ionicons
            name={isPremium ? 'flash' : 'flash-outline'}
            size={22}
            color={isPremium ? palette.success : palette.amber}
          />
          <Text variant="displayXl" style={styles.statNum}>
            {isPremium ? '∞' : quotaRemaining}
          </Text>
          <Text variant="caption">{isPremium ? 'Unlimited today' : 'Covers left today'}</Text>
        </BentoCard>
        <BentoCard
          index={3}
          accent={isPremium ? 'success' : null}
          style={styles.bentoCell}
          onPress={() => router.push('/billing')}
        >
          <Ionicons name="diamond-outline" size={22} color={palette.violet} />
          <Text variant="h1" style={styles.statNum}>
            {isPremium ? 'Premium' : 'Free'}
          </Text>
          <Text variant="caption">{isPremium ? 'Manage plan' : 'Tap to upgrade'}</Text>
        </BentoCard>
      </View>

      {/* Language chips (fixed wrap row — no horizontal-scroll layout flash) */}
      <View style={styles.chips}>
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
      </View>

      {/* Trending */}
      <View style={styles.sectionHead}>
        <Text variant="h2">{`Trending · ${language}`}</Text>
        {usedFallback && <Text variant="caption">offline</Text>}
      </View>

      {loading ? (
        <ActivityIndicator color={palette.violet} style={{ marginTop: spacing.xl }} />
      ) : (
        <View style={styles.list}>
          {tracks.map((track: Track, i) => (
            <SongCard key={track.id} track={track} index={Math.min(i, 6)} onPress={(t) => goToCreate(t.id)} />
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
    marginBottom: spacing.lg,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandMark: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  brandName: { letterSpacing: -1 },
  bell: {
    width: 46,
    height: 46,
    borderRadius: 16,
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
    backgroundColor: palette.magenta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontWeight: '800' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },

  hero: { borderRadius: radius.xl, padding: spacing.xl, gap: spacing.xs, overflow: 'hidden' },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroTitle: { letterSpacing: -0.5 },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.4)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },

  bentoRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  bentoCell: { flex: 1, gap: spacing.xs, minHeight: 120, justifyContent: 'space-between' },
  statNum: { marginTop: spacing.sm },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.lg },
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
