create or replace function public.admin_sync_fragment_collections(
  p_password text,
  p_collections jsonb
)
returns table (slug text, name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_hash text;
  collection_entry jsonb;
  clean_slug text;
  clean_name text;
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
    if clean_slug !~ '^[a-z0-9]+$'
      or clean_name = ''
      or char_length(clean_name) > 100
      or clean_slug = any(seen_slugs) then
      raise exception 'Invalid Fragment collection catalog entry';
    end if;
    seen_slugs := array_append(seen_slugs, clean_slug);

    insert into public.nft_collections as existing (slug, name)
    values (clean_slug, clean_name)
    on conflict on constraint nft_collections_slug_key do update
      set name = excluded.name
      where existing.name is distinct from excluded.name;
  end loop;

  return query
  select catalog.slug, catalog.name
  from public.nft_collections as catalog
  order by catalog.name;
end;
$$;

revoke all on function public.admin_sync_fragment_collections(text, jsonb) from public, anon, authenticated;
grant execute on function public.admin_sync_fragment_collections(text, jsonb) to service_role;

notify pgrst, 'reload schema';
