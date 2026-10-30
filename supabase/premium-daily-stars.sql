create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.premium_daily_star_rewards (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reward_date date not null,
  amount bigint not null default 50 check (amount = 50),
  created_at timestamptz not null default now(),
  unique (profile_id, reward_date)
);

alter table public.premium_daily_star_rewards enable row level security;
revoke all on public.premium_daily_star_rewards from public, anon, authenticated;
grant select, insert on public.premium_daily_star_rewards to service_role;

create unique index if not exists wallet_transactions_premium_daily_reward_reference_unique
  on public.wallet_transactions(reference_id)
  where reason = 'premium_daily_reward';

create or replace function public.grant_premium_daily_stars()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  reward_time timestamptz := clock_timestamp();
  reward_day date := (reward_time at time zone 'Europe/Moscow')::date;
  premium_profile record;
  wallet_id uuid;
  reward_id uuid;
  rewards_granted bigint := 0;
begin
  for premium_profile in
    select profiles.id
    from public.profiles as profiles
    where profiles.premium_until > reward_time
    order by profiles.id
  loop
    insert into public.wallets (profile_id, currency, balance)
    values (premium_profile.id, 'stars', 0)
    on conflict (profile_id, currency) do nothing;

    select wallets.id into wallet_id
    from public.wallets as wallets
    where wallets.profile_id = premium_profile.id
      and wallets.currency = 'stars'
    for update;

    reward_id := null;
    insert into public.premium_daily_star_rewards (profile_id, reward_date)
    values (premium_profile.id, reward_day)
    on conflict (profile_id, reward_date) do nothing
    returning id into reward_id;

    if reward_id is null then
      continue;
    end if;

    update public.wallets
    set balance = balance + 50,
        updated_at = reward_time
    where id = wallet_id;

    insert into public.wallet_transactions (wallet_id, amount, reason, reference_id)
    values (wallet_id, 50, 'premium_daily_reward', reward_id);

    rewards_granted := rewards_granted + 1;
  end loop;

  return rewards_granted;
end;
$$;

revoke all on function public.grant_premium_daily_stars() from public, anon, authenticated;
grant execute on function public.grant_premium_daily_stars() to service_role;

select cron.schedule(
  'vyrn-premium-daily-stars',
  '0 21 * * *',
  'select public.grant_premium_daily_stars();'
);
