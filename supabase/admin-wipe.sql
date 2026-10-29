create or replace function public.admin_wipe_project(
  p_password text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_hash text;
  table_name text;
  deleted_count bigint;
  deletion_counts jsonb := '{}'::jsonb;
begin
  select settings.password_hash into configured_hash
  from public.admin_settings as settings
  where settings.singleton = true;

  if configured_hash is null or p_password is null
    or extensions.crypt(p_password, configured_hash) <> configured_hash then
    raise exception 'Invalid administrator password' using errcode = '28000';
  end if;
  if p_confirmation is distinct from 'СБРОСИТЬ ДАННЫЕ ИГРОКОВ' then
    raise exception 'Type СБРОСИТЬ ДАННЫЕ ИГРОКОВ to confirm the player data wipe';
  end if;

  if to_regclass('public.promo_codes') is not null then
    execute 'delete from public.promo_codes where redeemed_by is not null';
    get diagnostics deleted_count = row_count;
    deletion_counts := deletion_counts || pg_catalog.jsonb_build_object('redeemed_promo_codes', deleted_count);
  end if;

  for table_name in
    select table_names.name
    from unnest(array[
      'saved_messages',
      'messages',
      'nft_gift_responses',
      'nft_gift_offers',
      'chat_members',
      'chats',
      'market_transactions',
      'market_listings',
      'nft_transfers',
      'nft_auto_sales',
      'starter_gift_claims',
      'starter_gift_demo_claims',
      'anonymous_numbers',
      'promo_code_attempts',
      'daily_task_completions',
      'daily_task_events',
      'referral_attributions',
      'referral_codes',
      'telegram_star_topups',
      'telegram_premium_orders',
      'wallet_transactions',
      'wallets',
      'nft_items',
      'profiles'
    ]) with ordinality as table_names(name, position)
    order by table_names.position
  loop
    if to_regclass(pg_catalog.format('public.%I', table_name)) is not null then
      execute pg_catalog.format('delete from public.%I where true', table_name);
      get diagnostics deleted_count = row_count;
      deletion_counts := deletion_counts || pg_catalog.jsonb_build_object(table_name, deleted_count);
    end if;
  end loop;

  return deletion_counts;
end;
$$;

revoke all on function public.admin_wipe_project(text, text) from public, anon, authenticated;
grant execute on function public.admin_wipe_project(text, text) to anon;

notify pgrst, 'reload schema';
