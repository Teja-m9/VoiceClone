import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { jiosaavn } from '@/lib/jiosaavn';
import { useAuth } from '@/providers/AuthProvider';
import type { Track } from '@/types/track';

export interface MySong {
  jobId: string;
  songId: string;
  createdAt: string;
  track: Track | null; // resolved JioSaavn metadata (title/artist/cover)
}

/**
 * The signed-in user's generated covers (jobs with status=done), newest first, with the
 * original song's metadata resolved from JioSaavn for display. Live — a newly finished
 * cover appears automatically.
 */
export function useMySongs() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [items, setItems] = useState<MySong[]>([]);
  const [loading, setLoading] = useState(true);
  const [cid] = useState(() => Math.random().toString(36).slice(2));

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from('jobs')
        .select('id,song_id,created_at')
        .eq('user_id', userId)
        .eq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(30);
      const rows = (data ?? []) as { id: string; song_id: string; created_at: string }[];

      // Resolve each unique song's metadata once.
      const uniqueIds = [...new Set(rows.map((r) => r.song_id))];
      const entries = await Promise.all(
        uniqueIds.map(async (id) => [id, await jiosaavn.getSongById(id)] as const),
      );
      const metaMap = new Map(entries);
      if (!active) return;
      setItems(
        rows.map((r) => ({
          jobId: r.id,
          songId: r.song_id,
          createdAt: r.created_at,
          track: metaMap.get(r.song_id) ?? null,
        })),
      );
      setLoading(false);
    };

    void load();

    const channel = supabase
      .channel(`mysongs:${cid}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `user_id=eq.${userId}` },
        () => void load(),
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [userId, cid]);

  // Delete a cover the user doesn't want to keep.
  const remove = async (jobId: string) => {
    setItems((prev) => prev.filter((i) => i.jobId !== jobId)); // optimistic
    await supabase.from('jobs').delete().eq('id', jobId);
  };

  return { items, loading, remove };
}
