alter table public.profiles
  add column if not exists premium_until timestamptz;

create table if not exists public.telegram_premium_orders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  telegram_user_id bigint not null,
  duration_months integer not null check (duration_months in (1, 12, 24)),
  telegram_stars_amount bigint not null default 1 check (telegram_stars_amount = 1),
  invoice_payload text not null unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  telegram_payment_charge_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  premium_until timestamptz
);

create index if not exists telegram_premium_orders_pending_created_idx
  on public.telegram_premium_orders(created_at)
  where status = 'pending';

alter table public.telegram_premium_orders enable row level security;
revoke all on public.telegram_premium_orders from public, anon, authenticated;
grant select, insert, update on public.telegram_premium_orders to service_role;

create or replace function public.validate_telegram_premium_order(
  p_invoice_payload text,
  p_telegram_user_id bigint,
  p_telegram_stars_amount bigint,
  p_currency text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.telegram_premium_orders as premium_order
    where premium_order.invoice_payload = p_invoice_payload
      and premium_order.telegram_user_id = p_telegram_user_id
      and premium_order.telegram_stars_amount = p_telegram_stars_amount
      and p_currency = 'XTR'
      and premium_order.status = 'pending'
      and premium_order.created_at > now() - interval '24 hours'
  );
$$;

create or replace function public.complete_telegram_premium_order(
  p_invoice_payload text,
  p_telegram_user_id bigint,
  p_telegram_stars_amount bigint,
  p_currency text,
  p_telegram_payment_charge_id text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  premium_order public.telegram_premium_orders%rowtype;
  activated_until timestamptz;
begin
  if p_currency is distinct from 'XTR'
    or p_telegram_payment_charge_id is null
    or p_telegram_payment_charge_id = '' then
    raise exception 'Invalid Telegram Premium payment details';
  end if;

  select * into premium_order
  from public.telegram_premium_orders
  where invoice_payload = p_invoice_payload
  for update;

  if not found then
    raise exception 'Premium order not found';
  end if;

  if premium_order.status = 'paid' then
    if premium_order.telegram_payment_charge_id = p_telegram_payment_charge_id
      and premium_order.telegram_user_id = p_telegram_user_id
      and premium_order.telegram_stars_amount = p_telegram_stars_amount then
      return premium_order.premium_until;
    end if;
    raise exception 'Premium order was already paid with different payment details';
  end if;

  if premium_order.status <> 'pending'
    or premium_order.telegram_user_id <> p_telegram_user_id
    or premium_order.telegram_stars_amount <> p_telegram_stars_amount
    or p_telegram_stars_amount <> 1 then
    raise exception 'Telegram Premium payment does not match the pending order';
  end if;

  update public.profiles
  set premium_until = greatest(coalesce(premium_until, now()), now())
    + make_interval(months => premium_order.duration_months)
  where id = premium_order.profile_id
  returning premium_until into activated_until;

  if not found then
    raise exception 'Premium profile not found';
  end if;

  update public.telegram_premium_orders
  set status = 'paid',
      telegram_payment_charge_id = p_telegram_payment_charge_id,
      premium_until = activated_until,
      paid_at = now()
  where id = premium_order.id;

  return activated_until;
end;
$$;

revoke all on function public.validate_telegram_premium_order(text, bigint, bigint, text) from public, anon, authenticated;
grant execute on function public.validate_telegram_premium_order(text, bigint, bigint, text) to service_role;
revoke all on function public.complete_telegram_premium_order(text, bigint, bigint, text, text) from public, anon, authenticated;
grant execute on function public.complete_telegram_premium_order(text, bigint, bigint, text, text) to service_role;
