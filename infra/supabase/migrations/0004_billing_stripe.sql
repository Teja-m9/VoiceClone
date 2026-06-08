-- Switch billing to Stripe: add Stripe columns and relax the Razorpay columns so a
-- subscription row can be created from Stripe events. The existing sync_profile_plan
-- trigger (migration 0001) already flips profiles.plan when a row becomes 'active'.

alter table public.subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

alter table public.subscriptions alter column razorpay_sub_id drop not null;
alter table public.subscriptions alter column razorpay_plan_id drop not null;

create unique index if not exists subscriptions_stripe_sub_uidx
  on public.subscriptions (stripe_subscription_id);
