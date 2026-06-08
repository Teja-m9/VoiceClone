import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import type { PublishedCoverRow } from '@/types/db';

export interface PublishInput {
  songTitle: string;
  artist: string | null;
  coverUrl: string | null;
  audioUrl: string | null;
  voiceName: string | null;
}

/**
 * Live public registry of shared covers. Loads recent items, then subscribes to Realtime
 * INSERTs so a freshly published cover appears for everyone instantly. Also exposes a
 * `publish()` that writes the signed-in user's cover to the registry.
 */
export function usePublishedCovers() {
  const { session } = useAuth();
  const [items, setItems] = useState<PublishedCoverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cid] = useState(() => Math.random().toString(36).slice(2));

  useEffect(() => {
    let active = true;
    supabase
      .from('published_covers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (!active) return;
        setItems((data ?? []) as PublishedCoverRow[]);
        setLoading(false);
      });

    const channel = supabase
      .channel(`pubcov:${cid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'published_covers' },
        (payload) => setItems((prev) => [payload.new as PublishedCoverRow, ...prev]),
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [cid]);

  const publish = async (input: PublishInput): Promise<void> => {
    if (!session) throw new Error('Sign in to publish');
    const authorName = (session.user.user_metadata?.display_name as string) || 'Artist';
    const { error } = await supabase.from('published_covers').insert({
      user_id: session.user.id,
      author_name: authorName,
      song_title: input.songTitle,
      artist: input.artist,
      cover_url: input.coverUrl,
      audio_url: input.audioUrl,
      voice_name: input.voiceName,
    });
    if (error) throw error;
  };

  return { items, loading, publish };
}
