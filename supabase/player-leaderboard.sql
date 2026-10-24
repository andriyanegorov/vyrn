create index if not exists nft_items_owner_profile_id_idx
  on public.nft_items(owner_profile_id);

create or replace function public.get_player_leaderboard(p_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with profile_stats as (
    select
      profiles.id,
      profiles.telegram_id,
      profiles.nickname,
      profiles.username,
      profiles.first_name,
      profiles.last_name,
      profiles.avatar_url,
      profiles.created_at,
      profiles.show_on_top,
      coalesce(stars_wallet.balance, 0)::numeric as stars_balance,
      coalesce(sum(
        coalesce(
          case
            when length(items.attributes ->> 'fragment_price_fragment_stars') <= 32
              and items.attributes ->> 'fragment_price_fragment_stars' ~ '^[0-9]+(\.[0-9]+)?$'
              then nullif((items.attributes ->> 'fragment_price_fragment_stars')::numeric, 0)
          end,
          case
            when coalesce(items.attributes ->> 'fragment_price_manual', 'false') <> 'true'
              and coalesce(items.attributes ->> 'fragment_price_crafted_total', 'false') <> 'true'
              and length(items.attributes ->> 'fragment_price_stars') <= 32
              and items.attributes ->> 'fragment_price_stars' ~ '^[0-9]+(\.[0-9]+)?$'
              then nullif((items.attributes ->> 'fragment_price_stars')::numeric, 0)
          end,
          0::numeric
        )
      ), 0::numeric) as collection_value
    from public.profiles as profiles
    left join public.wallets as stars_wallet
      on stars_wallet.profile_id = profiles.id
      and stars_wallet.currency = 'stars'
    left join public.nft_items as items
      on items.owner_profile_id = profiles.id
    group by profiles.id, stars_wallet.balance
  ),
  ranked_players as (
    select
      profile_stats.*,
      row_number() over (
        order by profile_stats.collection_value desc, profile_stats.created_at asc, profile_stats.id asc
      ) as value_rank,
      row_number() over (
        order by profile_stats.stars_balance desc, profile_stats.created_at asc, profile_stats.id asc
      ) as stars_rank
    from profile_stats
    where profile_stats.telegram_id is not null
      and profile_stats.show_on_top is distinct from false
  ),
  current_player as (
    select
      profile_stats.*,
      coalesce(ranked_players.value_rank, (
        select count(*) + 1
        from ranked_players as preceding_players
        where preceding_players.collection_value > profile_stats.collection_value
          or (
            preceding_players.collection_value = profile_stats.collection_value
            and (preceding_players.created_at, preceding_players.id) < (profile_stats.created_at, profile_stats.id)
          )
      )) as value_rank,
      coalesce(ranked_players.stars_rank, (
        select count(*) + 1
        from ranked_players as preceding_players
        where preceding_players.stars_balance > profile_stats.stars_balance
          or (
            preceding_players.stars_balance = profile_stats.stars_balance
            and (preceding_players.created_at, preceding_players.id) < (profile_stats.created_at, profile_stats.id)
          )
      )) as stars_rank
    from profile_stats
    left join ranked_players on ranked_players.id = profile_stats.id
    where profile_stats.id = p_profile_id
      and profile_stats.show_on_top is distinct from false
  )
  select jsonb_build_object(
    'players_value',
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ranked_players.id,
        'rank', ranked_players.value_rank,
        'nickname', ranked_players.nickname,
        'username', ranked_players.username,
        'first_name', ranked_players.first_name,
        'last_name', ranked_players.last_name,
        'avatar_url', ranked_players.avatar_url,
        'value', ranked_players.collection_value::text,
        'stars', ranked_players.stars_balance::text
      ) order by ranked_players.value_rank)
      from ranked_players
      where ranked_players.value_rank <= 15
    ), '[]'::jsonb),
    'players_stars',
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ranked_players.id,
        'rank', ranked_players.stars_rank,
        'nickname', ranked_players.nickname,
        'username', ranked_players.username,
        'first_name', ranked_players.first_name,
        'last_name', ranked_players.last_name,
        'avatar_url', ranked_players.avatar_url,
        'value', ranked_players.collection_value::text,
        'stars', ranked_players.stars_balance::text
      ) order by ranked_players.stars_rank)
      from ranked_players
      where ranked_players.stars_rank <= 15
    ), '[]'::jsonb),
    'current_player',
    (select jsonb_build_object(
      'id', current_player.id,
      'nickname', current_player.nickname,
      'username', current_player.username,
      'first_name', current_player.first_name,
      'last_name', current_player.last_name,
      'avatar_url', current_player.avatar_url,
      'value', current_player.collection_value::text,
      'stars', current_player.stars_balance::text,
      'value_rank', current_player.value_rank,
      'stars_rank', current_player.stars_rank
    ) from current_player)
  );
$$;

revoke all on function public.get_player_leaderboard(uuid) from public, anon, authenticated;
grant execute on function public.get_player_leaderboard(uuid) to service_role;
