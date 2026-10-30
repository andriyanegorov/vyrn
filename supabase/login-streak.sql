create table if not exists public.daily_login_streaks (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  streak_count integer not null default 0 check (streak_count >= 0),
  last_visit_at timestamptz,
  last_reward_date date,
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_login_rewards (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reward_date date not null,
  amount bigint not null default 10 check (amount = 10),
  created_at timestamptz not null default now(),
  unique (profile_id, reward_date)
);

alter table public.daily_login_streaks enable row level security;
alter table public.daily_login_rewards enable row level security;
revoke all on public.daily_login_streaks, public.daily_login_rewards from public, anon, authenticated;
grant select, insert, update on public.daily_login_streaks to service_role;
grant select, insert on public.daily_login_rewards to service_role;

create unique index if not exists wallet_transactions_daily_login_reference_unique
  on public.wallet_transactions(reference_id)
  where reason = 'daily_login_reward';

create or replace function public.record_daily_login(
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  visit_time timestamptz := clock_timestamp();
  visit_date date := (visit_time at time zone 'Europe/Moscow')::date;
  streak public.daily_login_streaks%rowtype;
  wallet_id uuid;
  reward_id uuid;
  current_balance bigint;
  next_streak integer;
  rewarded_now boolean;
begin
  if p_profile_id is null or not exists (
    select 1 from public.profiles where id = p_profile_id
  ) then
    raise exception 'Player profile not found';
  end if;

  insert into public.daily_login_streaks (profile_id)
  values (p_profile_id)
  on conflict (profile_id) do nothing;

  select * into streak
  from public.daily_login_streaks
  where profile_id = p_profile_id
  for update;

  if streak.last_visit_at is null
    or streak.last_visit_at <= visit_time - interval '24 hours' then
    next_streak := 1;
  elsif streak.last_reward_date is distinct from visit_date then
    next_streak := streak.streak_count + 1;
  else
    next_streak := streak.streak_count;
  end if;

  insert into public.daily_login_rewards (profile_id, reward_date)
  values (p_profile_id, visit_date)
  on conflict (profile_id, reward_date) do nothing
  returning id into reward_id;

  rewarded_now := reward_id is not null;

  if rewarded_now then
    insert into public.wallets (profile_id, currency, balance)
    values (p_profile_id, 'stars', 0)
    on conflict (profile_id, currency) do nothing;

    select id into wallet_id
    from public.wallets
    where profile_id = p_profile_id and currency = 'stars'
    for update;
    if not found then
      raise exception 'Stars wallet not found';
    end if;

    update public.wallets
    set balance = balance + 10,
        updated_at = visit_time
    where id = wallet_id
    returning balance into current_balance;

    insert into public.wallet_transactions (wallet_id, amount, reason, reference_id)
    values (wallet_id, 10, 'daily_login_reward', reward_id);

    update public.daily_login_streaks
    set streak_count = next_streak,
        last_visit_at = visit_time,
        last_reward_date = visit_date,
        updated_at = visit_time
    where profile_id = p_profile_id;
  else
    select balance into current_balance
    from public.wallets
    where profile_id = p_profile_id and currency = 'stars';
    if not found then
      raise exception 'Stars wallet not found';
    end if;

    update public.daily_login_streaks
    set streak_count = next_streak,
        last_visit_at = visit_time,
        updated_at = visit_time
    where profile_id = p_profile_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'streak_count', next_streak,
    'rewarded_today', true,
    'rewarded_now', rewarded_now,
    'balance', current_balance
  );
end;
$$;

revoke all on function public.record_daily_login(uuid) from public, anon, authenticated;
grant execute on function public.record_daily_login(uuid) to service_role;

notify pgrst, 'reload schema';
