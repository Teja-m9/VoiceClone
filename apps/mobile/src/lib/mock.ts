/**
 * Demo / mock backend. Active only when Supabase isn't configured (placeholder keys) —
 * see MOCK_MODE in env.ts. Lets the whole app run offline with seeded dummy data and a
 * working demo login, so you can explore the UI without a backend. Once real Supabase
 * keys are set, MOCK_MODE is false and none of this is used.
 */
import type {
  JobRow,
  NotificationRow,
  ProfileRow,
  SongRow,
  VoiceProfileRow,
} from '@/types/db';

// ---- Demo credentials (any password works in demo mode, these are just the hint) ----
export const DEMO_EMAIL = 'demo@realmvp.xyz';
export const DEMO_PASSWORD = 'demo1234';
const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';

/** A playable sample track for the demo "finished cover" (public, royalty-free). */
const SAMPLE_AUDIO_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

// ---- Minimal fake auth session ----
export type MockSession = {
  access_token: string;
  user: { id: string; email: string };
};

let session: MockSession | null = null;
const authListeners = new Set<(s: MockSession | null) => void>();

export const mockAuth = {
  getSession: (): MockSession | null => session,
  signIn: (email: string) => {
    session = { access_token: 'demo-token', user: { id: DEMO_USER_ID, email: email || DEMO_EMAIL } };
    authListeners.forEach((l) => l(session));
  },
  signOut: () => {
    session = null;
    authListeners.forEach((l) => l(session));
  },
  onChange: (cb: (s: MockSession | null) => void): (() => void) => {
    authListeners.add(cb);
    return () => authListeners.delete(cb);
  },
};

// ---- Seeded data ----
const now = '2026-06-08T00:00:00.000Z';

export const mockProfile: ProfileRow = {
  id: DEMO_USER_ID,
  display_name: 'Demo Artist',
  avatar_url: null,
  plan: 'free',
  quota_date: '2026-06-08',
  quota_used: 1,
  created_at: now,
  updated_at: now,
};

export const mockSongs: SongRow[] = [
  { id: 'song-1', title: 'Midnight Drive', artist: 'Royalty Free Co.', cover_url: null, duration_ms: 184000, is_premium: false, is_active: true, created_at: now },
  { id: 'song-2', title: 'Neon Heart', artist: 'CC-BY Studio', cover_url: null, duration_ms: 201000, is_premium: false, is_active: true, created_at: now },
  { id: 'song-3', title: 'Sunrise Anthem', artist: 'Open Music', cover_url: null, duration_ms: 176000, is_premium: true, is_active: true, created_at: now },
  { id: 'song-4', title: 'City Lights', artist: 'Lo-Fi Lab', cover_url: null, duration_ms: 158000, is_premium: false, is_active: true, created_at: now },
];

export const mockVoiceProfiles: VoiceProfileRow[] = [
  { id: 'voice-1', user_id: DEMO_USER_ID, name: 'My voice', status: 'ready', ref_audio_key: 'demo/voice-1.m4a', duration_ms: 42000, created_at: now },
];

let notifications: NotificationRow[] = [
  { id: 'notif-1', user_id: DEMO_USER_ID, type: 'system', title: 'Welcome to RealMVP 🎤', body: 'You are in demo mode. Add Supabase keys to go live.', job_id: null, read_at: null, created_at: now },
  { id: 'notif-2', user_id: DEMO_USER_ID, type: 'job_done', title: 'Your cover is ready', body: '"Neon Heart" in your voice is done.', job_id: null, read_at: now, created_at: now },
];

export const mockData = {
  songs: () => [...mockSongs],
  profile: () => ({ ...mockProfile }),
  voiceProfiles: () => [...mockVoiceProfiles],
  notifications: () => [...notifications],
  addVoiceProfile: (name: string): VoiceProfileRow => {
    const vp: VoiceProfileRow = {
      id: `voice-${mockVoiceProfiles.length + 1}`,
      user_id: DEMO_USER_ID,
      name,
      status: 'ready',
      ref_audio_key: `demo/${name}.m4a`,
      duration_ms: 40000,
      created_at: now,
    };
    mockVoiceProfiles.unshift(vp);
    return vp;
  },
  markNotifRead: (id: string) => {
    notifications = notifications.map((n) =>
      n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
    );
  },
};

// ---- Mock jobs with a simulated queued → processing → done lifecycle ----
const jobs = new Map<string, JobRow>();
const jobStreamUrls = new Map<string, string>();
const jobListeners = new Map<string, Set<(j: JobRow) => void>>();

function emit(id: string) {
  const job = jobs.get(id);
  if (!job) return;
  jobListeners.get(id)?.forEach((cb) => cb(job));
}

export const mockJobs = {
  create: (songId: string, voiceProfileId: string, streamUrl?: string | null): JobRow => {
    const id = `job-${jobs.size + 1}-${songId}`;
    if (streamUrl) jobStreamUrls.set(id, streamUrl);
    const job: JobRow = {
      id,
      user_id: DEMO_USER_ID,
      song_id: songId,
      voice_profile_id: voiceProfileId,
      status: 'queued',
      output_audio_key: null,
      output_reel_key: null,
      error_code: null,
      watermark: true,
      created_at: new Date().toISOString(),
      completed_at: null,
    };
    jobs.set(id, job);
    // Simulate the pipeline progressing.
    setTimeout(() => {
      const j = jobs.get(id);
      if (j) jobs.set(id, { ...j, status: 'processing' }), emit(id);
    }, 1500);
    setTimeout(() => {
      const j = jobs.get(id);
      if (j)
        jobs.set(id, {
          ...j,
          status: 'done',
          output_audio_key: 'demo/output.mp3',
          completed_at: new Date().toISOString(),
        }),
          emit(id);
    }, 5000);
    return job;
  },
  get: (id: string): JobRow | undefined => jobs.get(id),
  /** In demo mode the "cover" plays the picked track's stream (or a sample fallback). */
  outputAudioUrl: (id: string): string => jobStreamUrls.get(id) ?? SAMPLE_AUDIO_URL,
  subscribe: (id: string, cb: (j: JobRow) => void): (() => void) => {
    if (!jobListeners.has(id)) jobListeners.set(id, new Set());
    jobListeners.get(id)!.add(cb);
    const current = jobs.get(id);
    if (current) cb(current);
    return () => {
      jobListeners.get(id)?.delete(cb);
    };
  },
};
