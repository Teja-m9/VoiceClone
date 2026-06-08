import { env, MOCK_MODE } from './env';
import { supabase } from './supabase';
import { mockData, mockJobs } from './mock';

/** Error thrown for non-2xx API responses, carrying the server error envelope code. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ErrorEnvelope = { error?: { code?: string; message?: string; details?: unknown } };

/**
 * Thin fetch wrapper for the FastAPI orchestrator. Attaches the current Supabase JWT,
 * parses the standard error envelope, and surfaces typed ApiError.
 * Data *reads* go through Supabase directly (RLS); this is only for server-authoritative
 * mutations: presign, voice-profiles, jobs.
 */
async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const env_ = (json ?? {}) as ErrorEnvelope;
    throw new ApiError(
      res.status,
      env_.error?.code ?? 'UNKNOWN',
      env_.error?.message ?? `Request failed (${res.status})`,
      env_.error?.details,
    );
  }
  return json as T;
}

// ---- Endpoint helpers (contracts mirror docs/LLD.md §2) ----

export interface PresignResponse {
  object_key: string;
  upload_url: string;
  expires_in: number;
  max_bytes: number;
}

export interface VoiceProfileOut {
  id: string;
  name: string;
  status: string;
  ref_audio_key: string;
  duration_ms: number | null;
  created_at: string;
}

export interface JobOut {
  id: string;
  status: string;
  song_id: string;
  voice_profile_id: string;
  output_audio_url: string | null;
  output_reel_url: string | null;
  error_code: string | null;
  created_at: string;
  completed_at: string | null;
}

export const api = {
  presignUpload: (purpose: 'voice_ref' | 'avatar', contentType: string, byteSize: number) =>
    request<PresignResponse>('/uploads/presign', {
      method: 'POST',
      body: { purpose, content_type: contentType, byte_size: byteSize },
    }),

  createVoiceProfile: async (name: string, refAudioKey: string, durationMs?: number) => {
    if (MOCK_MODE) {
      const vp = mockData.addVoiceProfile(name);
      return {
        id: vp.id,
        name: vp.name,
        status: vp.status,
        ref_audio_key: vp.ref_audio_key,
        duration_ms: vp.duration_ms,
        created_at: vp.created_at,
      } satisfies VoiceProfileOut;
    }
    return request<VoiceProfileOut>('/voice-profiles', {
      method: 'POST',
      body: { name, ref_audio_key: refAudioKey, duration_ms: durationMs },
    });
  },

  createJob: async (
    songId: string,
    voiceProfileId: string,
    idempotencyKey: string,
    streamUrl?: string | null,
  ) => {
    if (MOCK_MODE) {
      const job = mockJobs.create(songId, voiceProfileId, streamUrl);
      return {
        id: job.id,
        status: job.status,
        song_id: job.song_id,
        voice_profile_id: job.voice_profile_id,
        output_audio_url: null,
        output_reel_url: null,
        error_code: null,
        created_at: job.created_at,
        completed_at: null,
      } satisfies JobOut;
    }
    return request<JobOut>('/jobs', {
      method: 'POST',
      body: {
        song_id: songId,
        voice_profile_id: voiceProfileId,
        idempotency_key: idempotencyKey,
      },
    });
  },

  getJob: async (jobId: string) => {
    if (MOCK_MODE) {
      const job = mockJobs.get(jobId);
      return {
        id: jobId,
        status: job?.status ?? 'done',
        song_id: job?.song_id ?? '',
        voice_profile_id: job?.voice_profile_id ?? '',
        output_audio_url: mockJobs.outputAudioUrl(jobId),
        output_reel_url: null,
        error_code: null,
        created_at: job?.created_at ?? new Date().toISOString(),
        completed_at: job?.completed_at ?? null,
      } satisfies JobOut;
    }
    return request<JobOut>(`/jobs/${jobId}`);
  },
};
