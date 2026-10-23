create table if not exists public.telegram_star_topups (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  telegram_user_id bigint not null,
  vyrn_stars_amount bigint not null check (vyrn_stars_amount between 1 and 100000),
  telegram_stars_amount bigint not null check (telegram_stars_amount = vyrn_stars_amount),
  invoice_payload text not null unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  telegram_payment_charge_id text unique,
  wallet_transaction_id uuid references public.wallet_transactions(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists telegram_star_topups_pending_created_idx
  on public.telegram_star_topups(created_at)
  where status = 'pending';

alter table public.telegram_star_topups enable row level security;
revoke all on public.telegram_star_topups from public, anon, authenticated;
grant select, insert, update on public.telegram_star_topups to service_role;

create unique index if not exists wallet_transactions_telegram_topup_reference_unique
  on public.wallet_transactions(reference_id)
  where reason = 'telegram_stars_topup';

create or replace function public.validate_telegram_star_topup(
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
    from public.telegram_star_topups as topup
    where topup.invoice_payload = p_invoice_payload
      and topup.telegram_user_id = p_telegram_user_id
      and topup.telegram_stars_amount = p_telegram_stars_amount
      and p_currency = 'XTR'
      and topup.status = 'pending'
      and topup.created_at > now() - interval '24 hours'
  );
$$;

create or replace function public.complete_telegram_star_topup(
  p_invoice_payload text,
  p_telegram_user_id bigint,
  p_telegram_stars_amount bigint,
  p_currency text,
  p_telegram_payment_charge_id text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  topup public.telegram_star_topups%rowtype;
  wallet_id uuid;
  transaction_id uuid;
begin
  if p_currency <> 'XTR' or p_telegram_payment_charge_id is null or p_telegram_payment_charge_id = '' then
    raise exception 'Invalid Telegram Stars payment details';
  end if;

  select * into topup
  from public.telegram_star_topups
  where invoice_payload = p_invoice_payload
  for update;

  if not found then
    raise exception 'Top-up order not found';
  end if;

  if topup.status = 'paid' then
    if topup.telegram_payment_charge_id = p_telegram_payment_charge_id
      and topup.telegram_user_id = p_telegram_user_id
      and topup.telegram_stars_amount = p_telegram_stars_amount then
      return topup.wallet_transaction_id;
    end if;
    raise exception 'Top-up order was already paid with different payment details';
  end if;

  if topup.status <> 'pending'
    or topup.telegram_user_id <> p_telegram_user_id
    or topup.telegram_stars_amount <> p_telegram_stars_amount
    or topup.vyrn_stars_amount <> p_telegram_stars_amount then
    raise exception 'Telegram Stars payment does not match the pending order';
  end if;

  select id into wallet_id
  from public.wallets
  where profile_id = topup.profile_id and currency = 'stars'
  for update;

  if not found then
    raise exception 'Stars wallet not found';
  end if;

  update public.wallets
  set balance = balance + topup.vyrn_stars_amount
  where id = wallet_id;

  insert into public.wallet_transactions (wallet_id, amount, reason, reference_id)
  values (wallet_id, topup.vyrn_stars_amount, 'telegram_stars_topup', topup.id)
  returning id into transaction_id;

  update public.telegram_star_topups
  set status = 'paid',
      telegram_payment_charge_id = p_telegram_payment_charge_id,
      wallet_transaction_id = transaction_id,
      paid_at = now()
  where id = topup.id;

  return transaction_id;
end;
$$;

revoke all on function public.validate_telegram_star_topup(text, bigint, bigint, text) from public, anon, authenticated;
grant execute on function public.validate_telegram_star_topup(text, bigint, bigint, text) to service_role;
revoke all on function public.complete_telegram_star_topup(text, bigint, bigint, text, text) from public, anon, authenticated;
grant execute on function public.complete_telegram_star_topup(text, bigint, bigint, text, text) to service_role;
