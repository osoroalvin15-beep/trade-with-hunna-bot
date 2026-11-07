-- EA Traders paid plans: tables and functions.
-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- It does not touch any other tables in your project.

create table if not exists public.plan_requests (
  id uuid primary key default gen_random_uuid(),
  loginid text not null check (loginid ~ '^[A-Za-z]{2,6}[0-9]{3,12}$'),
  plan text not null check (plan in ('starter', 'professional', 'advanced')),
  phone text not null,
  mpesa_code text not null unique check (mpesa_code ~ '^[A-Z0-9]{8,12}$'),
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  loginid text primary key,
  plan text not null check (plan in ('starter', 'professional', 'advanced')),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- Nobody can read or write these tables directly from the website. Only the functions below can.
alter table public.plan_requests enable row level security;
alter table public.subscriptions enable row level security;
revoke all on public.plan_requests from anon, authenticated;
revoke all on public.subscriptions from anon, authenticated;

-- Which plan applies to a person? The app sends all of their Deriv account IDs (real and demo)
-- and gets back the best active plan.
create or replace function public.get_plan(lids text[]) returns json
language sql stable security definer set search_path = public as $$
  with best as (
    select plan, expires_at from subscriptions
    where loginid = any (lids[1:20]) and expires_at > now()
    order by case plan when 'advanced' then 3 when 'professional' then 2 else 1 end desc, expires_at desc
    limit 1
  )
  select json_build_object(
    'plan', coalesce((select plan from best), 'free'),
    'expires_at', (select expires_at from best),
    'pending', exists (select 1 from plan_requests where loginid = any (lids[1:20]) and status = 'pending')
  )
$$;

-- A customer sends their payment details here after paying by M-Pesa.
create or replace function public.request_plan(lid text, plan_id text, phone text, code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  rid uuid;
  c text := upper(trim(coalesce(code, '')));
begin
  if plan_id not in ('starter', 'professional', 'advanced') then raise exception 'Please choose a plan.'; end if;
  if trim(coalesce(lid, '')) !~ '^[A-Za-z]{2,6}[0-9]{3,12}$' then raise exception 'We could not read your Deriv account ID. Log in again and retry.'; end if;
  if c !~ '^[A-Z0-9]{8,12}$' then raise exception 'Enter the confirmation code from your M-Pesa message.'; end if;
  if trim(coalesce(phone, '')) !~ '^[0-9+ ]{9,15}$' then raise exception 'Enter the phone number you paid from.'; end if;
  insert into plan_requests (loginid, plan, phone, mpesa_code) values (trim(lid), plan_id, trim(phone), c) returning id into rid;
  return rid;
exception when unique_violation then
  raise exception 'That M-Pesa code was already submitted.';
end $$;

-- YOU run these two in the SQL Editor after checking the payment in your M-Pesa statement.
-- Approve (adds 30 days, or extends an active plan):   select public.activate_plan('REQUEST-ID-HERE');
-- Reject:                                              select public.reject_plan('REQUEST-ID-HERE');
create or replace function public.activate_plan(rid uuid, days int default 30) returns void
language plpgsql security definer set search_path = public as $$
declare r plan_requests;
begin
  select * into r from plan_requests where id = rid and status = 'pending';
  if not found then raise exception 'No pending request with that ID.'; end if;
  insert into subscriptions (loginid, plan, expires_at) values (r.loginid, r.plan, now() + make_interval(days => days))
  on conflict (loginid) do update
    set plan = excluded.plan,
        expires_at = greatest(subscriptions.expires_at, now()) + make_interval(days => days),
        updated_at = now();
  update plan_requests set status = 'active' where id = rid;
end $$;

create or replace function public.reject_plan(rid uuid) returns void
language sql security definer set search_path = public as $$
  update plan_requests set status = 'rejected' where id = rid and status = 'pending'
$$;

-- The website may only check a plan and send a request. Approving is for you alone.
revoke all on function public.get_plan(text[]), public.request_plan(text, text, text, text),
  public.activate_plan(uuid, int), public.reject_plan(uuid) from public, anon, authenticated;
grant execute on function public.get_plan(text[]), public.request_plan(text, text, text, text) to anon, authenticated;
