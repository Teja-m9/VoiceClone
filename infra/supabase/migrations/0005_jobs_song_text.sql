-- Songs now come from JioSaavn (string ids like "BeXBcbVK"), not the local `songs` table.
-- Make jobs.song_id a plain text id and drop the FK to songs.

alter table public.jobs drop constraint if exists jobs_song_id_fkey;
alter table public.jobs alter column song_id type text using song_id::text;
