alter table public.profiles
  add column if not exists premium_until timestamptz;

alter table public.nft_transfers
  drop constraint if exists nft_transfers_transfer_type_check;

alter table public.nft_transfers
  add constraint nft_transfers_transfer_type_check
  check (transfer_type in ('mint', 'market', 'gift', 'admin', 'craft', 'auto_sale'));

create table if not exists public.nft_auto_sales (
  id uuid primary key default gen_random_uuid(),
  nft_item_id uuid not null,
  seller_profile_id uuid not null references public.profiles(id),
  gross_price bigint not null check (gross_price > 0),
  commission_percent integer not null check (commission_percent in (10, 30)),
  commission_amount bigint not null check (commission_amount >= 0),
  net_amount bigint not null check (net_amount > 0),
  created_at timestamptz not null default now(),
  check (gross_price = commission_amount + net_amount)
);
alter table public.nft_auto_sales enable row level security;
revoke all on public.nft_auto_sales from anon, authenticated;

create or replace function public.auto_sell_nft(
  p_nft_item_id uuid,
  p_seller_profile_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  nft_item public.nft_items%rowtype;
  seller public.profiles%rowtype;
  wallet_id uuid;
  price_text text;
  gross_price bigint;
  commission_percent integer;
  commission_amount bigint;
  net_amount bigint;
  sale_id uuid;
begin
  select * into nft_item
  from public.nft_items
  where id = p_nft_item_id
  for update;
  if not found or nft_item.owner_profile_id is distinct from p_seller_profile_id then
    raise exception 'NFT not found or no longer owned by this player';
  end if;

  if coalesce(nft_item.attributes->>'fragment_traits_updated_at', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' then
    raise exception 'Обновите оценку NFT Fragment перед автопродажей';
  end if;
  if (nft_item.attributes->>'fragment_traits_updated_at')::timestamptz < now() - interval '5 minutes' then
    raise exception 'Обновите оценку NFT Fragment перед автопродажей';
  end if;

  select * into seller
  from public.profiles
  where id = p_seller_profile_id
  for share;
  if not found then
    raise exception 'Seller profile not found';
  end if;

  if nft_item.attributes ? 'fragment_price_fragment_stars' then
    price_text := nft_item.attributes->>'fragment_price_fragment_stars';
  elsif nft_item.attributes->>'fragment_price_manual' = 'true'
    or nft_item.attributes->>'fragment_price_crafted_total' = 'true' then
    raise exception 'Обновите оценку NFT Fragment перед автопродажей';
  else
    price_text := nft_item.attributes->>'fragment_price_stars';
  end if;
  if price_text is null or price_text !~ '^[0-9]{1,18}$' then
    raise exception 'Для NFT пока нет действующей оценки Fragment в Stars';
  end if;
  gross_price := price_text::bigint;
  if gross_price <= 0 then
    raise exception 'Для NFT пока нет действующей оценки Fragment в Stars';
  end if;

  commission_percent := case
    when seller.premium_until > now()
      or (seller.premium_until is null and lower(coalesce(seller.status, '')) = 'premium')
    then 10
    else 30
  end;
  commission_amount := floor(gross_price::numeric * commission_percent / 100)::bigint;
  net_amount := gross_price - commission_amount;
  if net_amount <= 0 then
    raise exception 'Оценка NFT слишком мала для автопродажи';
  end if;

  if exists (
    select 1 from public.nft_gift_offers
    where nft_item_id = p_nft_item_id and status = 'pending' and resolved_at is null
  ) then
    raise exception 'Сначала разрешите активное предложение подарка';
  end if;

  select id into wallet_id
  from public.wallets
  where profile_id = p_seller_profile_id and currency = 'stars'
  for update;
  if not found then
    raise exception 'Stars-кошелёк игрока не найден';
  end if;

  insert into public.nft_auto_sales (
    nft_item_id, seller_profile_id, gross_price, commission_percent, commission_amount, net_amount
  )
  values (
    p_nft_item_id, p_seller_profile_id, gross_price, commission_percent, commission_amount, net_amount
  )
  returning id into sale_id;

  update public.market_listings
  set status = 'cancelled', closed_at = now()
  where nft_item_id = p_nft_item_id and status = 'active';

  update public.nft_items
  set owner_profile_id = null
  where id = p_nft_item_id and owner_profile_id = p_seller_profile_id;
  if not found then
    raise exception 'NFT ownership changed before auto-sale';
  end if;

  update public.wallets set balance = balance + net_amount where id = wallet_id;
  insert into public.wallet_transactions (wallet_id, amount, reason, reference_id)
  values (wallet_id, net_amount, 'nft_auto_sale', sale_id);
  insert into public.nft_transfers (nft_item_id, from_profile_id, to_profile_id, transfer_type)
  values (p_nft_item_id, p_seller_profile_id, null, 'auto_sale');

  return jsonb_build_object(
    'id', sale_id,
    'gross_price', gross_price,
    'commission_percent', commission_percent,
    'commission_amount', commission_amount,
    'net_amount', net_amount
  );
end;
$$;

revoke all on function public.auto_sell_nft(uuid, uuid) from public, anon, authenticated;
grant execute on function public.auto_sell_nft(uuid, uuid) to service_role;
