create or replace function public.upgrade_nft(
  p_profile_id uuid,
  p_nft_item_id uuid,
  p_output_visual_external_id text,
  p_output_fragment_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  upgrade_cost constant bigint := 25;
  v_item public.nft_items%rowtype;
  v_old_model public.nft_models%rowtype;
  v_collection public.nft_collections%rowtype;
  v_wallet_id uuid;
  v_wallet_balance bigint;
  v_model_id uuid;
  v_visual_external_id text;
  v_attributes jsonb;
  v_updated_item jsonb;
begin
  if p_profile_id is null or p_nft_item_id is null then
    raise exception 'Player and NFT are required';
  end if;

  select items.* into v_item
  from public.nft_items as items
  where items.id = p_nft_item_id
    and items.owner_profile_id = p_profile_id
  for update;

  if not found then
    raise exception 'NFT not found or no longer owned by this player';
  end if;

  if exists (
    select 1 from public.market_listings as listings
    where listings.nft_item_id = p_nft_item_id
      and listings.status = 'active'
  ) then
    raise exception 'Remove the NFT from the market before upgrading';
  end if;

  select models.* into v_old_model
  from public.nft_models as models
  where models.id = v_item.model_id;

  select collections.* into v_collection
  from public.nft_collections as collections
  where collections.id = v_old_model.collection_id;

  v_visual_external_id := btrim(coalesce(p_output_visual_external_id, ''));
  if v_visual_external_id !~ '^[0-9]{1,12}$' or v_visual_external_id = coalesce(
    v_item.attributes -> 'crafting' ->> 'visual_external_id',
    v_item.external_id
  ) then
    raise exception 'The upgrade must use a different Fragment gift from this collection';
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

  select wallets.id, wallets.balance into v_wallet_id, v_wallet_balance
  from public.wallets as wallets
  where wallets.profile_id = p_profile_id
    and wallets.currency = 'stars'
  for update;

  if not found then
    raise exception 'Stars wallet not found';
  end if;
  if v_wallet_balance < upgrade_cost then
    raise exception 'Insufficient Stars balance';
  end if;

  insert into public.nft_models (collection_id, slug, name, preview_url, animation_url)
  values (
    v_collection.id,
    'upgraded-' || gen_random_uuid()::text,
    v_old_model.name,
    'https://nft.fragment.com/gift/' || v_collection.slug || '-' || v_visual_external_id || '.webp',
    'https://nft.fragment.com/gift/' || v_collection.slug || '-' || v_visual_external_id || '.tgs'
  )
  returning id into v_model_id;

  v_attributes := coalesce(v_item.attributes, '{}'::jsonb) || jsonb_build_object(
    'fragment_price_stars', (p_output_fragment_data ->> 'stars')::numeric,
    'fragment_price_grams', (p_output_fragment_data ->> 'grams')::numeric,
    'fragment_price_fragment_stars', (p_output_fragment_data ->> 'stars')::numeric,
    'fragment_price_manual', false,
    'fragment_price_crafted_total', false,
    'fragment_traits', p_output_fragment_data -> 'traits',
    'fragment_traits_updated_at', now(),
    'crafting', jsonb_build_object(
      'visual_external_id', v_visual_external_id,
      'upgraded_at', now(),
      'previous_visual_external_id', coalesce(
        v_item.attributes -> 'crafting' ->> 'visual_external_id',
        v_item.external_id
      ),
      'upgrade_fee_stars', upgrade_cost
    )
  );

  update public.nft_items
  set model_id = v_model_id,
      attributes = v_attributes
  where id = p_nft_item_id
    and owner_profile_id = p_profile_id;

  update public.wallets
  set balance = balance - upgrade_cost
  where id = v_wallet_id
    and balance >= upgrade_cost
  returning balance into v_wallet_balance;

  if not found then
    raise exception 'Insufficient Stars balance';
  end if;

  insert into public.wallet_transactions (wallet_id, amount, reason, reference_id)
  values (v_wallet_id, -upgrade_cost, 'nft_upgrade', p_nft_item_id);

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
  into v_updated_item
  from public.nft_items as items
  join public.nft_models as models on models.id = items.model_id
  join public.nft_collections as collections on collections.id = models.collection_id
  where items.id = p_nft_item_id;

  return jsonb_build_object(
    'item', v_updated_item,
    'upgrade_cost', upgrade_cost,
    'wallet_balance', v_wallet_balance
  );
end;
$$;

revoke all on function public.upgrade_nft(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.upgrade_nft(uuid, uuid, text, jsonb) to service_role;

notify pgrst, 'reload schema';
