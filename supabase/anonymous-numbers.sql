create table if not exists public.anonymous_numbers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  digits text not null unique check (digits ~ '^[0-9]{8}$'),
  upgrades integer not null default 0 check (upgrades >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists anonymous_numbers_profile_created_idx
  on public.anonymous_numbers(profile_id, created_at desc);

alter table public.anonymous_numbers enable row level security;
revoke all on public.anonymous_numbers from public, anon, authenticated;

update public.profiles as profiles
set phone = null
where profiles.phone is not null
  and not exists (
    select 1
    from public.anonymous_numbers as numbers
    where numbers.profile_id = profiles.id
      and profiles.phone = '+888' || numbers.digits
  );

create or replace function public.spin_anonymous_number(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  stars_wallet public.wallets%rowtype;
  new_number public.anonymous_numbers%rowtype;
  candidate text;
  attempt integer;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_profile_id and telegram_id >= 0
  ) then
    raise exception 'Anonymous number profile not found';
  end if;

  select * into stars_wallet
  from public.wallets
  where profile_id = p_profile_id and currency = 'stars'
  for update;
  if not found then
    raise exception 'Stars wallet not found';
  end if;
  if stars_wallet.balance < 25 then
    raise exception 'Not enough Stars';
  end if;

  for attempt in 1..50 loop
    candidate := lpad(floor(random() * 100000000)::bigint::text, 8, '0');
    insert into public.anonymous_numbers(profile_id, digits)
    values (p_profile_id, candidate)
    on conflict (digits) do nothing
    returning * into new_number;
    if new_number.id is not null then
      update public.wallets
      set balance = balance - 25, updated_at = now()
      where id = stars_wallet.id
      returning balance into stars_wallet.balance;
      insert into public.wallet_transactions(wallet_id, amount, reason, reference_id)
      values (stars_wallet.id, -25, 'anonymous_number_spin', new_number.id);
      return jsonb_build_object(
        'id', new_number.id,
        'number', new_number.digits,
        'upgrades', new_number.upgrades,
        'created_at', new_number.created_at,
        'balance', stars_wallet.balance
      );
    end if;
  end loop;

  raise exception 'Could not generate an available anonymous number';
end;
$$;

create or replace function public.upgrade_anonymous_number(
  p_profile_id uuid,
  p_number_id uuid,
  p_digit_index integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned_number public.anonymous_numbers%rowtype;
  stars_wallet public.wallets%rowtype;
  candidate_digits text;
  previous_digits text;
  changed_digit integer;
  attempt integer;
begin
  if p_digit_index is null or p_digit_index < 0 or p_digit_index > 7 then
    raise exception 'Invalid digit index';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_profile_id and telegram_id >= 0
  ) then
    raise exception 'Anonymous number profile not found';
  end if;

  select * into owned_number
  from public.anonymous_numbers
  where id = p_number_id and profile_id = p_profile_id
  for update;
  if not found then
    raise exception 'Anonymous number not found';
  end if;

  select * into stars_wallet
  from public.wallets
  where profile_id = p_profile_id and currency = 'stars'
  for update;
  if not found then
    raise exception 'Stars wallet not found';
  end if;
  if stars_wallet.balance < 25 then
    raise exception 'Not enough Stars';
  end if;

  changed_digit := (
    substring(owned_number.digits from p_digit_index + 1 for 1)::integer
    + 1 + floor(random() * 9)::integer
  ) % 10;
  previous_digits := owned_number.digits;
  candidate_digits := overlay(
    owned_number.digits placing changed_digit::text
    from p_digit_index + 1 for 1
  );

  for attempt in 1..50 loop
    begin
      update public.anonymous_numbers
      set digits = candidate_digits,
          upgrades = upgrades + 1,
          updated_at = now()
      where id = owned_number.id
      returning * into owned_number;
      exit;
    exception when unique_violation then
      if attempt = 50 then raise; end if;
      changed_digit := (changed_digit + 1) % 10;
      if changed_digit = substring(owned_number.digits from p_digit_index + 1 for 1)::integer then
        changed_digit := (changed_digit + 1) % 10;
      end if;
      candidate_digits := overlay(
        owned_number.digits placing changed_digit::text
        from p_digit_index + 1 for 1
      );
    end;
  end loop;

  update public.profiles
  set phone = '+888' || owned_number.digits
  where id = p_profile_id and phone = '+888' || previous_digits;

  update public.wallets
  set balance = balance - 25, updated_at = now()
  where id = stars_wallet.id
  returning balance into stars_wallet.balance;
  insert into public.wallet_transactions(wallet_id, amount, reason, reference_id)
  values (stars_wallet.id, -25, 'anonymous_number_upgrade', owned_number.id);

  return jsonb_build_object(
    'id', owned_number.id,
    'number', owned_number.digits,
    'upgrades', owned_number.upgrades,
    'created_at', owned_number.created_at,
    'balance', stars_wallet.balance
  );
end;
$$;

revoke all on function public.spin_anonymous_number(uuid) from public, anon, authenticated;
grant execute on function public.spin_anonymous_number(uuid) to service_role;
revoke all on function public.upgrade_anonymous_number(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.upgrade_anonymous_number(uuid, uuid, integer) to service_role;

notify pgrst, 'reload schema';
