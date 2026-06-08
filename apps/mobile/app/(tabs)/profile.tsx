import { StyleSheet, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, Text, BentoCard, GradientButton } from '@/components';
import { useAuth } from '@/providers/AuthProvider';
import { useProfile } from '@/hooks/useProfile';
import { useVoiceProfiles } from '@/hooks/useVoiceProfiles';
import { useNotifications } from '@/hooks/useNotifications';
import { usePublishedCovers } from '@/hooks/usePublishedCovers';
import { gradients, palette, radius, spacing, motion } from '@/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { profile, isPremium, quotaRemaining } = useProfile();
  const { profiles } = useVoiceProfiles();
  const { items: notifications, unreadCount, markRead } = useNotifications();
  const { items: published } = usePublishedCovers();
  const myPublished = published.filter((p) => p.user_id === session?.user.id).length;

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
            {isPremium ? '∞' : quotaRemaining}
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
              {isPremium ? 'Unlimited & watermark-free' : `${quotaRemaining}/3 covers left today`}
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

      {/* Voices */}
      <Text variant="h2" style={styles.section}>
        Your voices
      </Text>
      {profiles.length === 0 ? (
        <BentoCard index={2}>
          <Text variant="body">No voices yet. Record one from the Create tab.</Text>
        </BentoCard>
      ) : (
        <View style={styles.cardList}>
          {profiles.map((vp, i) => (
            <BentoCard key={vp.id} index={i + 2}>
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

      {/* Notifications */}
      <View style={styles.sectionHead}>
        <Text variant="h2">Notifications</Text>
        {unreadCount > 0 && (
          <View style={styles.unread}>
            <Text variant="caption" color="#0B0B12" style={{ fontWeight: '800' }}>
              {unreadCount} new
            </Text>
          </View>
        )}
      </View>
      {notifications.length === 0 ? (
        <BentoCard index={3}>
          <Text variant="body">You're all caught up.</Text>
        </BentoCard>
      ) : (
        <View style={styles.cardList}>
          {notifications.slice(0, 8).map((n, i) => (
            <Pressable key={n.id} onPress={() => !n.read_at && markRead(n.id)}>
              <BentoCard index={i + 3}>
                <View style={styles.notifRow}>
                  <View style={[styles.notifDot, { opacity: n.read_at ? 0 : 1 }]} />
                  <View style={{ flex: 1 }}>
                    <Text variant="title">{n.title}</Text>
                    {!!n.body && <Text variant="caption">{n.body}</Text>}
                  </View>
                </View>
              </BentoCard>
            </Pressable>
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
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  unread: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.magenta,
  },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.magenta },
});
