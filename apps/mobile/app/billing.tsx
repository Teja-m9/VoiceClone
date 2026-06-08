import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, Text, BentoCard, GradientButton } from '@/components';
import { api, ApiError } from '@/lib/api';
import { useProfile } from '@/hooks/useProfile';
import { gradients, palette, radius, spacing } from '@/theme';

type PlanId = 'monthly' | 'quarterly';

const PLANS: {
  id: PlanId;
  name: string;
  price: string;
  per: string;
  badge?: string;
}[] = [
  { id: 'monthly', name: 'Monthly', price: '₹149', per: 'per month' },
  { id: 'quarterly', name: '3 Months', price: '₹399', per: '≈ ₹133/mo · save 11%', badge: 'BEST VALUE' },
];

const PERKS = [
  'Unlimited covers — no daily limit',
  'No watermark on your songs',
  'HD audio + priority generation',
  'Publish unlimited covers to Shared',
];

export default function BillingScreen() {
  const router = useRouter();
  const { isPremium } = useProfile();
  const [selected, setSelected] = useState<PlanId>('quarterly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubscribe = async () => {
    setError(null);
    setLoading(true);
    try {
      const { url } = await api.createCheckout(selected);
      await WebBrowser.openBrowserAsync(url);
      // On return, the Stripe webhook flips profiles.plan → useProfile updates live.
      router.back();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Could not start checkout',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
          <Ionicons name="chevron-down" size={28} color={palette.textPrimary} />
        </Pressable>
        <Text variant="h2">Go Premium</Text>
        <View style={{ width: 28 }} />
      </View>

      <LinearGradient colors={gradients.aurora} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Ionicons name="diamond" size={30} color={palette.textPrimary} />
        <Text variant="display" color={palette.textPrimary} style={{ marginTop: spacing.sm }}>
          Unlimited covers
        </Text>
        <Text variant="body" color="#1B3A2E">
          Sing every song, watermark-free, in HD.
        </Text>
      </LinearGradient>

      {isPremium ? (
        <BentoCard accent="success" style={{ marginTop: spacing.xl }}>
          <Text variant="h2">You're Premium 💎</Text>
          <Text variant="body">Enjoy unlimited, watermark-free covers.</Text>
        </BentoCard>
      ) : (
        <>
          {/* Perks */}
          <View style={styles.perks}>
            {PERKS.map((p) => (
              <View key={p} style={styles.perkRow}>
                <Ionicons name="checkmark-circle" size={18} color={palette.success} />
                <Text variant="body" color={palette.textPrimary} style={{ flex: 1 }}>
                  {p}
                </Text>
              </View>
            ))}
          </View>

          {/* Plan cards */}
          <View style={styles.plans}>
            {PLANS.map((plan) => {
              const active = plan.id === selected;
              return (
                <Pressable key={plan.id} onPress={() => setSelected(plan.id)} style={{ flex: 1 }}>
                  <BentoCard accent={active ? 'primary' : null} style={styles.planCell}>
                    {plan.badge && (
                      <View style={styles.badge}>
                        <Text variant="overline" color={palette.textInverse}>
                          {plan.badge}
                        </Text>
                      </View>
                    )}
                    <Text variant="label" color={palette.textSecondary}>
                      {plan.name}
                    </Text>
                    <Text variant="displayXl">{plan.price}</Text>
                    <Text variant="caption">{plan.per}</Text>
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active && <Ionicons name="checkmark" size={14} color={palette.textInverse} />}
                    </View>
                  </BentoCard>
                </Pressable>
              );
            })}
          </View>

          {error && (
            <Text variant="caption" color={palette.danger} center style={{ marginTop: spacing.lg }}>
              {error}
            </Text>
          )}

          <View style={{ marginTop: spacing.xl }}>
            <GradientButton
              label={`Subscribe · ${PLANS.find((p) => p.id === selected)?.price}`}
              onPress={onSubscribe}
              loading={loading}
            />
            <Text variant="caption" center color={palette.textMuted} style={{ marginTop: spacing.md }}>
              Secure payment via Stripe. Cancel anytime.
            </Text>
          </View>
        </>
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
  hero: { borderRadius: radius.xl, padding: spacing.xl, alignItems: 'flex-start' },
  perks: { gap: spacing.md, marginTop: spacing.xl, marginBottom: spacing.xl },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  plans: { flexDirection: 'row', gap: spacing.md },
  planCell: { minHeight: 150, gap: spacing.xs, justifyContent: 'flex-start' },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: palette.violet,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },
  radio: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { backgroundColor: palette.violet, borderColor: palette.violet },
});
