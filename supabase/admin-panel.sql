create extension if not exists pgcrypto;

create table if not exists public.admin_settings (
  singleton boolean primary key default true check (singleton),
  password_hash text,
  updated_at timestamptz not null default now()
);

insert into public.admin_settings (singleton, password_hash)
values (true, null)
on conflict (singleton) do nothing;

alter table public.admin_settings enable row level security;
revoke all on public.admin_settings from public, anon, authenticated;

drop function if exists public.admin_search_players(text, text);

create function public.admin_search_players(p_password text, p_query text default '')
returns table (
  profile_id uuid,
  telegram_id bigint,
  nickname text,
  username text,
  first_name text,
  last_name text,
  avatar_url text,
  status text,
  nft_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_hash text;
  search_term text := btrim(coalesce(p_query, ''));
begin
  select settings.password_hash into configured_hash
  from public.admin_settings as settings
  where settings.singleton = true;

  if configured_hash is null or p_password is null
    or extensions.crypt(p_password, configured_hash) <> configured_hash then
    raise exception 'Invalid administrator password' using errcode = '28000';
  end if;
  if char_length(search_term) < 2 then
    raise exception 'Enter at least 2 characters to search';
  end if;

  return query
    select players.id, players.telegram_id, players.nickname, players.username,
      players.first_name, players.last_name, players.avatar_url, players.status,
      count(items.id)::bigint as nft_count
    from public.profiles as players
    left join public.nft_items as items on items.owner_profile_id = players.id
    where players.nickname ilike '%' || search_term || '%'
      or coalesce(players.username, '') ilike '%' || search_term || '%'
      or players.telegram_id::text ilike '%' || search_term || '%'
      or players.first_name ilike '%' || search_term || '%'
      or players.last_name ilike '%' || search_term || '%'
    group by players.id
    order by players.created_at desc
    limit 50;
end;
$$;

drop function if exists public.admin_grant_fragment_gift(text, uuid, text, text, text);
drop function if exists public.admin_grant_fragment_gift(text, uuid, text, text, text, bigint, numeric, boolean);

create or replace function public.admin_grant_fragment_gift(
  p_password text,
  p_profile_id uuid,
  p_collection_slug text,
  p_collection_name text,
  p_gift_number text,
  p_price_stars bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_hash text;
  clean_slug text := lower(btrim(coalesce(p_collection_slug, '')));
  clean_number text := btrim(coalesce(p_gift_number, ''));
  clean_collection_name text := btrim(coalesce(p_collection_name, ''));
  v_collection_id uuid;
  v_model_id uuid;
  v_gift_item_id uuid;
  v_previous_owner_id uuid;
begin
  select settings.password_hash into configured_hash
  from public.admin_settings as settings
  where settings.singleton = true;

  if configured_hash is null or p_password is null
    or extensions.crypt(p_password, configured_hash) <> configured_hash then
    raise exception 'Invalid administrator password' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'Player not found';
  end if;
  if clean_slug !~ '^[a-z0-9]+$' or clean_number !~ '^[0-9]{1,12}$'
    or clean_collection_name = '' or char_length(clean_collection_name) > 100
    or p_price_stars is null or p_price_stars <= 0 then
    raise exception 'Invalid Fragment gift collection or number';
  end if;

  insert into public.nft_collections (slug, name)
  values (clean_slug, clean_collection_name)
  on conflict (slug) do update set name = excluded.name
  returning id into v_collection_id;

  insert into public.nft_models (collection_id, slug, name, preview_url, animation_url)
  values (
    v_collection_id,
    clean_slug || '-' || clean_number,
    clean_collection_name,
    'https://nft.fragment.com/gift/' || clean_slug || '-' || clean_number || '.webp',
    'https://nft.fragment.com/gift/' || clean_slug || '-' || clean_number || '.tgs'
  )
  on conflict (collection_id, slug) do update
    set name = excluded.name,
        preview_url = excluded.preview_url,
        animation_url = excluded.animation_url
  returning id into v_model_id;

  select item.id, item.owner_profile_id
  into v_gift_item_id, v_previous_owner_id
  from public.nft_items as item
  where item.model_id = v_model_id and item.external_id = clean_number
  for update;

  if v_gift_item_id is null then
    insert into public.nft_items (model_id, external_id, owner_profile_id, attributes)
    values (v_model_id, clean_number, p_profile_id, jsonb_build_object('fragment_price_stars', p_price_stars))
    returning id into v_gift_item_id;
  elsif v_previous_owner_id is distinct from p_profile_id then
    update public.market_listings
    set status = 'cancelled', closed_at = now()
    where nft_item_id = v_gift_item_id and status = 'active';
    update public.nft_items
    set owner_profile_id = p_profile_id,
        attributes = coalesce(attributes, '{}'::jsonb) || jsonb_build_object('fragment_price_stars', p_price_stars)
    where id = v_gift_item_id;
  else
    update public.nft_items
    set attributes = coalesce(attributes, '{}'::jsonb) || jsonb_build_object('fragment_price_stars', p_price_stars)
    where id = v_gift_item_id;
  end if;

  if v_previous_owner_id is distinct from p_profile_id then
    insert into public.nft_transfers (nft_item_id, from_profile_id, to_profile_id, transfer_type)
    values (
      v_gift_item_id,
      v_previous_owner_id,
      p_profile_id,
      case when v_previous_owner_id is null then 'mint' else 'admin' end
    );
  end if;

  return v_gift_item_id;
end;
$$;

drop function if exists public.admin_remove_fragment_gift(text, uuid, text, text);

create or replace function public.admin_remove_fragment_gift(
  p_password text,
  p_profile_id uuid,
  p_collection_slug text,
  p_gift_number text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_hash text;
  clean_slug text := lower(btrim(coalesce(p_collection_slug, '')));
  clean_number text := btrim(coalesce(p_gift_number, ''));
  v_item_id uuid;
begin
  select settings.password_hash into configured_hash
  from public.admin_settings as settings
  where settings.singleton = true;

  if configured_hash is null or p_password is null
    or extensions.crypt(p_password, configured_hash) <> configured_hash then
    raise exception 'Invalid administrator password' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'Player not found';
  end if;
  if clean_slug !~ '^[a-z0-9]+$' or clean_number !~ '^[0-9]{1,12}$' then
    raise exception 'Invalid Fragment gift collection or number';
  end if;

  select items.id into v_item_id
  from public.nft_items as items
  join public.nft_models as models on models.id = items.model_id
  join public.nft_collections as collections on collections.id = models.collection_id
  where items.owner_profile_id = p_profile_id
    and items.external_id = clean_number
    and collections.slug = clean_slug
  for update;

  if v_item_id is null then
    raise exception 'NFT not found on this profile';
  end if;

  delete from public.market_transactions
  where nft_item_id = v_item_id;

  delete from public.market_listings
  where nft_item_id = v_item_id;

  update public.messages
  set gift_offer_id = null
  where gift_offer_id in (
    select id from public.nft_gift_offers where nft_item_id = v_item_id
  );

  if to_regclass('public.nft_gift_responses') is not null then
    execute '
      delete from public.nft_gift_responses
      where original_offer_id in (
        select id from public.nft_gift_offers where nft_item_id = $1
      ) or result_offer_id in (
        select id from public.nft_gift_offers where nft_item_id = $1
      )'
    using v_item_id;
  end if;

  delete from public.nft_gift_offers
  where nft_item_id = v_item_id;

  delete from public.nft_transfers
  where nft_item_id = v_item_id;

  delete from public.nft_items
  where id = v_item_id;

  return v_item_id;
end;
$$;

drop function if exists public.admin_list_all_nfts(text);

create or replace function public.admin_list_all_nfts(p_password text)
returns table (
  nft_item_id uuid,
  profile_id uuid,
  nickname text,
  telegram_id bigint,
  collection_name text,
  collection_slug text,
  gift_number text,
  preview_url text,
  acquired_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_hash text;
begin
  select settings.password_hash into configured_hash
  from public.admin_settings as settings
  where settings.singleton = true;

  if configured_hash is null or p_password is null
    or extensions.crypt(p_password, configured_hash) <> configured_hash then
    raise exception 'Invalid administrator password' using errcode = '28000';
  end if;

  return query
    select items.id, owners.id, owners.nickname, owners.telegram_id,
      collections.name, collections.slug, items.external_id,
      'https://nft.fragment.com/gift/' || collections.slug || '-' || items.external_id || '.webp', items.acquired_at
    from public.nft_items as items
    join public.profiles as owners on owners.id = items.owner_profile_id
    join public.nft_models as models on models.id = items.model_id
    join public.nft_collections as collections on collections.id = models.collection_id
    order by items.acquired_at desc;
end;
$$;

drop function if exists public.admin_remove_nft(text, uuid);

create or replace function public.admin_remove_nft(
  p_password text,
  p_nft_item_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_hash text;
  v_item_id uuid;
begin
  select settings.password_hash into configured_hash
  from public.admin_settings as settings
  where settings.singleton = true;

  if configured_hash is null or p_password is null
    or extensions.crypt(p_password, configured_hash) <> configured_hash then
    raise exception 'Invalid administrator password' using errcode = '28000';
  end if;

  select id into v_item_id
  from public.nft_items
  where id = p_nft_item_id
  for update;
  if v_item_id is null then
    raise exception 'NFT not found';
  end if;

  delete from public.market_transactions where nft_item_id = v_item_id;
  delete from public.market_listings where nft_item_id = v_item_id;

  update public.messages
  set gift_offer_id = null
  where gift_offer_id in (
    select id from public.nft_gift_offers where nft_item_id = v_item_id
  );

  if to_regclass('public.nft_gift_responses') is not null then
    execute '
      delete from public.nft_gift_responses
      where original_offer_id in (
        select id from public.nft_gift_offers where nft_item_id = $1
      ) or result_offer_id in (
        select id from public.nft_gift_offers where nft_item_id = $1
      )'
    using v_item_id;
  end if;

  delete from public.nft_gift_offers
  where nft_item_id = v_item_id;

  delete from public.nft_transfers where nft_item_id = v_item_id;
  delete from public.nft_items where id = v_item_id;
  return v_item_id;
end;
$$;

drop function if exists public.admin_remove_all_nfts(text, text);

create function public.admin_remove_all_nfts(
  p_password text,
  p_confirmation text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_hash text;
  deleted_count bigint;
begin
  select settings.password_hash into configured_hash
  from public.admin_settings as settings
  where settings.singleton = true;

  if configured_hash is null or p_password is null
    or extensions.crypt(p_password, configured_hash) <> configured_hash then
    raise exception 'Invalid administrator password' using errcode = '28000';
  end if;
  if p_confirmation is distinct from 'УДАЛИТЬ ВСЕ NFT' then
    raise exception 'Type УДАЛИТЬ ВСЕ NFT to confirm the project-wide deletion';
  end if;

  delete from public.market_transactions where id is not null;
  delete from public.market_listings where id is not null;

  update public.messages
  set gift_offer_id = null
  where gift_offer_id is not null;

  if to_regclass('public.nft_gift_responses') is not null then
    execute 'delete from public.nft_gift_responses where id is not null';
  end if;
  if to_regclass('public.nft_gift_offers') is not null then
    execute 'delete from public.nft_gift_offers where id is not null';
  end if;

  delete from public.nft_transfers where id is not null;
  delete from public.nft_items where id is not null;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

create or replace function public.admin_verify_password(p_password text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select settings.password_hash is not null
    and p_password is not null
    and extensions.crypt(p_password, settings.password_hash) = settings.password_hash
  from public.admin_settings as settings
  where settings.singleton = true;
$$;

create or replace function public.admin_publish_random_fragment_gifts(
  p_password text,
  p_profile_id uuid,
  p_to_market boolean,
  p_gifts jsonb
)
returns table (
  collection_name text,
  gift_number text,
  price_stars bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_hash text;
  target_profile_id uuid;
  seller_profile_id uuid;
  gift_entry jsonb;
  clean_slug text;
  clean_name text;
  clean_number text;
  price_value numeric;
  grams_value numeric;
  v_random_listing_price numeric;
  v_random_collection_id uuid;
  v_random_model_id uuid;
  item_id uuid;
  seen_gifts text[] := array[]::text[];
  gift_key text;
begin
  select settings.password_hash into configured_hash
  from public.admin_settings as settings
  where settings.singleton = true;

  if configured_hash is null or p_password is null
    or extensions.crypt(p_password, configured_hash) <> configured_hash then
    raise exception 'Invalid administrator password' using errcode = '28000';
  end if;
  if p_to_market is null or p_gifts is null or jsonb_typeof(p_gifts) <> 'array' then
    raise exception 'Invalid random Fragment gift batch';
  end if;
  if jsonb_array_length(p_gifts) < 1 or jsonb_array_length(p_gifts) > 30 then
    raise exception 'Invalid random Fragment gift batch';
  end if;

  if p_to_market then
    select profile.id into seller_profile_id
    from public.profiles as profile
    where lower(coalesce(profile.username, '')) = 'vyrn';
    if seller_profile_id is null then
      raise exception 'VYRN seller profile (@vyrn) was not found';
    end if;
    target_profile_id := seller_profile_id;
  else
    if p_profile_id is null then
      raise exception 'Select a player to receive the NFTs';
    end if;
    select profile.id into target_profile_id
    from public.profiles as profile
    where profile.id = p_profile_id;
    if target_profile_id is null then
      raise exception 'Player not found';
    end if;
  end if;

  for gift_entry in
    select value from jsonb_array_elements(p_gifts)
  loop
    clean_slug := lower(btrim(coalesce(gift_entry ->> 'slug', '')));
    clean_name := btrim(coalesce(gift_entry ->> 'name', ''));
    clean_number := btrim(coalesce(gift_entry ->> 'number', ''));
    if clean_slug !~ '^[a-z0-9]+$'
      or clean_name = '' or char_length(clean_name) > 100
      or clean_number !~ '^[0-9]{1,12}$' then
      raise exception 'Invalid random Fragment gift entry';
    end if;
    if clean_number::numeric <= 0
      or jsonb_typeof(gift_entry -> 'price_stars') is distinct from 'number'
      or jsonb_typeof(gift_entry -> 'grams') is distinct from 'number' then
      raise exception 'Invalid random Fragment gift entry';
    end if;
    price_value := (gift_entry ->> 'price_stars')::numeric;
    grams_value := (gift_entry ->> 'grams')::numeric;
    if price_value < 1 or price_value > 9007199254740991 or price_value <> trunc(price_value)
      or grams_value <= 0 or grams_value > 1000000000 then
      raise exception 'Invalid random Fragment gift price';
    end if;
    v_random_listing_price := null;
    if p_to_market then
      if jsonb_typeof(gift_entry -> 'market_price_stars') is distinct from 'number' then
        raise exception 'Invalid random market listing price';
      end if;
      v_random_listing_price := (gift_entry ->> 'market_price_stars')::numeric;
      if v_random_listing_price < 1
        or v_random_listing_price > 9007199254740991
        or v_random_listing_price <> trunc(v_random_listing_price) then
        raise exception 'Invalid random market listing price';
      end if;
    end if;
    gift_key := clean_slug || '-' || clean_number;
    if gift_key = any(seen_gifts) then
      raise exception 'Duplicate random Fragment gift';
    end if;
    seen_gifts := array_append(seen_gifts, gift_key);

    insert into public.nft_collections (slug, name)
    values (clean_slug, clean_name)
    on conflict (slug) do update set name = excluded.name
    returning id into v_random_collection_id;

    insert into public.nft_models (collection_id, slug, name, preview_url, animation_url)
    values (
      v_random_collection_id,
      clean_slug || '-' || clean_number,
      clean_name,
      'https://nft.fragment.com/gift/' || clean_slug || '-' || clean_number || '.webp',
      'https://nft.fragment.com/gift/' || clean_slug || '-' || clean_number || '.tgs'
    )
    on conflict (collection_id, slug) do update
      set name = excluded.name,
          preview_url = excluded.preview_url,
          animation_url = excluded.animation_url
    returning id into v_random_model_id;

    if exists (
      select 1 from public.nft_items as item
      where item.model_id = v_random_model_id and item.external_id = clean_number
    ) then
      raise exception 'One of the selected Fragment gifts was already added. Retry to choose different gifts.';
    end if;

    insert into public.nft_items (model_id, external_id, owner_profile_id, attributes)
    values (
      v_random_model_id,
      clean_number,
      target_profile_id,
      jsonb_build_object(
        'fragment_price_grams', grams_value,
        'fragment_price_fragment_stars', price_value,
        'fragment_price_stars', price_value
      ) || case
        when jsonb_typeof(gift_entry -> 'fragment_traits') = 'object'
          then jsonb_build_object('fragment_traits', gift_entry -> 'fragment_traits')
        else '{}'::jsonb
      end
    )
    returning id into item_id;

    insert into public.nft_transfers (nft_item_id, from_profile_id, to_profile_id, transfer_type)
    values (item_id, null, target_profile_id, 'mint');

    if p_to_market then
      insert into public.market_listings (nft_item_id, seller_profile_id, price, currency)
      values (item_id, seller_profile_id, v_random_listing_price::bigint, 'stars');
    end if;

    return query select clean_name, clean_number,
      case when p_to_market then v_random_listing_price else price_value end::bigint;
  end loop;
end;
$$;

revoke all on function public.admin_search_players(text, text) from public, anon, authenticated;
revoke all on function public.admin_grant_fragment_gift(text, uuid, text, text, text, bigint) from public, anon, authenticated;
grant execute on function public.admin_search_players(text, text) to anon;
grant execute on function public.admin_grant_fragment_gift(text, uuid, text, text, text, bigint) to anon;
revoke all on function public.admin_remove_fragment_gift(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_remove_fragment_gift(text, uuid, text, text) to anon;
revoke all on function public.admin_list_all_nfts(text) from public, anon, authenticated;
grant execute on function public.admin_list_all_nfts(text) to anon;
revoke all on function public.admin_remove_nft(text, uuid) from public, anon, authenticated;
grant execute on function public.admin_remove_nft(text, uuid) to anon;
revoke all on function public.admin_remove_all_nfts(text, text) from public, anon, authenticated;
grant execute on function public.admin_remove_all_nfts(text, text) to anon;
revoke all on function public.admin_verify_password(text) from public, anon, authenticated;
grant execute on function public.admin_verify_password(text) to service_role;
revoke all on function public.admin_publish_random_fragment_gifts(text, uuid, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.admin_publish_random_fragment_gifts(text, uuid, boolean, jsonb) to service_role;

notify pgrst, 'reload schema';