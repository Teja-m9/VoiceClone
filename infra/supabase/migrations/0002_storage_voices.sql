-- Storage bucket for voice reference clips, so the app can upload directly to Supabase
-- (no backend needed for recording). Files are namespaced by user id: voices/<uid>/<file>.

insert into storage.buckets (id, name, public)
values ('voices', 'voices', false)
on conflict (id) do nothing;

-- A user may upload into their own folder only.
create policy "voices_insert_own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'voices' and (storage.foldername(name))[1] = auth.uid()::text);

-- A user may read/update/delete their own files only.
create policy "voices_select_own"
  on storage.objects for select to authenticated
  using (bucket_id = 'voices' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "voices_update_own"
  on storage.objects for update to authenticated
  using (bucket_id = 'voices' and (storage.foldername(name))[1] = auth.uid()::text);
