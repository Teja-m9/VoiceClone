import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MOCK_MODE } from '@/lib/env';
import { mockData } from '@/lib/mock';
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
      .channel(`profile:${userId}`)
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

  const isPremium = profile?.plan === 'premium';
  const FREE_DAILY = 3;
  const quotaRemaining = isPremium
    ? Infinity
    : Math.max(0, FREE_DAILY - (profile?.quota_used ?? 0));

  return { profile, loading, isPremium, quotaRemaining, refresh };
}
