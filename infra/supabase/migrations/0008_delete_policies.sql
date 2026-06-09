-- 0008 — let users delete their own covers and voices.
-- Covers (jobs) only had a SELECT policy, so client deletes were denied by RLS. Voices
-- already allow owner deletes (vp_owner_all FOR ALL), but the jobs→voice_profiles FK was
-- RESTRICT, so a voice with covers couldn't be deleted — make it cascade.

create policy jobs_owner_delete on public.jobs
  for delete using (auth.uid() = user_id);

-- Deleting a voice now also removes the covers made with it.
alter table public.jobs drop constraint if exists jobs_voice_profile_id_fkey;
alter table public.jobs
  add constraint jobs_voice_profile_id_fkey
  foreign key (voice_profile_id) references public.voice_profiles(id) on delete cascade;
