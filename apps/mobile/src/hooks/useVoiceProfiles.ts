import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MOCK_MODE } from '@/lib/env';
import { mockData } from '@/lib/mock';
import { useAuth } from '@/providers/AuthProvider';
import type { VoiceProfileRow } from '@/types/db';

/**
 * The signed-in user's cloned-voice profiles. Live: subscribes to INSERT/UPDATE so a
 * newly recorded voice flips from `pending` → `ready` in place.
 */
export function useVoiceProfiles() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [profiles, setProfiles] = useState<VoiceProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cid] = useState(() => Math.random().toString(36).slice(2));

  const refresh = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('voice_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setProfiles((data ?? []) as VoiceProfileRow[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (MOCK_MODE) {
      setProfiles(mockData.voiceProfiles());
      setLoading(false);
      return;
    }
    if (!userId) {
      setProfiles([]);
      setLoading(false);
      return;
    }
    void refresh();

    const channel = supabase
      .channel(`vp:${userId}:${cid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'voice_profiles', filter: `user_id=eq.${userId}` },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  // Delete a voice (and, via the DB cascade, the covers made with it).
  const remove = useCallback(async (id: string) => {
    setProfiles((prev) => prev.filter((p) => p.id !== id)); // optimistic
    await supabase.from('voice_profiles').delete().eq('id', id);
  }, []);

  const readyProfiles = profiles.filter((p) => p.status === 'ready');
  return { profiles, readyProfiles, loading, refresh, remove };
}
