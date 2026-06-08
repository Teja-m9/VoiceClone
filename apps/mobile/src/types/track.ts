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
