-- Public registry of shared AI covers. Anyone signed in can browse; a user can publish
-- their own. Realtime so the Shared feed updates live as people publish.

create table public.published_covers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade,  -- null for seed rows
  author_name text not null default 'RealMVP',
  song_title  text not null,
  artist      text,
  cover_url   text,
  audio_url   text,
  voice_name  text,
  plays       integer not null default 0,
  created_at  timestamptz not null default now()
);
create index published_covers_recent_idx on public.published_covers (created_at desc);

alter table public.published_covers enable row level security;

-- Anyone authenticated can read the public registry.
create policy pubcov_read_auth on public.published_covers
  for select to authenticated using (true);

-- A user can publish only as themselves.
create policy pubcov_insert_own on public.published_covers
  for insert to authenticated with check (auth.uid() = user_id);

-- Live feed.
alter publication supabase_realtime add table public.published_covers;

-- Seed a few dummy shared covers so the feed isn't empty (audio = royalty-free samples).
insert into public.published_covers (author_name, song_title, artist, voice_name, audio_url, plays)
values
  ('Aarav',  'Kesariya',        'Arijit Singh',   'Aarav''s voice',  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', 1280),
  ('Meghana','Naatu Naatu',     'Rahul Sipligunj', 'Meghana''s voice','https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', 942),
  ('Karthik','Tum Hi Ho',       'Arijit Singh',    'Karthik''s voice','https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', 651),
  ('Divya',  'Vaathi Coming',   'Anirudh',         'Divya''s voice',  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', 410),
  ('Rohan',  'Apna Bana Le',    'Arijit Singh',    'Rohan''s voice',  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', 233);
