/**
 * Typed DB rows mirroring the Supabase schema (see docs/LLD.md §1).
 *
 * NOTE: these are `type` aliases, not `interface`s, on purpose — postgrest-js requires
 * each table's Row/Insert/Update to be assignable to `Record<string, unknown>`, and TS
 * only treats object *type aliases* (not interfaces) as having an implicit index
 * signature. Using `interface` here makes the typed client silently fall back and
 * mutation args resolve to `never`.
 */

export type Plan = 'free' | 'premium';
export type JobStatus = 'queued' | 'processing' | 'done' | 'failed';
export type VoiceStatus = 'pending' | 'ready' | 'failed';
export type SubStatus = 'created' | 'active' | 'halted' | 'cancelled' | 'expired';
export type NotifType =
  | 'job_done'
  | 'job_failed'
  | 'sub_activated'
  | 'sub_expired'
  | 'system';

export type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  plan: Plan;
  quota_date: string;
  quota_used: number;
  created_at: string;
  updated_at: string;
};

export type VoiceProfileRow = {
  id: string;
  user_id: string;
  name: string;
  status: VoiceStatus;
  ref_audio_key: string;
  duration_ms: number | null;
  created_at: string;
};

export type SongRow = {
  id: string;
  title: string;
  artist: string | null;
  cover_url: string | null;
  duration_ms: number;
  is_premium: boolean;
  is_active: boolean;
  created_at: string;
};

export type JobRow = {
  id: string;
  user_id: string;
  song_id: string;
  voice_profile_id: string;
  status: JobStatus;
  output_audio_key: string | null;
  output_reel_key: string | null;
  error_code: string | null;
  watermark: boolean;
  created_at: string;
  completed_at: string | null;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotifType;
  title: string;
  body: string;
  job_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type PublishedCoverRow = {
  id: string;
  user_id: string | null;
  author_name: string;
  song_title: string;
  artist: string | null;
  cover_url: string | null;
  audio_url: string | null;
  voice_name: string | null;
  plays: number;
  created_at: string;
};

/** Each table exposes Row (select) + Insert/Update (mutations) for the typed client. */
type Table<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] };

/**
 * Database typing for the Supabase generic client. Matches the shape supabase-js expects
 * (Tables/Views/Functions/Enums/CompositeTypes) so mutation args resolve correctly
 * instead of falling back to `never`.
 */
export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      voice_profiles: Table<VoiceProfileRow>;
      songs: Table<SongRow>;
      jobs: Table<JobRow>;
      notifications: Table<NotificationRow>;
      published_covers: Table<PublishedCoverRow>;
    };
    Views: Record<string, never>;
    Functions: {
      reserve_quota: {
        Args: { p_user: string; p_limit: number };
        Returns: { allowed: boolean; remaining: number }[];
      };
      release_quota: {
        Args: { p_user: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
