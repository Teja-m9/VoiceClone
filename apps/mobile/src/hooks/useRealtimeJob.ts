import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MOCK_MODE } from '@/lib/env';
import { mockJobs } from '@/lib/mock';
import type { JobRow } from '@/types/db';

/**
 * Subscribes to a single job's live status. Does an initial read to reconcile (so a
 * dropped socket never strands the user), then listens for Realtime UPDATEs.
 * See docs/LLD.md §5.
 */
export function useRealtimeJob(jobId: string | null) {
  const [job, setJob] = useState<JobRow | null>(null);

  useEffect(() => {
    if (!jobId) return;

    if (MOCK_MODE) {
      return mockJobs.subscribe(jobId, setJob);
    }

    void supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()
      .then(({ data }) => {
        if (data) setJob(data as JobRow);
      });

    const channel = supabase
      .channel(`job:${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` },
        (payload) => setJob(payload.new as JobRow),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [jobId]);

  const isTerminal = job?.status === 'done' || job?.status === 'failed';
  return { job, isTerminal };
}
