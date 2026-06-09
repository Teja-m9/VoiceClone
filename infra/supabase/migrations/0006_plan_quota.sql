-- 0006 — plan-based song quota.
-- Premium is no longer "unlimited": each plan grants a fixed allowance per billing period
-- (monthly = 20 songs, quarterly = 100 songs). Free stays at a daily allowance.
-- The allowance (plan_quota) is set by the API on checkout; plan_used counts the period's
-- consumption and is reset to 0 on purchase and on each renewal.

alter table public.profiles
  add column if not exists plan_quota int not null default 0,                 -- 0 = none / unlimited fallback
  add column if not exists plan_used  int not null default 0 check (plan_used >= 0);

-- reserve_quota now also enforces the premium per-period allowance and returns whether the
-- caller is premium, so the API can set watermark/preview without a second lookup.
-- (Return signature changed → must DROP before CREATE.)
drop function if exists public.reserve_quota(uuid, int);
create or replace function public.reserve_quota(p_user uuid, p_limit int)
returns table(allowed boolean, remaining int, premium boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_plan   plan_t;
  v_today  date := (now() at time zone 'utc')::date;
  v_used   smallint;
  v_pquota int;
  v_pused  int;
begin
  select plan, plan_quota, plan_used
    into v_plan, v_pquota, v_pused
    from public.profiles where id = p_user for update;

  if v_plan = 'premium' then
    if v_pquota <= 0 then
      return query select true, -1, true;   -- no allowance configured → unlimited (safety)
      return;
    end if;
    if v_pused < v_pquota then
      update public.profiles set plan_used = plan_used + 1, updated_at = now() where id = p_user;
      return query select true, (v_pquota - v_pused - 1), true;
      return;
    end if;
    return query select false, 0, true;
    return;
  end if;

  -- free tier: daily reset + cap at p_limit
  update public.profiles
     set quota_date = case when quota_date <> v_today then v_today else quota_date end,
         quota_used = case when quota_date <> v_today then 0 else quota_used end
   where id = p_user;

  select quota_used into v_used from public.profiles where id = p_user for update;

  if v_used < p_limit then
    update public.profiles set quota_used = quota_used + 1, updated_at = now() where id = p_user;
    return query select true, (p_limit - v_used - 1), false;
  else
    return query select false, 0, false;
  end if;
end $$;

-- release refunds the correct counter for the user's plan (failures don't cost a credit).
create or replace function public.release_quota(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_plan plan_t;
begin
  select plan into v_plan from public.profiles where id = p_user for update;
  if v_plan = 'premium' then
    update public.profiles
       set plan_used = greatest(plan_used - 1, 0), updated_at = now()
     where id = p_user;
  else
    update public.profiles
       set quota_used = greatest(quota_used - 1, 0), updated_at = now()
     where id = p_user and quota_date = (now() at time zone 'utc')::date;
  end if;
end $$;
