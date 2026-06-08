import { useEffect, useState } from 'react';
import { jiosaavn } from '@/lib/jiosaavn';
import { mockSongs } from '@/lib/mock';
import type { Track } from '@/types/track';

/** Language tabs for quick browsing (ties into the regional-language product focus). */
export const LANGUAGES = ['Telugu', 'Hindi', 'Tamil', 'English', 'Punjabi'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Fallback tracks (used if the JioSaavn API is unreachable) — derived from seed songs. */
const FALLBACK: Track[] = mockSongs.map((s) => ({
  id: s.id,
  title: s.title,
  artist: s.artist ?? 'Unknown artist',
  coverUrl: s.cover_url,
  durationMs: s.duration_ms,
  streamUrl: null,
  isPremium: s.is_premium,
}));

/**
 * Searches JioSaavn for songs. If `query` is empty, browses the selected language's
 * popular tracks. Debounced; falls back to seed tracks if the API returns nothing.
 */
export function useSongSearch(query: string, language: Language) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const effectiveQuery = query.trim() || `${language} hits`;

    const handle = setTimeout(async () => {
      const results = await jiosaavn.searchSongs(effectiveQuery, 25);
      if (cancelled) return;
      if (results.length > 0) {
        setTracks(results);
        setUsedFallback(false);
      } else {
        setTracks(FALLBACK);
        setUsedFallback(true);
      }
      setLoading(false);
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, language]);

  return { tracks, loading, usedFallback };
}
