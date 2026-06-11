import { env } from './env';
import type { Track, Album } from '@/types/track';

/**
 * JioSaavn API client. Uses the public JioSaavn API (configurable base via
 * EXPO_PUBLIC_SAAVN_API_URL). Normalizes the raw response into our `Track` shape and
 * fails soft (returns []) so the UI can fall back gracefully if the API is unreachable.
 *
 * Legal note: JioSaavn tracks are copyrighted — fine for a prototype/demo, but production
 * use requires licensing (see docs/HLD.md §8 legal guardrails).
 */

interface SaavnImage {
  quality?: string;
  url?: string;
  link?: string;
}
interface SaavnSong {
  id: string;
  name?: string;
  title?: string;
  duration?: number | string;
  image?: SaavnImage[] | string;
  downloadUrl?: SaavnImage[];
  url?: string;
  artists?: { primary?: { name: string }[]; all?: { name: string }[] };
  primaryArtists?: string;
  album?: { name?: string };
}
interface SaavnAlbum {
  id: string;
  name?: string;
  title?: string;
  image?: SaavnImage[] | string;
  artists?: { primary?: { name: string }[]; all?: { name: string }[] };
  primaryArtists?: string;
  year?: string | number;
  songs?: SaavnSong[];
}

function toAlbum(a: SaavnAlbum): Album {
  const cover = Array.isArray(a.image) ? pickBest(a.image) : (a.image ?? null);
  let artist = 'Various artists';
  if (a.artists?.primary?.length) artist = a.artists.primary.map((x) => x.name).join(', ');
  else if (a.primaryArtists) artist = a.primaryArtists;
  return {
    id: a.id,
    name: decodeEntities(a.name ?? a.title ?? 'Album'),
    artist: decodeEntities(artist),
    coverUrl: cover,
    year: a.year ? String(a.year) : null,
  };
}

/** JioSaavn returns titles with HTML entities (&amp;, &quot;, &#039;) — decode them. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .trim();
}

/** Pick the highest-quality URL from a JioSaavn image/downloadUrl array. */
function pickBest(arr?: SaavnImage[]): string | null {
  if (!arr || arr.length === 0) return null;
  const last = arr[arr.length - 1];
  return last?.url ?? last?.link ?? null;
}

function artistName(s: SaavnSong): string {
  if (s.artists?.primary?.length) return s.artists.primary.map((a) => a.name).join(', ');
  if (s.artists?.all?.length) return s.artists.all.map((a) => a.name).join(', ');
  if (s.primaryArtists) return s.primaryArtists;
  return s.album?.name ?? 'Unknown artist';
}

function toTrack(s: SaavnSong): Track {
  const cover = Array.isArray(s.image) ? pickBest(s.image) : (s.image ?? null);
  const durationSec = typeof s.duration === 'string' ? parseInt(s.duration, 10) : (s.duration ?? 0);
  return {
    id: s.id,
    title: decodeEntities(s.name ?? s.title ?? 'Untitled'),
    artist: decodeEntities(artistName(s)),
    coverUrl: cover,
    durationMs: (Number.isFinite(durationSec) ? durationSec : 0) * 1000,
    streamUrl: pickBest(s.downloadUrl),
    isPremium: false,
  };
}

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(`${env.saavnApiUrl}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Saavn ${res.status}`);
  return res.json();
}

export const jiosaavn = {
  /** Search songs by free-text query (paginated). Returns [] on any failure. */
  searchSongs: async (query: string, limit = 20, page = 0): Promise<Track[]> => {
    if (!query.trim()) return [];
    try {
      const json = (await getJson(
        `/api/search/songs?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
      )) as { data?: { results?: SaavnSong[] } };
      return (json.data?.results ?? []).map(toTrack);
    } catch {
      return [];
    }
  },

  /** Search albums by free-text query. Returns [] on any failure. */
  searchAlbums: async (query: string, limit = 20): Promise<Album[]> => {
    if (!query.trim()) return [];
    try {
      const json = (await getJson(
        `/api/search/albums?query=${encodeURIComponent(query)}&page=0&limit=${limit}`,
      )) as { data?: { results?: SaavnAlbum[] } };
      return (json.data?.results ?? []).map(toAlbum);
    } catch {
      return [];
    }
  },

  /** Fetch the tracks of an album. Returns [] on any failure. */
  getAlbumSongs: async (albumId: string): Promise<Track[]> => {
    try {
      const json = (await getJson(`/api/albums?id=${encodeURIComponent(albumId)}`)) as {
        data?: { songs?: SaavnSong[] };
      };
      return (json.data?.songs ?? []).map(toTrack);
    } catch {
      return [];
    }
  },

  /** Fetch a single song's details (used to resolve a fresh stream URL). */
  getSongById: async (id: string): Promise<Track | null> => {
    try {
      const json = (await getJson(`/api/songs/${encodeURIComponent(id)}`)) as {
        data?: SaavnSong[];
      };
      const song = json.data?.[0];
      return song ? toTrack(song) : null;
    } catch {
      return null;
    }
  },
};
