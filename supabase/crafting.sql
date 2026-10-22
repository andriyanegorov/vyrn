alter table public.nft_transfers
  drop constraint if exists nft_transfers_transfer_type_check;

alter table public.nft_transfers
  add constraint nft_transfers_transfer_type_check
  check (transfer_type in ('mint', 'market', 'gift', 'admin', 'craft'));

create or replace function public.crafting_chance(p_attributes jsonb)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  fragment_price numeric;
begin
  if coalesce(p_attributes ->> 'fragment_price_stars', '') !~ '^[0-9]+(\.[0-9]+)?$' then
    return 18;
  end if;

  fragment_price := (p_attributes ->> 'fragment_price_stars')::numeric;
  if fragment_price <= 100 then
    return 18;
  elsif fragment_price <= 200 then
    return 20;
  elsif fragment_price < 300 then
    return 20 + (fragment_price - 200) * 0.05;
  end if;

  return 25;
end;
$$;

create or replace function public.crafting_weighted_trait(
  p_nft_item_ids uuid[],
  p_trait_name text
)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  total_count integer;
  roll numeric;
  trait_entry record;
begin
  select count(*) into total_count
  from public.nft_items as items
  where items.id = any(p_nft_item_ids)
    and nullif(items.attributes -> 'fragment_traits' -> p_trait_name ->> 'name', '') is not null;

  if total_count = 0 then
    return null;
  end if;

  roll := random() * total_count;
  for trait_entry in
    select items.attributes -> 'fragment_traits' -> p_trait_name ->> 'name' as name,
      min(
        case
          when items.attributes -> 'fragment_traits' -> p_trait_name ->> 'rarity_percent' ~ '^[0-9]+(\.[0-9]+)?$'
          then (items.attributes -> 'fragment_traits' -> p_trait_name ->> 'rarity_percent')::numeric
          else null
        end
      ) as rarity_percent,
      count(*) as weight
    from public.nft_items as items
    where items.id = any(p_nft_item_ids)
      and nullif(items.attributes -> 'fragment_traits' -> p_trait_name ->> 'name', '') is not null
    group by items.attributes -> 'fragment_traits' -> p_trait_name ->> 'name'
    order by name
  loop
    if roll < trait_entry.weight then
      return jsonb_strip_nulls(jsonb_build_object(
        'name', trait_entry.name,
        'rarity_percent', trait_entry.rarity_percent
      ));
    end if;
    roll := roll - trait_entry.weight;
  end loop;

  return null;
end;
$$;

drop function if exists public.craft_nfts(uuid, uuid[]);
drop function if exists public.craft_nfts(uuid, uuid[], text);

create or replace function public.craft_nfts(
  p_profile_id uuid,
  p_nft_item_ids uuid[],
  p_output_visual_external_id text,
  p_output_fragment_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_count integer;
  found_count integer;
  v_chance numeric;
  v_success boolean;
  v_collection_id uuid;
  v_collection_slug text;
  v_collection_name text;
  v_base_external_id text;
  v_source_external_id text;
  v_result_model_id uuid;
  v_output_traits jsonb;
  v_result_attributes jsonb;
  v_input_price_sum numeric;
  v_priced_input_count integer;
  v_black_rare_guarantee boolean;
  v_result_item_id uuid;
  v_result_item jsonb;
begin
  if p_profile_id is null
    or p_nft_item_ids is null
    or cardinality(p_nft_item_ids) < 1
    or cardinality(p_nft_item_ids) > 4
    or array_position(p_nft_item_ids, null) is not null then
    raise exception 'Select between 1 and 4 NFTs';
  end if;

  item_count := cardinality(p_nft_item_ids);
  if (select count(distinct selected.item_id) from unnest(p_nft_item_ids) as selected(item_id)) <> item_count then
    raise exception 'Duplicate NFTs are not allowed';
  end if;

  perform 1
  from public.nft_items as items
  where items.id = any(p_nft_item_ids)
  order by items.id
  for update;

  select count(*) into found_count
  from public.nft_items as items
  where items.id = any(p_nft_item_ids)
    and items.owner_profile_id = p_profile_id;

  if found_count <> item_count then
    raise exception 'One or more NFTs are no longer owned by this player';
  end if;

  select count(distinct models.collection_id) into found_count
  from public.nft_items as items
  join public.nft_models as models on models.id = items.model_id
  where items.id = any(p_nft_item_ids);
  if found_count <> 1 then
    raise exception 'Crafting is only allowed within one collection';
  end if;

  if exists (
    select 1
    from public.market_listings as listings
    where listings.nft_item_id = any(p_nft_item_ids)
      and listings.status = 'active'
  ) then
    raise exception 'Remove NFTs from the market before crafting';
  end if;

  select models.collection_id, collections.slug, collections.name, items.external_id
  into v_collection_id, v_collection_slug, v_collection_name, v_base_external_id
  from public.nft_items as items
  join public.nft_models as models on models.id = items.model_id
  join public.nft_collections as collections on collections.id = models.collection_id
  where items.id = p_nft_item_ids[1];

  if v_base_external_id is null or v_base_external_id !~ '^[0-9]{1,12}$' then
    raise exception 'The first NFT must have a valid Fragment serial number';
  end if;

  v_source_external_id := btrim(coalesce(p_output_visual_external_id, ''));
  if v_source_external_id !~ '^[0-9]{1,12}$'
    or exists (
      select 1
      from public.nft_items as items
      where items.id = any(p_nft_item_ids)
        and v_source_external_id = coalesce(
          items.attributes -> 'crafting' ->> 'visual_external_id',
          items.external_id
        )
    ) then
    raise exception 'The result must use a different Fragment gift from this collection';
  end if;

  if jsonb_typeof(p_output_fragment_data) is distinct from 'object'
    or jsonb_typeof(p_output_fragment_data -> 'traits') is distinct from 'object' then
    raise exception 'Fragment output price or traits are invalid';
  end if;

  if jsonb_typeof(p_output_fragment_data -> 'grams') is distinct from 'number' then
    raise exception 'Fragment output price or traits are invalid';
  end if;
  if (p_output_fragment_data ->> 'grams')::numeric <= 0 then
    raise exception 'Fragment output price or traits are invalid';
  end if;

  if jsonb_typeof(p_output_fragment_data -> 'stars') is distinct from 'number' then
    raise exception 'Fragment output price or traits are invalid';
  end if;
  if (p_output_fragment_data ->> 'stars')::numeric <= 0 then
    raise exception 'Fragment output price or traits are invalid';
  end if;

  v_output_traits := p_output_fragment_data -> 'traits';

  select sum(prices.price_stars), count(prices.price_stars)::integer
  into v_input_price_sum, v_priced_input_count
  from (
    select case
      when items.attributes ->> 'fragment_price_stars' ~ '^[0-9]+(\.[0-9]+)?$'
        then case
          when (items.attributes ->> 'fragment_price_stars')::numeric > 0
          then (items.attributes ->> 'fragment_price_stars')::numeric
          else null
        end
      when items.attributes ->> 'fragment_price_fragment_stars' ~ '^[0-9]+(\.[0-9]+)?$'
        then case
          when (items.attributes ->> 'fragment_price_fragment_stars')::numeric > 0
          then (items.attributes ->> 'fragment_price_fragment_stars')::numeric
          else null
        end
      else null
    end as price_stars
    from public.nft_items as items
    where items.id = any(p_nft_item_ids)
  ) as prices;
  if v_priced_input_count <> item_count then
    raise exception 'Every selected NFT must have a valid price before crafting';
  end if;

  select least(100::numeric, sum(public.crafting_chance(items.attributes)))
  into v_chance
  from public.nft_items as items
  where items.id = any(p_nft_item_ids);

  select item_count = 4 and bool_and(
    lower(items.attributes -> 'fragment_traits' -> 'backdrop' ->> 'name') like '%black%'
    and case
      when items.attributes -> 'fragment_traits' -> 'backdrop' ->> 'rarity_percent' ~ '^[0-9]+(\.[0-9]+)?$'
      then (items.attributes -> 'fragment_traits' -> 'backdrop' ->> 'rarity_percent')::numeric <= 1
      else false
    end
  ) into v_black_rare_guarantee
  from public.nft_items as items
  where items.id = any(p_nft_item_ids);
  if coalesce(v_black_rare_guarantee, false) then
    v_chance := 100;
  end if;

  v_success := random() * 100 < v_chance;

  if v_success then
    insert into public.nft_models (collection_id, slug, name, preview_url, animation_url)
    values (
      v_collection_id,
      'crafted-' || gen_random_uuid()::text,
      coalesce(v_collection_name, 'NFT'),
      'https://nft.fragment.com/gift/' || v_collection_slug || '-' || v_source_external_id || '.webp',
      'https://nft.fragment.com/gift/' || v_collection_slug || '-' || v_source_external_id || '.tgs'
    )
    returning id into v_result_model_id;

    v_result_attributes := jsonb_strip_nulls(jsonb_build_object(
      'fragment_price_stars', case
        when v_priced_input_count = item_count then to_jsonb(v_input_price_sum)
        else null
      end,
      'fragment_price_grams', p_output_fragment_data -> 'grams',
      'fragment_price_fragment_stars', p_output_fragment_data -> 'stars'
    )) || jsonb_build_object(
      'fragment_price_crafted_total', v_priced_input_count = item_count,
      'fragment_traits', v_output_traits,
      'crafting', jsonb_build_object(
        'crafted_at', now(),
        'input_item_ids', to_jsonb(p_nft_item_ids),
        'chance', v_chance,
        'base_external_id', v_base_external_id,
        'visual_external_id', v_source_external_id
      )
    );

    insert into public.nft_items (model_id, external_id, owner_profile_id, attributes)
    values (
      v_result_model_id,
      v_base_external_id,
      p_profile_id,
      v_result_attributes
    )
    returning id into v_result_item_id;
  end if;

  update public.nft_items
  set owner_profile_id = null
  where id = any(p_nft_item_ids)
    and owner_profile_id = p_profile_id;

  insert into public.nft_transfers (nft_item_id, from_profile_id, to_profile_id, transfer_type)
  select items.id, p_profile_id, null, 'craft'
  from public.nft_items as items
  where items.id = any(p_nft_item_ids);

  if v_success then
    insert into public.nft_transfers (nft_item_id, from_profile_id, to_profile_id, transfer_type)
    values (v_result_item_id, null, p_profile_id, 'mint');

    select to_jsonb(items) || jsonb_build_object(
      'nft_models', jsonb_build_object(
        'id', models.id,
        'slug', models.slug,
        'name', models.name,
        'preview_url', models.preview_url,
        'animation_url', models.animation_url,
        'nft_collections', jsonb_build_object(
          'name', collections.name,
          'slug', collections.slug
        )
      )
    )
    into v_result_item
    from public.nft_items as items
    join public.nft_models as models on models.id = items.model_id
    join public.nft_collections as collections on collections.id = models.collection_id
    where items.id = v_result_item_id;
  end if;

  return jsonb_build_object(
    'success', v_success,
    'chance', v_chance,
    'consumed_ids', to_jsonb(p_nft_item_ids),
    'item', v_result_item
  );
end;
$$;

revoke all on function public.crafting_chance(jsonb) from public, anon, authenticated;
revoke all on function public.crafting_weighted_trait(uuid[], text) from public, anon, authenticated;
revoke all on function public.craft_nfts(uuid, uuid[], text, jsonb) from public, anon, authenticated;
grant execute on function public.crafting_chance(jsonb) to service_role;
grant execute on function public.crafting_weighted_trait(uuid[], text) to service_role;
grant execute on function public.craft_nfts(uuid, uuid[], text, jsonb) to service_role;

notify pgrst, 'reload schema';