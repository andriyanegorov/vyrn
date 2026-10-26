create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  reward_type text not null check (reward_type in ('stars', 'premium')),
  reward_value integer not null,
  browser_demo_only boolean not null default false,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by uuid references public.profiles(id) on delete set null,
  check (
    (reward_type = 'stars' and reward_value between 1 and 1000000)
    or (reward_type = 'premium' and reward_value between 1 and 12)
  ),
  check ((redeemed_at is null) = (redeemed_by is null))
);

alter table public.promo_codes
  add column if not exists browser_demo_only boolean not null default false;

create table if not exists public.promo_code_attempts (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists promo_code_attempts_profile_time_idx
  on public.promo_code_attempts(profile_id, attempted_at desc);

alter table public.promo_codes enable row level security;
alter table public.promo_code_attempts enable row level security;
revoke all on public.promo_codes, public.promo_code_attempts from public, anon, authenticated;

create or replace function public.redeem_promo_code(
  p_profile_id uuid,
  p_code text,
  p_browser_demo boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_code text := upper(btrim(coalesce(p_code, '')));
  promo public.promo_codes%rowtype;
  recent_attempts integer;
  wallet_id uuid;
  updated_balance bigint;
  activated_until timestamptz;
begin
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'Профиль не найден';
  end if;
  if normalized_code !~ '^VYRN-[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$' then
    return jsonb_build_object('success', false, 'error', 'Промокод имеет неверный формат.');
  end if;

  perform pg_advisory_xact_lock(hashtext('promo:' || p_profile_id::text));
  delete from public.promo_code_attempts
  where profile_id = p_profile_id and attempted_at < now() - interval '1 day';
  select count(*)::integer into recent_attempts
  from public.promo_code_attempts
  where profile_id = p_profile_id and attempted_at > now() - interval '15 minutes';
  if recent_attempts >= 10 then
    return jsonb_build_object('success', false, 'error', 'Слишком много попыток. Повторите через 15 минут.');
  end if;
  insert into public.promo_code_attempts(profile_id) values (p_profile_id);

  select * into promo
  from public.promo_codes
  where code_hash = encode(extensions.digest(normalized_code, 'sha256'), 'hex')
    and browser_demo_only = p_browser_demo
  for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Промокод не найден или уже использован.');
  end if;
  if promo.redeemed_at is not null then
    return jsonb_build_object('success', false, 'error', 'Промокод не найден или уже использован.');
  end if;

  if promo.reward_type = 'stars' then
    insert into public.wallets(profile_id, currency, balance)
    values (p_profile_id, 'stars', 0)
    on conflict (profile_id, currency) do nothing;
    select id into wallet_id
    from public.wallets
    where profile_id = p_profile_id and currency = 'stars'
    for update;
    update public.wallets
    set balance = balance + promo.reward_value
    where id = wallet_id
    returning balance into updated_balance;
    insert into public.wallet_transactions(wallet_id, amount, reason, reference_id)
    values (wallet_id, promo.reward_value, 'promo_code_reward', promo.id);
  else
    update public.profiles
    set premium_until = greatest(coalesce(premium_until, now()), now())
      + make_interval(months => promo.reward_value)
    where id = p_profile_id
    returning premium_until into activated_until;
  end if;

  update public.promo_codes
  set redeemed_at = now(), redeemed_by = p_profile_id
  where id = promo.id;

  return jsonb_build_object(
    'success', true,
    'reward_type', promo.reward_type,
    'reward_value', promo.reward_value,
    'balance', updated_balance,
    'premium_until', activated_until
  );
end;
$$;

revoke all on function public.redeem_promo_code(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.redeem_promo_code(uuid, text, boolean) to service_role;

notify pgrst, 'reload schema';
