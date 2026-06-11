/** A playable track surfaced in the UI (normalized from the JioSaavn API). */
export type Track = {
  id: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  durationMs: number;
  /** Highest-quality streamable/download URL, if available. */
  streamUrl: string | null;
  isPremium: boolean;
};

/** An album surfaced in search (normalized from the JioSaavn API). */
export type Album = {
  id: string;
  name: string;
  artist: string;
  coverUrl: string | null;
  year: string | null;
};
