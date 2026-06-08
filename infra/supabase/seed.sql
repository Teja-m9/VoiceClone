-- Optional seed for the songs catalog so the app shows tracks during development.
-- IMPORTANT: only insert tracks you actually have the rights to (public-domain /
-- royalty-free / licensed). license_source is required by schema. Replace the keys
-- with real R2 object keys once media is uploaded.

insert into public.songs (title, artist, cover_url, source_key, duration_ms, license_source, is_premium)
values
  ('Midnight Drive', 'Royalty Free Co.', null, 'catalog/midnight-drive.wav', 184000, 'public_domain', false),
  ('Neon Heart',     'CC-BY Studio',     null, 'catalog/neon-heart.wav',     201000, 'cc_by',         false),
  ('Sunrise Anthem', 'Open Music',       null, 'catalog/sunrise-anthem.wav', 176000, 'royalty_free',  true);
