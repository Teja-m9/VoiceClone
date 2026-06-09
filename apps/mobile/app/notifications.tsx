import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen, Text, BentoCard } from '@/components';
import { useNotifications } from '@/hooks/useNotifications';
import { palette, radius, spacing, motion } from '@/theme';
import type { NotifType } from '@/types/db';

const ICON: Record<NotifType, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  job_done: { name: 'checkmark-circle', color: palette.success },
  job_failed: { name: 'alert-circle', color: palette.danger },
  sub_activated: { name: 'diamond', color: palette.violet },
  sub_expired: { name: 'time', color: palette.amber },
  system: { name: 'sparkles', color: palette.cyan },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { items, unreadCount, markRead, markAllRead } = useNotifications();

  const onOpen = (n: (typeof items)[number]) => {
    if (!n.read_at) void markRead(n.id);
    // A finished cover → open the listen/share page for that job.
    if (n.type === 'job_done' && n.job_id) {
      router.push({ pathname: '/playback/[jobId]', params: { jobId: n.job_id } });
    }
  };

  return (
    <Screen scroll>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
          <Ionicons name="chevron-down" size={28} color={palette.textPrimary} />
        </Pressable>
        <Text variant="h2">Notifications</Text>
        {unreadCount > 0 ? (
          <Pressable onPress={() => void markAllRead()} hitSlop={8}>
            <Text variant="label" color={palette.violet}>
              Mark all
            </Text>
          </Pressable>
        ) : (
          <View style={{ width: 56 }} />
        )}
      </View>

      {items.length === 0 ? (
        <BentoCard index={0} style={styles.empty}>
          <Ionicons name="notifications-outline" size={32} color={palette.textMuted} />
          <Text variant="title" center style={{ marginTop: spacing.md }}>
            You're all caught up
          </Text>
          <Text variant="caption" center>
            Cover updates and account alerts will show up here.
          </Text>
        </BentoCard>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {items.map((n, i) => {
            const meta = ICON[n.type];
            return (
              <Animated.View
                key={n.id}
                entering={FadeInDown.delay(Math.min(i, 8) * motion.stagger).duration(motion.duration.base)}
              >
                <Pressable onPress={() => onOpen(n)}>
                  <View style={[styles.row, !n.read_at && styles.rowUnread]}>
                    <View style={[styles.iconWrap, { borderColor: meta.color }]}>
                      <Ionicons name={meta.name} size={20} color={meta.color} />
                    </View>
                    <View style={styles.body}>
                      <Text variant="title" numberOfLines={1}>
                        {n.title}
                      </Text>
                      {!!n.body && (
                        <Text variant="caption" numberOfLines={2}>
                          {n.body}
                        </Text>
                      )}
                      <Text variant="caption" color={palette.textMuted}>
                        {timeAgo(n.created_at)}
                        {n.type === 'job_done' && n.job_id ? '  ·  Tap to listen ▸' : ''}
                      </Text>
                    </View>
                    {!n.read_at && <View style={styles.dot} />}
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
    marginBottom: spacing.md,
  },
  rowUnread: { borderColor: palette.border, backgroundColor: palette.bgElevated },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.glassFill,
  },
  body: { flex: 1, gap: 2 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: palette.magenta },
});
