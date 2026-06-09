import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MOCK_MODE } from '@/lib/env';
import { mockData } from '@/lib/mock';
import { isAdminEmail } from '@/lib/admin';
import { useAuth } from '@/providers/AuthProvider';
import type { ProfileRow } from '@/types/db';

/**
 * Live profile for the signed-in user. Fetches once, then subscribes to Realtime
 * UPDATEs on the user's `profiles` row so plan upgrades / quota changes reflect instantly.
 */
export function useProfile() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  // Unique per hook instance so multiple mounted screens don't collide on one channel.
  const [cid] = useState(() => Math.random().toString(36).slice(2));

  const refresh = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data as ProfileRow);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (MOCK_MODE) {
      setProfile(mockData.profile());
      setLoading(false);
      return;
    }
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    void refresh();

    const channel = supabase
      .channel(`profile:${userId}:${cid}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => setProfile(payload.new as ProfileRow),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  // Admins get unlimited, premium-level access regardless of plan.
  const isAdmin = isAdminEmail(session?.user.email);
  const isPremium = profile?.plan === 'premium' || isAdmin;
  const FREE_DAILY = 3;

  // Free → daily cap; premium → per-plan allowance (monthly 20 / quarterly 100).
  // Admins (and any premium with no explicit allowance) are unlimited.
  const planQuota = profile?.plan_quota ?? 0;
  const quotaTotal = isAdmin ? Infinity : isPremium ? (planQuota > 0 ? planQuota : Infinity) : FREE_DAILY;
  const quotaUsed = isPremium ? profile?.plan_used ?? 0 : profile?.quota_used ?? 0;
  const quotaRemaining = quotaTotal === Infinity ? Infinity : Math.max(0, quotaTotal - quotaUsed);

  return { profile, loading, isPremium, isAdmin, quotaRemaining, quotaTotal, quotaUsed, refresh };
}
