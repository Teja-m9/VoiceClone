import { StyleSheet, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, Text, BentoCard, GradientButton } from '@/components';
import { useAuth } from '@/providers/AuthProvider';
import { useProfile } from '@/hooks/useProfile';
import { useVoiceProfiles } from '@/hooks/useVoiceProfiles';
import { useNotifications } from '@/hooks/useNotifications';
import { gradients, palette, radius, spacing, motion } from '@/theme';

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const { profile, isPremium, quotaRemaining } = useProfile();
  const { profiles } = useVoiceProfiles();
  const { items: notifications, unreadCount, markRead } = useNotifications();

  return (
    <Screen scroll>
      {/* Identity */}
      <Animated.View entering={FadeInDown.duration(motion.duration.base)} style={styles.identity}>
        <LinearGradient colors={gradients.aurora} style={styles.avatar}>
          <Text variant="display" color="#0B0B12">
            {(profile?.display_name || session?.user.email || '?').charAt(0).toUpperCase()}
          </Text>
        </LinearGradient>
        <Text variant="h1" style={{ marginTop: spacing.md }}>
          {profile?.display_name || 'Artist'}
        </Text>
        <Text variant="caption">{session?.user.email}</Text>
      </Animated.View>

      {/* Plan */}
      <BentoCard accent={isPremium ? 'success' : 'primary'} index={1}>
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
              label="Upgrade to Premium · ₹149/mo"
              gradient="ember"
              onPress={() => {
                /* TODO: launch Razorpay checkout (wired with backend) */
              }}
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
        profiles.map((vp, i) => (
          <BentoCard key={vp.id} index={i + 2} style={{ marginBottom: spacing.md }}>
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
        ))
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
        notifications.slice(0, 8).map((n, i) => (
          <Pressable key={n.id} onPress={() => !n.read_at && markRead(n.id)}>
            <BentoCard index={i + 3} style={{ marginBottom: spacing.sm }}>
              <View style={styles.notifRow}>
                <View style={[styles.notifDot, { opacity: n.read_at ? 0 : 1 }]} />
                <View style={{ flex: 1 }}>
                  <Text variant="title">{n.title}</Text>
                  {!!n.body && <Text variant="caption">{n.body}</Text>}
                </View>
              </View>
            </BentoCard>
          </Pressable>
        ))
      )}

      {/* Sign out */}
      <View style={{ marginTop: spacing.xxl }}>
        <GradientButton label="Sign out" variant="outline" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { alignItems: 'center', marginBottom: spacing.xl },
  avatar: { width: 80, height: 80, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
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
