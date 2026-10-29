-- Стартовый подарок: один NFT на Telegram-игрока и один NFT на запуск браузерного демо.
-- Выполните в Supabase SQL Editor после schema.sql и crafting.sql.
-- Повторный запуск безопасен.

create table if not exists public.starter_gift_claims (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  nft_item_id uuid references public.nft_items(id) on delete set null,
  collection_slug text not null,
  gift_number text not null,
  price_stars numeric,
  created_at timestamptz not null default now()
);
alter table public.starter_gift_claims enable row level security;
revoke all on public.starter_gift_claims from anon, authenticated;

create table if not exists public.starter_gift_demo_claims (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  launch_id uuid not null,
  nft_item_id uuid references public.nft_items(id) on delete set null,
  collection_slug text not null,
  gift_number text not null,
  price_stars numeric,
  created_at timestamptz not null default now(),
  primary key (profile_id, launch_id)
);
alter table public.starter_gift_demo_claims enable row level security;
revoke all on public.starter_gift_demo_claims from anon, authenticated;

drop function if exists public.claim_starter_gift(uuid, text, text, text, jsonb);

create or replace function public.claim_starter_gift(
  p_profile_id uuid,
  p_collection_slug text,
  p_collection_name text,
  p_gift_number text,
  p_fragment_data jsonb,
  p_launch_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text := lower(btrim(coalesce(p_collection_slug, '')));
  v_number text := btrim(coalesce(p_gift_number, ''));
  v_name text := btrim(coalesce(p_collection_name, ''));
  v_telegram_id bigint;
  v_claimed uuid;
  v_collection_id uuid;
  v_model_id uuid;
  v_item_id uuid;
  v_price numeric;
  v_grams numeric;
  v_item jsonb;
begin
  -- Блокируем строку профиля, чтобы два параллельных запроса шли друг за другом.
  select profiles.telegram_id into v_telegram_id
  from public.profiles as profiles
  where profiles.id = p_profile_id
  for update;
  if not found then
    raise exception 'Player not found';
  end if;
  if v_telegram_id is null or v_telegram_id < 0
    or (v_telegram_id = 0 and p_launch_id is null)
    or (v_telegram_id > 0 and p_launch_id is not null) then
    raise exception 'Invalid starter gift recipient or launch';
  end if;

  if v_slug !~ '^[a-z0-9]+$' or v_number !~ '^[0-9]{1,12}$' then
    raise exception 'Invalid Fragment gift collection or number';
  end if;
  if v_name = '' then
    v_name := v_slug;
  end if;
  if char_length(v_name) > 100 then
    raise exception 'Invalid Fragment gift collection or number';
  end if;

  if jsonb_typeof(p_fragment_data) is distinct from 'object'
    or jsonb_typeof(p_fragment_data -> 'traits') is distinct from 'object'
    or jsonb_typeof(p_fragment_data -> 'stars') is distinct from 'number'
    or jsonb_typeof(p_fragment_data -> 'grams') is distinct from 'number' then
    raise exception 'Fragment output price or traits are invalid';
  end if;
  v_price := (p_fragment_data ->> 'stars')::numeric;
  v_grams := (p_fragment_data ->> 'grams')::numeric;
  if v_price <= 0 or v_grams <= 0 then
    raise exception 'Fragment output price or traits are invalid';
  end if;

  if v_telegram_id = 0 then
    insert into public.starter_gift_demo_claims (
      profile_id, launch_id, collection_slug, gift_number, price_stars
    )
    values (p_profile_id, p_launch_id, v_slug, v_number, v_price)
    on conflict (profile_id, launch_id) do nothing
    returning profile_id into v_claimed;
  else
    insert into public.starter_gift_claims (profile_id, collection_slug, gift_number, price_stars)
    values (p_profile_id, v_slug, v_number, v_price)
    on conflict (profile_id) do nothing
    returning profile_id into v_claimed;
  end if;

  if v_claimed is null then
    return jsonb_build_object('already_claimed', true);
  end if;

  insert into public.nft_collections (slug, name)
  values (v_slug, v_name)
  on conflict (slug) do update set name = public.nft_collections.name
  returning id into v_collection_id;

  -- Отдельная модель на каждый подарок: так же поступают крафт и улучшение.
  insert into public.nft_models (collection_id, slug, name, preview_url, animation_url)
  values (
    v_collection_id,
    'starter-' || gen_random_uuid()::text,
    (select collections.name from public.nft_collections as collections where collections.id = v_collection_id),
    'https://nft.fragment.com/gift/' || v_slug || '-' || v_number || '.webp',
    'https://nft.fragment.com/gift/' || v_slug || '-' || v_number || '.tgs'
  )
  returning id into v_model_id;

  insert into public.nft_items (model_id, external_id, owner_profile_id, attributes)
  values (
    v_model_id,
    v_number,
    p_profile_id,
    jsonb_build_object(
      'fragment_price_stars', v_price,
      'fragment_price_grams', v_grams,
      'fragment_price_fragment_stars', v_price,
      'fragment_price_manual', false,
      'fragment_traits', p_fragment_data -> 'traits',
      'fragment_traits_updated_at', now(),
      'fragment_price_version', 2,
      'starter_gift', true
    )
  )
  returning id into v_item_id;

  insert into public.nft_transfers (nft_item_id, from_profile_id, to_profile_id, transfer_type)
  values (v_item_id, null, p_profile_id, 'mint');

  if v_telegram_id = 0 then
    update public.starter_gift_demo_claims
    set nft_item_id = v_item_id
    where profile_id = p_profile_id and launch_id = p_launch_id;
  else
    update public.starter_gift_claims
    set nft_item_id = v_item_id
    where profile_id = p_profile_id;
  end if;

  select to_jsonb(items) || jsonb_build_object(
    'nft_models', jsonb_build_object(
      'id', models.id,
      'slug', models.slug,
      'name', models.name,
      'preview_url', models.preview_url,
      'animation_url', models.animation_url,
      'nft_collections', jsonb_build_object('name', collections.name, 'slug', collections.slug)
    )
  )
  into v_item
  from public.nft_items as items
  join public.nft_models as models on models.id = items.model_id
  join public.nft_collections as collections on collections.id = models.collection_id
  where items.id = v_item_id;

  return jsonb_build_object('item', v_item);
end;
$$;

revoke all on function public.claim_starter_gift(uuid, text, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.claim_starter_gift(uuid, text, text, text, jsonb, uuid) to service_role;
