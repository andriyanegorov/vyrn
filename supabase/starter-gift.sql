-- Стартовый подарок: один NFT на Telegram-игрока и уникальный подарок на весь проект.
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

create table if not exists public.starter_gift_inventory (
  collection_slug text not null,
  gift_number text not null,
  profile_id uuid,
  nft_item_id uuid references public.nft_items(id) on delete set null,
  mint_pending boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (collection_slug, gift_number)
);
alter table public.starter_gift_inventory
  add column if not exists nft_item_id uuid references public.nft_items(id) on delete set null;
alter table public.starter_gift_inventory
  add column if not exists mint_pending boolean not null default false;
alter table public.starter_gift_inventory enable row level security;
revoke all on public.starter_gift_inventory from anon, authenticated;

-- Reserve gifts already in collections or issued by the previous starter-gift flow.
insert into public.starter_gift_inventory (
  collection_slug, gift_number, profile_id, nft_item_id, created_at
)
select gifts.collection_slug, gifts.gift_number, gifts.profile_id, gifts.nft_item_id, gifts.created_at
from (
  select collections.slug as collection_slug, items.external_id as gift_number,
    items.owner_profile_id as profile_id, items.id as nft_item_id, items.acquired_at as created_at
  from public.nft_items as items
  join public.nft_models as models on models.id = items.model_id
  join public.nft_collections as collections on collections.id = models.collection_id
  where collections.slug ~ '^[a-z0-9]+$' and items.external_id ~ '^[0-9]{1,12}$'
  union all
  select claims.collection_slug, claims.gift_number, claims.profile_id, claims.nft_item_id, claims.created_at
  from public.starter_gift_claims as claims
  union all
  select claims.collection_slug, claims.gift_number, claims.profile_id, claims.nft_item_id, claims.created_at
  from public.starter_gift_demo_claims as claims
) as gifts
on conflict (collection_slug, gift_number) do nothing;

create or replace function public.prevent_duplicate_fragment_gift()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_slug text;
  v_duplicate boolean;
  v_inventory_item_id uuid;
  v_mint_pending boolean;
begin
  if tg_op = 'UPDATE'
    and new.model_id is not distinct from old.model_id
    and new.external_id is not distinct from old.external_id then
    return new;
  end if;
  if new.external_id is null or new.external_id !~ '^[0-9]{1,12}$' then
    return new;
  end if;

  select collections.slug into v_slug
  from public.nft_models as models
  join public.nft_collections as collections on collections.id = models.collection_id
  where models.id = new.model_id;
  if v_slug is null or v_slug !~ '^[a-z0-9]+$' then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_slug || ':' || new.external_id, 0)
  );
  select inventory.nft_item_id, inventory.mint_pending
  into v_inventory_item_id, v_mint_pending
  from public.starter_gift_inventory as inventory
  where inventory.collection_slug = v_slug and inventory.gift_number = new.external_id
  for update;
  if found then
    if v_inventory_item_id is null then
      if not v_mint_pending or new.attributes ->> 'starter_gift' is distinct from 'true' then
        raise exception 'Fragment gift is already present in the project' using errcode = '23505';
      end if;
    elsif v_inventory_item_id is distinct from new.id then
      raise exception 'Fragment gift is already present in the project' using errcode = '23505';
    end if;
  else
    insert into public.starter_gift_inventory (
      collection_slug, gift_number, profile_id, mint_pending
    )
    values (
      v_slug,
      new.external_id,
      new.owner_profile_id,
      coalesce(new.attributes ->> 'starter_gift' = 'true', false)
    );
  end if;

  select exists (
    select 1
    from public.nft_items as items
    join public.nft_models as models on models.id = items.model_id
    join public.nft_collections as collections on collections.id = models.collection_id
    where collections.slug = v_slug
      and items.external_id = new.external_id
      and items.id is distinct from new.id
  ) into v_duplicate;
  if v_duplicate then
    raise exception 'Fragment gift is already present in the project' using errcode = '23505';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_duplicate_fragment_gift() from public, anon, authenticated;

create or replace function public.attach_fragment_gift_inventory_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_slug text;
begin
  if new.external_id is null or new.external_id !~ '^[0-9]{1,12}$' then
    return new;
  end if;

  select collections.slug into v_slug
  from public.nft_models as models
  join public.nft_collections as collections on collections.id = models.collection_id
  where models.id = new.model_id;
  if v_slug is null or v_slug !~ '^[a-z0-9]+$' then
    return new;
  end if;

  update public.starter_gift_inventory
  set nft_item_id = new.id,
    profile_id = new.owner_profile_id,
    mint_pending = false
  where collection_slug = v_slug
    and gift_number = new.external_id
    and (nft_item_id is null or nft_item_id = new.id);
  return new;
end;
$$;
revoke all on function public.attach_fragment_gift_inventory_item() from public, anon, authenticated;

drop trigger if exists nft_items_prevent_duplicate_fragment_gift on public.nft_items;
create trigger nft_items_prevent_duplicate_fragment_gift
before insert or update on public.nft_items
for each row execute function public.prevent_duplicate_fragment_gift();
drop trigger if exists nft_items_attach_fragment_gift_inventory on public.nft_items;
create trigger nft_items_attach_fragment_gift_inventory
after insert or update on public.nft_items
for each row execute function public.attach_fragment_gift_inventory_item();

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
    if exists (
      select 1 from public.starter_gift_demo_claims as claims
      where claims.profile_id = p_profile_id and claims.launch_id = p_launch_id
    ) then
      return jsonb_build_object('already_claimed', true);
    end if;
  elsif exists (
    select 1 from public.starter_gift_claims as claims
    where claims.profile_id = p_profile_id
  ) then
    return jsonb_build_object('already_claimed', true);
  end if;

  begin
    insert into public.starter_gift_inventory (
      collection_slug, gift_number, profile_id, mint_pending
    )
    values (v_slug, v_number, p_profile_id, true);

    if v_telegram_id = 0 then
      insert into public.starter_gift_demo_claims (
        profile_id, launch_id, collection_slug, gift_number, price_stars
      )
      values (p_profile_id, p_launch_id, v_slug, v_number, v_price);
    else
      insert into public.starter_gift_claims (profile_id, collection_slug, gift_number, price_stars)
      values (p_profile_id, v_slug, v_number, v_price);
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
  exception
    when unique_violation then
      return jsonb_build_object('gift_unavailable', true);
  end;
end;
$$;

revoke all on function public.claim_starter_gift(uuid, text, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.claim_starter_gift(uuid, text, text, text, jsonb, uuid) to service_role;

notify pgrst, 'reload schema';
