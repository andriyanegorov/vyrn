alter table public.profiles
  add column if not exists referred_by uuid references public.profiles(id) on delete set null;

create table if not exists public.referral_codes (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique check (code ~ '^[a-f0-9]{24}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.referral_attributions (
  id uuid primary key default gen_random_uuid(),
  inviter_profile_id uuid not null references public.profiles(id) on delete cascade,
  invited_profile_id uuid not null unique references public.profiles(id) on delete cascade,
  referral_code text not null,
  inviter_reward integer not null default 10 check (inviter_reward = 10),
  invited_reward integer not null default 5 check (invited_reward = 5),
  created_at timestamptz not null default now(),
  check (inviter_profile_id <> invited_profile_id)
);

create index if not exists referral_attributions_inviter_created_idx
  on public.referral_attributions(inviter_profile_id, created_at desc);

alter table public.referral_codes enable row level security;
alter table public.referral_attributions enable row level security;
revoke all on public.referral_codes, public.referral_attributions from public, anon, authenticated;

create or replace function public.get_or_create_referral_info(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  referral_code text;
  invite_count integer;
  earned_stars bigint;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_profile_id and telegram_id > 0
  ) then
    raise exception 'Referral links are available only to Telegram players';
  end if;

  for attempt in 1..5 loop
    begin
      insert into public.referral_codes(profile_id, code)
      values (p_profile_id, encode(extensions.gen_random_bytes(12), 'hex'))
      on conflict (profile_id) do nothing;
      exit;
    exception when unique_violation then
      if attempt = 5 then raise; end if;
    end;
  end loop;

  select code into referral_code
  from public.referral_codes
  where profile_id = p_profile_id;

  select count(*)::integer, coalesce(sum(inviter_reward), 0)::bigint
  into invite_count, earned_stars
  from public.referral_attributions
  where inviter_profile_id = p_profile_id;

  return jsonb_build_object(
    'code', referral_code,
    'invite_count', invite_count,
    'earned_stars', earned_stars
  );
end;
$$;

create or replace function public.complete_profile_referral(p_invited_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  invited_profile public.profiles%rowtype;
  inviter_profile public.profiles%rowtype;
  attribution_id uuid;
  inviter_wallet_id uuid;
  invited_wallet_id uuid;
begin
  select * into invited_profile
  from public.profiles
  where id = p_invited_profile_id
  for update;
  if not found or invited_profile.telegram_id <= 0 or invited_profile.referred_by is null then
    return jsonb_build_object('completed', false);
  end if;

  if invited_profile.referred_by = invited_profile.id then
    return jsonb_build_object('completed', false);
  end if;

  select * into inviter_profile
  from public.profiles
  where id = invited_profile.referred_by and telegram_id > 0;
  if not found then
    return jsonb_build_object('completed', false);
  end if;

  insert into public.referral_attributions(
    inviter_profile_id, invited_profile_id, referral_code
  )
  select inviter_profile.id, invited_profile.id, codes.code
  from public.referral_codes as codes
  where codes.profile_id = inviter_profile.id
  on conflict (invited_profile_id) do nothing
  returning id into attribution_id;
  if attribution_id is null then
    return jsonb_build_object('completed', true, 'already_completed', true);
  end if;

  insert into public.wallets(profile_id, currency, balance)
  values
    (inviter_profile.id, 'stars', 0),
    (invited_profile.id, 'stars', 0)
  on conflict (profile_id, currency) do nothing;

  perform 1 from public.wallets
  where profile_id in (inviter_profile.id, invited_profile.id)
    and currency = 'stars'
  order by profile_id
  for update;

  update public.wallets
  set balance = balance + 10
  where profile_id = inviter_profile.id and currency = 'stars'
  returning id into inviter_wallet_id;
  update public.wallets
  set balance = balance + 5
  where profile_id = invited_profile.id and currency = 'stars'
  returning id into invited_wallet_id;

  insert into public.wallet_transactions(wallet_id, amount, reason, reference_id)
  values
    (inviter_wallet_id, 10, 'referral_reward', attribution_id),
    (invited_wallet_id, 5, 'referral_reward', attribution_id);

  return jsonb_build_object('completed', true, 'already_completed', false);
end;
$$;

revoke all on function public.get_or_create_referral_info(uuid) from public, anon, authenticated;
grant execute on function public.get_or_create_referral_info(uuid) to service_role;
revoke all on function public.complete_profile_referral(uuid) from public, anon, authenticated;
grant execute on function public.complete_profile_referral(uuid) to service_role;

notify pgrst, 'reload schema';
