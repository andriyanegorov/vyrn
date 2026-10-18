create extension if not exists pgcrypto;

do $$
begin
  create type public.listing_status as enum ('active', 'sold', 'cancelled');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.message_kind as enum ('text', 'system');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique,
  nickname text not null unique,
  username text unique,
  telegram_username text,
  telegram_first_name text not null default '',
  telegram_last_name text not null default '',
  first_name text not null default '',
  last_name text not null default '',
  avatar_url text,
  bio text not null default '' check (char_length(bio) <= 160),
  birthday date,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_telegram_username_unique on public.profiles(telegram_username) where telegram_username is not null;

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  currency text not null check (currency in ('stars', 'ton')),
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now(),
  unique (profile_id, currency)
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id),
  amount bigint not null check (amount <> 0),
  reason text not null,
  reference_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.nft_collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.nft_models (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.nft_collections(id),
  slug text not null,
  name text not null,
  preview_url text,
  animation_url text,
  unique (collection_id, slug)
);

create table if not exists public.nft_items (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.nft_models(id),
  external_id text,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  attributes jsonb not null default '{}'::jsonb,
  acquired_at timestamptz not null default now(),
  unique (model_id, external_id)
);

create table if not exists public.nft_transfers (
  id uuid primary key default gen_random_uuid(),
  nft_item_id uuid not null references public.nft_items(id),
  from_profile_id uuid references public.profiles(id),
  to_profile_id uuid references public.profiles(id),
  transfer_type text not null check (transfer_type in ('mint', 'market', 'gift', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  nft_item_id uuid not null references public.nft_items(id),
  seller_profile_id uuid not null references public.profiles(id),
  price bigint not null check (price > 0),
  currency text not null check (currency in ('stars', 'ton')),
  status public.listing_status not null default 'active',
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create unique index if not exists market_one_active_listing_per_nft
  on public.market_listings(nft_item_id) where status = 'active';
create index if not exists market_active_created_idx on public.market_listings(created_at desc) where status = 'active';

create table if not exists public.market_transactions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.market_listings(id),
  nft_item_id uuid not null references public.nft_items(id),
  buyer_profile_id uuid not null references public.profiles(id),
  seller_profile_id uuid not null references public.profiles(id),
  price bigint not null check (price > 0),
  currency text not null check (currency in ('stars', 'ton')),
  created_at timestamptz not null default now(),
  check (buyer_profile_id <> seller_profile_id)
);

create or replace function public.create_market_listing(
  p_nft_item_id uuid,
  p_seller_profile_id uuid,
  p_price bigint,
  p_currency text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_owner_id uuid;
  listing_id uuid;
begin
  if p_price <= 0 or p_currency not in ('stars', 'ton') then
    raise exception 'Invalid listing price or currency';
  end if;

  select owner_profile_id into current_owner_id
  from public.nft_items
  where id = p_nft_item_id
  for update;
  if not found or current_owner_id <> p_seller_profile_id then
    raise exception 'Seller no longer owns this NFT';
  end if;
  if exists (
    select 1 from public.market_listings
    where nft_item_id = p_nft_item_id and status = 'active'
  ) then
    raise exception 'NFT already has an active listing';
  end if;

  insert into public.market_listings (nft_item_id, seller_profile_id, price, currency)
  values (p_nft_item_id, p_seller_profile_id, p_price, p_currency)
  returning id into listing_id;
  return listing_id;
end;
$$;

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  chat_type text not null default 'direct' check (chat_type in ('direct', 'group', 'channel', 'saved')),
  title text,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (chat_id, profile_id)
);
create index if not exists chat_members_profile_joined_idx on public.chat_members(profile_id, joined_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 4096),
  kind public.message_kind not null default 'text',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists messages_chat_created_idx on public.messages(chat_id, created_at desc);

create table if not exists public.nft_gift_offers (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  nft_item_id uuid not null references public.nft_items(id),
  sender_profile_id uuid not null references public.profiles(id),
  recipient_profile_id uuid not null references public.profiles(id),
  price_stars bigint not null check (price_stars >= 0),
  status text not null default 'pending' check (status in ('pending', 'completed', 'declined')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  resolved_at timestamptz,
  check (sender_profile_id <> recipient_profile_id)
);
alter table public.nft_gift_offers add column if not exists resolved_at timestamptz;
create index if not exists nft_gift_offers_chat_created_idx on public.nft_gift_offers(chat_id, created_at desc);
drop index if exists public.nft_gift_one_pending_offer_per_item;
create unique index nft_gift_one_pending_offer_per_item
  on public.nft_gift_offers(nft_item_id) where status = 'pending' and resolved_at is null;

create table if not exists public.nft_gift_responses (
  id uuid primary key default gen_random_uuid(),
  original_offer_id uuid not null unique references public.nft_gift_offers(id) on delete cascade,
  result_offer_id uuid not null unique references public.nft_gift_offers(id),
  recipient_profile_id uuid not null references public.profiles(id),
  status text not null check (status in ('completed', 'declined')),
  created_at timestamptz not null default now()
);

alter table public.messages add column if not exists gift_offer_id uuid references public.nft_gift_offers(id);

create table if not exists public.saved_messages (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (profile_id, message_id)
);

create or replace function public.ensure_saved_chat(p_profile_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  saved_chat_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_profile_id::text, 0));
  select c.id into saved_chat_id
  from public.chats c
  join public.chat_members cm on cm.chat_id = c.id
  where c.chat_type = 'saved' and cm.profile_id = p_profile_id
  limit 1;

  if saved_chat_id is null then
    insert into public.chats (chat_type, title) values ('saved', 'Избранное') returning id into saved_chat_id;
    insert into public.chat_members (chat_id, profile_id) values (saved_chat_id, p_profile_id);
  end if;
  return saved_chat_id;
end;
$$;

create or replace function public.get_or_create_direct_chat(p_first_profile_id uuid, p_second_profile_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  direct_chat_id uuid;
  first_id uuid := least(p_first_profile_id, p_second_profile_id);
  second_id uuid := greatest(p_first_profile_id, p_second_profile_id);
begin
  if first_id = second_id then
    raise exception 'Cannot create a chat with yourself';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(first_id::text || second_id::text, 0));

  select c.id into direct_chat_id
  from public.chats c
  where c.chat_type = 'direct'
    and exists (select 1 from public.chat_members cm where cm.chat_id = c.id and cm.profile_id = first_id)
    and exists (select 1 from public.chat_members cm where cm.chat_id = c.id and cm.profile_id = second_id)
    and (select count(*) from public.chat_members cm where cm.chat_id = c.id) = 2
  limit 1;

  if direct_chat_id is null then
    insert into public.chats (chat_type) values ('direct') returning id into direct_chat_id;
    insert into public.chat_members (chat_id, profile_id)
    values (direct_chat_id, first_id), (direct_chat_id, second_id);
  end if;
  return direct_chat_id;
end;
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists wallets_set_updated_at on public.wallets;
create trigger wallets_set_updated_at before update on public.wallets
for each row execute function public.set_updated_at();

create or replace function public.purchase_market_listing(p_listing_id uuid, p_buyer_profile_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  listing public.market_listings%rowtype;
  buyer_wallet_id uuid;
  seller_wallet_id uuid;
  transaction_id uuid;
begin
  select * into listing
  from public.market_listings
  where id = p_listing_id and status = 'active'
  for update;

  if not found then
    raise exception 'Listing is unavailable';
  end if;
  if listing.seller_profile_id = p_buyer_profile_id then
    raise exception 'Cannot buy your own listing';
  end if;

  select id into buyer_wallet_id from public.wallets
  where profile_id = p_buyer_profile_id and currency = listing.currency
  for update;
  if not found then
    raise exception 'Buyer wallet not found';
  end if;

  select id into seller_wallet_id from public.wallets
  where profile_id = listing.seller_profile_id and currency = listing.currency
  for update;
  if not found then
    raise exception 'Seller wallet not found';
  end if;

  update public.wallets set balance = balance - listing.price
  where id = buyer_wallet_id and balance >= listing.price;
  if not found then
    raise exception 'Insufficient balance';
  end if;
  update public.wallets set balance = balance + listing.price where id = seller_wallet_id;

  update public.market_listings
  set status = 'sold', closed_at = now()
  where id = listing.id;
  update public.nft_items
  set owner_profile_id = p_buyer_profile_id
  where id = listing.nft_item_id and owner_profile_id = listing.seller_profile_id;
  if not found then
    raise exception 'Seller no longer owns this NFT';
  end if;

  insert into public.market_transactions
    (listing_id, nft_item_id, buyer_profile_id, seller_profile_id, price, currency)
  values
    (listing.id, listing.nft_item_id, p_buyer_profile_id, listing.seller_profile_id, listing.price, listing.currency)
  returning id into transaction_id;

  insert into public.wallet_transactions (wallet_id, amount, reason, reference_id)
  values
    (buyer_wallet_id, -listing.price, 'market_purchase', transaction_id),
    (seller_wallet_id, listing.price, 'market_sale', transaction_id);

  insert into public.nft_transfers (nft_item_id, from_profile_id, to_profile_id, transfer_type)
  values (listing.nft_item_id, listing.seller_profile_id, p_buyer_profile_id, 'market');

  return transaction_id;
end;
$$;

create or replace function public.send_chat_nft_gift(
  p_chat_id uuid,
  p_nft_item_id uuid,
  p_sender_profile_id uuid,
  p_price_stars bigint
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  recipient_profile_id uuid;
  item_owner_id uuid;
  gift_id uuid;
  message_id uuid;
begin
  if p_price_stars < 0 then raise exception 'Gift price cannot be negative'; end if;

  if not exists (
    select 1 from public.chats c
    where c.id = p_chat_id and c.chat_type = 'direct'
      and exists (select 1 from public.chat_members m where m.chat_id = c.id and m.profile_id = p_sender_profile_id)
  ) then raise exception 'Direct chat not found'; end if;

  select m.profile_id into recipient_profile_id
  from public.chat_members m
  where m.chat_id = p_chat_id and m.profile_id <> p_sender_profile_id;
  if recipient_profile_id is null then raise exception 'Chat recipient not found'; end if;

  select owner_profile_id into item_owner_id
  from public.nft_items where id = p_nft_item_id for update;
  if not found or item_owner_id <> p_sender_profile_id then raise exception 'You no longer own this NFT'; end if;
  if exists (select 1 from public.market_listings where nft_item_id = p_nft_item_id and status = 'active') then
    raise exception 'Cancel the active market listing before gifting this NFT';
  end if;

  insert into public.nft_gift_offers (chat_id, nft_item_id, sender_profile_id, recipient_profile_id, price_stars, status, completed_at)
  values (p_chat_id, p_nft_item_id, p_sender_profile_id, recipient_profile_id, p_price_stars,
    case when p_price_stars = 0 then 'completed' else 'pending' end,
    case when p_price_stars = 0 then now() else null end)
  returning id into gift_id;

  if p_price_stars = 0 then
    update public.nft_items set owner_profile_id = recipient_profile_id where id = p_nft_item_id;
    insert into public.nft_transfers (nft_item_id, from_profile_id, to_profile_id, transfer_type)
    values (p_nft_item_id, p_sender_profile_id, recipient_profile_id, 'gift');
  end if;

  insert into public.messages (chat_id, sender_profile_id, body, kind, gift_offer_id)
  values (p_chat_id, p_sender_profile_id, 'NFT-подарок', 'system', gift_id)
  returning id into message_id;
  return message_id;
end;
$$;

create or replace function public.accept_chat_nft_gift(p_gift_id uuid, p_recipient_profile_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  gift public.nft_gift_offers%rowtype;
  buyer_wallet_id uuid;
  seller_wallet_id uuid;
  result_offer_id uuid;
  message_id uuid;
begin
  select * into gift from public.nft_gift_offers where id = p_gift_id for update;
  if not found or gift.recipient_profile_id <> p_recipient_profile_id then raise exception 'Gift offer not found'; end if;
  if gift.status <> 'pending' or gift.resolved_at is not null or gift.price_stars <= 0 then raise exception 'Gift offer is no longer available'; end if;
  if not exists (select 1 from public.chat_members where chat_id = gift.chat_id and profile_id = p_recipient_profile_id) then
    raise exception 'Chat membership required';
  end if;

  perform 1 from public.nft_items where id = gift.nft_item_id and owner_profile_id = gift.sender_profile_id for update;
  if not found then raise exception 'Sender no longer owns this NFT'; end if;
  if exists (select 1 from public.market_listings where nft_item_id = gift.nft_item_id and status = 'active') then
    raise exception 'NFT is listed on the market';
  end if;

  select id into buyer_wallet_id from public.wallets
  where profile_id = p_recipient_profile_id and currency = 'stars' for update;
  if not found then raise exception 'Buyer wallet not found'; end if;
  select id into seller_wallet_id from public.wallets
  where profile_id = gift.sender_profile_id and currency = 'stars' for update;
  if not found then raise exception 'Sender wallet not found'; end if;

  update public.wallets set balance = balance - gift.price_stars
  where id = buyer_wallet_id and balance >= gift.price_stars;
  if not found then raise exception 'Insufficient Stars balance'; end if;
  update public.wallets set balance = balance + gift.price_stars where id = seller_wallet_id;
  update public.nft_items set owner_profile_id = p_recipient_profile_id where id = gift.nft_item_id;

  insert into public.nft_gift_offers (chat_id, nft_item_id, sender_profile_id, recipient_profile_id, price_stars, status, completed_at)
  values (gift.chat_id, gift.nft_item_id, gift.sender_profile_id, gift.recipient_profile_id, gift.price_stars, 'completed', now())
  returning id into result_offer_id;

  insert into public.nft_gift_responses (original_offer_id, result_offer_id, recipient_profile_id, status)
  values (gift.id, result_offer_id, p_recipient_profile_id, 'completed');

  update public.nft_gift_offers set resolved_at = now() where id = gift.id;

  insert into public.messages (chat_id, sender_profile_id, body, kind, gift_offer_id)
  values (gift.chat_id, gift.sender_profile_id, 'NFT-предложение принято', 'system', result_offer_id)
  returning id into message_id;

  insert into public.wallet_transactions (wallet_id, amount, reason, reference_id)
  values (buyer_wallet_id, -gift.price_stars, 'chat_gift_purchase', gift.id),
    (seller_wallet_id, gift.price_stars, 'chat_gift_sale', gift.id);
  insert into public.nft_transfers (nft_item_id, from_profile_id, to_profile_id, transfer_type)
  values (gift.nft_item_id, gift.sender_profile_id, p_recipient_profile_id, 'gift');
  return message_id;
end;
$$;

create or replace function public.decline_chat_nft_gift(p_gift_id uuid, p_recipient_profile_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  gift public.nft_gift_offers%rowtype;
  result_offer_id uuid;
  message_id uuid;
begin
  select * into gift from public.nft_gift_offers where id = p_gift_id for update;
  if not found or gift.recipient_profile_id <> p_recipient_profile_id or gift.status <> 'pending' or gift.resolved_at is not null or gift.price_stars <= 0 then
    return null;
  end if;

  insert into public.nft_gift_offers (chat_id, nft_item_id, sender_profile_id, recipient_profile_id, price_stars, status, completed_at)
  values (gift.chat_id, gift.nft_item_id, gift.sender_profile_id, gift.recipient_profile_id, gift.price_stars, 'declined', now())
  returning id into result_offer_id;

  insert into public.nft_gift_responses (original_offer_id, result_offer_id, recipient_profile_id, status)
  values (gift.id, result_offer_id, p_recipient_profile_id, 'declined');

  update public.nft_gift_offers set resolved_at = now() where id = gift.id;

  insert into public.messages (chat_id, sender_profile_id, body, kind, gift_offer_id)
  values (gift.chat_id, gift.sender_profile_id, 'NFT-предложение отклонено', 'system', result_offer_id)
  returning id into message_id;
  return message_id;
end;
$$;

create or replace function public.create_market_listing(
  p_nft_item_id uuid,
  p_seller_profile_id uuid,
  p_price bigint,
  p_currency text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_owner_id uuid;
  listing_id uuid;
begin
  if p_price <= 0 or p_currency not in ('stars', 'ton') then
    raise exception 'Invalid listing price or currency';
  end if;
  select owner_profile_id into current_owner_id from public.nft_items where id = p_nft_item_id for update;
  if not found or current_owner_id <> p_seller_profile_id then raise exception 'Seller no longer owns this NFT'; end if;
  if exists (select 1 from public.nft_gift_offers where nft_item_id = p_nft_item_id and status = 'pending' and resolved_at is null) then
    raise exception 'Resolve the pending gift offer before listing this NFT';
  end if;
  if exists (select 1 from public.market_listings where nft_item_id = p_nft_item_id and status = 'active') then
    raise exception 'NFT already has an active listing';
  end if;
  insert into public.market_listings (nft_item_id, seller_profile_id, price, currency)
  values (p_nft_item_id, p_seller_profile_id, p_price, p_currency)
  returning id into listing_id;
  return listing_id;
end;
$$;

revoke all on function public.purchase_market_listing(uuid, uuid) from public, anon, authenticated;
grant execute on function public.purchase_market_listing(uuid, uuid) to service_role;
revoke all on function public.send_chat_nft_gift(uuid, uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.send_chat_nft_gift(uuid, uuid, uuid, bigint) to service_role;
revoke all on function public.accept_chat_nft_gift(uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_chat_nft_gift(uuid, uuid) to service_role;
revoke all on function public.decline_chat_nft_gift(uuid, uuid) from public, anon, authenticated;
grant execute on function public.decline_chat_nft_gift(uuid, uuid) to service_role;
revoke all on function public.create_market_listing(uuid, uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.create_market_listing(uuid, uuid, bigint, text) to service_role;
revoke all on function public.ensure_saved_chat(uuid) from public, anon, authenticated;
grant execute on function public.ensure_saved_chat(uuid) to service_role;
revoke all on function public.get_or_create_direct_chat(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_or_create_direct_chat(uuid, uuid) to service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'wallets', 'wallet_transactions', 'nft_collections', 'nft_models',
    'nft_items', 'nft_transfers', 'market_listings', 'market_transactions', 'nft_gift_offers', 'nft_gift_responses',
    'chats', 'chat_members', 'messages', 'saved_messages'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
  end loop;
end;
$$;

alter table public.profiles enable row level security;
revoke select (id, telegram_id, nickname, username, first_name, last_name, avatar_url, bio)
  on public.profiles from anon;
drop policy if exists profiles_browser_demo_read on public.profiles;
insert into public.profiles (telegram_id, nickname, first_name, last_name)
values (0, 'browser000000', 'Browser', 'Player')
on conflict (telegram_id) do nothing;
insert into public.wallets (profile_id, currency, balance)
select profiles.id, currencies.currency, 0
from public.profiles
cross join (values ('stars'), ('ton')) as currencies(currency)
where profiles.telegram_id = 0
on conflict (profile_id, currency) do nothing;
drop view if exists public.browser_demo_profile;
create view public.browser_demo_profile with (security_barrier = true) as
select profiles.id, profiles.telegram_id, profiles.nickname, profiles.username,
  profiles.first_name, profiles.last_name, profiles.avatar_url, profiles.bio,
  coalesce(stars_wallet.balance, 0) as stars_balance
from public.profiles
left join public.wallets as stars_wallet
  on stars_wallet.profile_id = profiles.id and stars_wallet.currency = 'stars'
where profiles.telegram_id = 0;
revoke all on public.browser_demo_profile from public, anon, authenticated;
grant select on public.browser_demo_profile to anon;
drop view if exists public.browser_demo_nfts;
create view public.browser_demo_nfts with (security_barrier = true) as
select items.id as item_id, items.external_id, items.attributes, items.acquired_at,
  models.id as model_id, models.slug as model_slug, models.name as model_name,
  'https://nft.fragment.com/gift/' || collections.slug || '-' || items.external_id || '.webp' as preview_url,
  'https://nft.fragment.com/gift/' || collections.slug || '-' || items.external_id || '.tgs' as animation_url,
  collections.name as collection_name, collections.slug as collection_slug,
  listings.id as listing_id, listings.price as listing_price,
  listings.currency as listing_currency, listings.status as listing_status
from public.nft_items as items
join public.profiles as owners on owners.id = items.owner_profile_id
join public.nft_models as models on models.id = items.model_id
join public.nft_collections as collections on collections.id = models.collection_id
left join public.market_listings as listings
  on listings.nft_item_id = items.id and listings.status = 'active'
where owners.telegram_id = 0;
revoke all on public.browser_demo_nfts from public, anon, authenticated;
grant select on public.browser_demo_nfts to anon;
