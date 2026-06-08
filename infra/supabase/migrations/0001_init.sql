-- RealMVP — initial schema, RLS, triggers, realtime.
-- Apply via the Supabase SQL editor or `supabase db push`. See docs/LLD.md §1.

-- ---------- Enums ----------
create type plan_t         as enum ('free', 'premium');
create type job_status_t   as enum ('queued', 'processing', 'done', 'failed');
create type job_kind_t     as enum ('clone_sing');
create type voice_status_t as enum ('pending', 'ready', 'failed');
create type sub_status_t   as enum ('created', 'active', 'halted', 'cancelled', 'expired');
create type notif_type_t   as enum ('job_done', 'job_failed', 'sub_activated', 'sub_expired', 'system');

-- ---------- profiles (mirrors auth.users) ----------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url   text,
  plan         plan_t not null default 'free',
  quota_date   date not null default (now() at time zone 'utc')::date,
  quota_used   smallint not null default 0 check (quota_used >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index profiles_plan_idx on public.profiles (plan);

-- ---------- voice_profiles ----------
create table public.voice_profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  status        voice_status_t not null default 'pending',
  ref_audio_key text not null,
  duration_ms   integer check (duration_ms > 0),
  embedding_key text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index voice_profiles_user_idx on public.voice_profiles (user_id, created_at desc);

-- ---------- songs (catalog) ----------
create table public.songs (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  artist           text,
  cover_url        text,
  source_key       text not null,
  vocals_key       text,
  instrumental_key text,
  duration_ms      integer not null check (duration_ms > 0),
  license_source   text not null,                 -- legal guardrail: NOT NULL
  is_premium       boolean not null default false,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);
create index songs_active_idx on public.songs (is_active, created_at desc);

-- ---------- jobs ----------
create table public.jobs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  song_id          uuid not null references public.songs(id),
  voice_profile_id uuid not null references public.voice_profiles(id),
  kind             job_kind_t not null default 'clone_sing',
  status           job_status_t not null default 'queued',
  idempotency_key  text not null,
  runpod_job_id    text,
  attempts         smallint not null default 0 check (attempts >= 0),
  watermark        boolean not null default true,
  output_audio_key text,
  output_reel_key  text,
  error_code       text,
  error_detail     text,
  quota_consumed   boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  completed_at     timestamptz
);
create unique index jobs_idempotency_uidx on public.jobs (user_id, idempotency_key);
create index jobs_user_status_idx on public.jobs (user_id, status, created_at desc);
create index jobs_runpod_idx on public.jobs (runpod_job_id);

-- ---------- subscriptions ----------
create table public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  razorpay_sub_id    text not null unique,
  razorpay_plan_id   text not null,
  status             sub_status_t not null default 'created',
  current_period_end timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions (user_id, status);

-- ---------- notifications ----------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       notif_type_t not null,
  title      text not null,
  body       text not null default '',
  job_id     uuid references public.jobs(id) on delete set null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc) where read_at is null;

-- ---------- create profile row on signup ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- keep profiles.plan in sync with active subscription ----------
create or replace function public.sync_profile_plan() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles p
     set plan = case when exists (
                   select 1 from public.subscriptions s
                    where s.user_id = new.user_id and s.status = 'active'
                      and (s.current_period_end is null or s.current_period_end > now())
                 ) then 'premium'::plan_t else 'free'::plan_t end,
         updated_at = now()
   where p.id = new.user_id;
  return new;
end $$;

create trigger trg_sync_plan
  after insert or update on public.subscriptions
  for each row execute function public.sync_profile_plan();

-- ---------- atomic free-tier quota (race-safe) ----------
create or replace function public.reserve_quota(p_user uuid, p_limit int)
returns table(allowed boolean, remaining int)
language plpgsql security definer set search_path = public as $$
declare
  v_plan plan_t;
  v_today date := (now() at time zone 'utc')::date;
  v_used smallint;
begin
  select plan into v_plan from public.profiles where id = p_user for update;
  if v_plan = 'premium' then
    return query select true, -1; return;
  end if;

  update public.profiles
     set quota_date = case when quota_date <> v_today then v_today else quota_date end,
         quota_used = case when quota_date <> v_today then 0 else quota_used end
   where id = p_user;

  select quota_used into v_used from public.profiles where id = p_user for update;

  if v_used < p_limit then
    update public.profiles set quota_used = quota_used + 1, updated_at = now() where id = p_user;
    return query select true, (p_limit - v_used - 1);
  else
    return query select false, 0;
  end if;
end $$;

create or replace function public.release_quota(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set quota_used = greatest(quota_used - 1, 0), updated_at = now()
   where id = p_user and quota_date = (now() at time zone 'utc')::date;
end $$;

-- ---------- Row-Level Security ----------
alter table public.profiles       enable row level security;
alter table public.voice_profiles enable row level security;
alter table public.songs          enable row level security;
alter table public.jobs           enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.notifications  enable row level security;

create policy profiles_self_select on public.profiles for select using (auth.uid() = id);
create policy profiles_self_update on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy vp_owner_all on public.voice_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy songs_read_auth on public.songs for select to authenticated using (is_active = true);

create policy jobs_owner_select on public.jobs for select using (auth.uid() = user_id);

create policy subs_owner_select on public.subscriptions for select using (auth.uid() = user_id);

create policy notif_owner_select on public.notifications for select using (auth.uid() = user_id);
create policy notif_owner_update on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Realtime ----------
alter publication supabase_realtime add table public.jobs, public.notifications, public.profiles, public.voice_profiles;
