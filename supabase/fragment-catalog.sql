alter table public.nft_collections
  add column if not exists fragment_gift_count bigint;

drop function if exists public.admin_sync_fragment_collections(text, jsonb);

create or replace function public.admin_sync_fragment_collections(
  p_password text,
  p_collections jsonb
)
returns table (slug text, name text, fragment_gift_count bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_hash text;
  collection_entry jsonb;
  clean_slug text;
  clean_name text;
  clean_gift_count bigint;
  seen_slugs text[] := array[]::text[];
begin
  select settings.password_hash into configured_hash
  from public.admin_settings as settings
  where settings.singleton = true;

  if configured_hash is null or p_password is null
    or extensions.crypt(p_password, configured_hash) <> configured_hash then
    raise exception 'Invalid administrator password' using errcode = '28000';
  end if;
  if p_collections is null or jsonb_typeof(p_collections) <> 'array' then
    raise exception 'Invalid Fragment collection catalog';
  end if;
  if jsonb_array_length(p_collections) < 1 or jsonb_array_length(p_collections) > 500 then
    raise exception 'Invalid Fragment collection catalog';
  end if;

  for collection_entry in
    select value from jsonb_array_elements(p_collections)
  loop
    clean_slug := lower(btrim(coalesce(collection_entry ->> 'slug', '')));
    clean_name := btrim(coalesce(collection_entry ->> 'name', ''));
    clean_gift_count := null;
    if collection_entry -> 'gift_count' is not null
      and jsonb_typeof(collection_entry -> 'gift_count') is distinct from 'null' then
      if jsonb_typeof(collection_entry -> 'gift_count') is distinct from 'number'
        or collection_entry ->> 'gift_count' !~ '^[0-9]{1,18}$' then
        raise exception 'Invalid Fragment collection gift count';
      end if;
      clean_gift_count := (collection_entry ->> 'gift_count')::bigint;
    end if;
    if clean_slug !~ '^[a-z0-9]+$'
      or clean_name = ''
      or char_length(clean_name) > 100
      or clean_slug = any(seen_slugs) then
      raise exception 'Invalid Fragment collection catalog entry';
    end if;
    seen_slugs := array_append(seen_slugs, clean_slug);

    insert into public.nft_collections as existing (slug, name, fragment_gift_count)
    values (clean_slug, clean_name, clean_gift_count)
    on conflict on constraint nft_collections_slug_key do update
      set name = excluded.name,
          fragment_gift_count = coalesce(excluded.fragment_gift_count, existing.fragment_gift_count)
      where existing.name is distinct from excluded.name
        or (excluded.fragment_gift_count is not null
          and existing.fragment_gift_count is distinct from excluded.fragment_gift_count);
  end loop;

  return query
  select catalog.slug, catalog.name, catalog.fragment_gift_count
  from public.nft_collections as catalog
  order by catalog.name;
end;
$$;

revoke all on function public.admin_sync_fragment_collections(text, jsonb) from public, anon, authenticated;
grant execute on function public.admin_sync_fragment_collections(text, jsonb) to service_role;

notify pgrst, 'reload schema';
