import { useMemo } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, Text, BentoCard, GradientButton } from '@/components';
import { useAuth } from '@/providers/AuthProvider';
import { useProfile } from '@/hooks/useProfile';
import { useVoiceProfiles } from '@/hooks/useVoiceProfiles';
import { useMySongs } from '@/hooks/useMySongs';
import { usePublishedCovers } from '@/hooks/usePublishedCovers';
import { gradients, palette, radius, spacing, motion } from '@/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { profile, isPremium, quotaRemaining, quotaTotal } = useProfile();
  const { profiles } = useVoiceProfiles();
  const { items: mySongs } = useMySongs();
  const { items: published } = usePublishedCovers();
  const myPublished = published.filter((p) => p.user_id === session?.user.id).length;

  // Interests = the artists whose songs the user has covered, most-covered first.
  const interests = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of mySongs) {
      const artist = s.track?.artist?.trim();
      if (!artist) continue;
      // an entry can list several artists ("A, B") — split so each gets credit
      for (const a of artist.split(/,|&|feat\.?/i).map((x) => x.trim()).filter(Boolean)) {
        counts.set(a, (counts.get(a) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name]) => name);
  }, [mySongs]);

  return (
    <Screen scroll>
      {/* Identity */}
      <Animated.View entering={FadeInDown.duration(motion.duration.base)} style={styles.identity}>
        <LinearGradient colors={gradients.aurora} style={styles.avatar}>
          <Text variant="display" color={palette.textInverse}>
            {(profile?.display_name || session?.user.email || '?').charAt(0).toUpperCase()}
          </Text>
        </LinearGradient>
        <Text variant="h1" style={{ marginTop: spacing.md }}>
          {profile?.display_name || 'Artist'}
        </Text>
        <Text variant="caption">{session?.user.email}</Text>
        <Pressable
          onPress={() => router.push('/edit-profile')}
          style={styles.editBtn}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
        >
          <Ionicons name="create-outline" size={15} color={palette.textPrimary} />
          <Text variant="label" color={palette.textPrimary}>
            Edit profile
          </Text>
        </Pressable>
      </Animated.View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text variant="displayXl" style={styles.statNum}>
            {profiles.length}
          </Text>
          <Text variant="label" color={palette.textSecondary}>
            Voices
          </Text>
        </View>
        <View style={styles.statCell}>
          <Text variant="displayXl" style={styles.statNum}>
            {myPublished}
          </Text>
          <Text variant="label" color={palette.textSecondary}>
            Published
          </Text>
        </View>
        <View style={styles.statCell}>
          <Text variant="displayXl" style={styles.statNum}>
            {quotaRemaining === Infinity ? '∞' : quotaRemaining}
          </Text>
          <Text variant="label" color={palette.textSecondary}>
            Credits
          </Text>
        </View>
      </View>

      {/* Plan */}
      <BentoCard
        accent={isPremium ? 'success' : 'primary'}
        index={1}
        onPress={() => router.push('/billing')}
      >
        <View style={styles.planRow}>
          <View style={{ flex: 1 }}>
            <Text variant="overline" color={isPremium ? palette.success : palette.violet}>
              {isPremium ? 'PREMIUM' : 'FREE PLAN'}
            </Text>
            <Text variant="h2">
              {quotaRemaining === Infinity
                ? 'Unlimited & watermark-free'
                : isPremium
                  ? `${quotaRemaining} of ${quotaTotal} songs left`
                  : `${quotaRemaining}/3 covers left today`}
            </Text>
          </View>
        </View>
        {!isPremium && (
          <View style={{ marginTop: spacing.md }}>
            <GradientButton
              label="Upgrade to Premium"
              gradient="ember"
              onPress={() => router.push('/billing')}
            />
          </View>
        )}
      </BentoCard>

      {/* Interests — learned from the songs they've covered */}
      <Text variant="h2" style={styles.section}>
        Your music taste
      </Text>
      {interests.length === 0 ? (
        <BentoCard index={2}>
          <Text variant="body">
            Make a few covers and we'll learn the artists you love — they'll show up here.
          </Text>
        </BentoCard>
      ) : (
        <BentoCard index={2}>
          <Text variant="caption" style={{ marginBottom: spacing.md }}>
            Based on the songs you sing, you're into:
          </Text>
          <View style={styles.chips}>
            {interests.map((name) => (
              <View key={name} style={styles.chip}>
                <Ionicons name="musical-note" size={13} color={palette.violet} />
                <Text variant="label" color={palette.textPrimary}>
                  {name}
                </Text>
              </View>
            ))}
          </View>
        </BentoCard>
      )}

      {/* Voices */}
      <Text variant="h2" style={styles.section}>
        Your voices
      </Text>
      {profiles.length === 0 ? (
        <BentoCard index={3}>
          <Text variant="body">No voices yet. Record one from the Create tab.</Text>
        </BentoCard>
      ) : (
        <View style={styles.cardList}>
          {profiles.map((vp, i) => (
            <BentoCard key={vp.id} index={i + 3}>
              <View style={styles.voiceRow}>
                <Ionicons name="mic-circle" size={28} color={palette.violet} />
                <View style={{ flex: 1 }}>
                  <Text variant="title">{vp.name}</Text>
                  <Text variant="caption">
                    {vp.status === 'ready' ? 'Ready to sing' : `Status: ${vp.status}`}
                  </Text>
                </View>
              </View>
            </BentoCard>
          ))}
        </View>
      )}

      {/* Sign out */}
      <View style={{ marginTop: spacing.xxl }}>
        <GradientButton label="Sign out" variant="outline" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { alignItems: 'center', marginBottom: spacing.lg },
  avatar: { width: 80, height: 80, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl, alignSelf: 'stretch' },
  statCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 124,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.glassStroke,
    backgroundColor: palette.surface,
  },
  statNum: { fontSize: 34, lineHeight: 38 },
  cardList: { gap: spacing.md },
  planRow: { flexDirection: 'row', alignItems: 'center' },
  section: { marginTop: spacing.xxl, marginBottom: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.glassStroke,
    backgroundColor: palette.bg,
  },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
