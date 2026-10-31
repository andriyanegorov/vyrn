create table if not exists public.case_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  cover_emoji text not null default '🎁',
  cover_url text,
  price_stars bigint not null check (price_stars > 0),
  prizes jsonb not null check (jsonb_typeof(prizes) = 'array' and jsonb_array_length(prizes) > 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.case_catalog add column if not exists cover_url text;
alter table public.case_catalog enable row level security;
revoke all on public.case_catalog from public, anon, authenticated;

with market_gifts (gift_key, name, collection_slug, collection_name, gift_number, market_gram) as (
  values
    ('icecream-191541', 'Ice Cream', 'icecream', 'Ice Creams', '191541', 5::numeric),
    ('icecream-100753', 'Ice Cream', 'icecream', 'Ice Creams', '100753', 5::numeric),
    ('icecream-92742', 'Ice Cream', 'icecream', 'Ice Creams', '92742', 5::numeric),
    ('icecream-117399', 'Ice Cream', 'icecream', 'Ice Creams', '117399', 5::numeric),
    ('icecream-289404', 'Ice Cream', 'icecream', 'Ice Creams', '289404', 5::numeric),
    ('icecream-278117', 'Ice Cream', 'icecream', 'Ice Creams', '278117', 5::numeric),
    ('icecream-303437', 'Ice Cream', 'icecream', 'Ice Creams', '303437', 5::numeric),
    ('icecream-206768', 'Ice Cream', 'icecream', 'Ice Creams', '206768', 5::numeric),
    ('starnotepad-8774', 'Star Notepad', 'starnotepad', 'Star Notepads', '8774', 5::numeric),
    ('starnotepad-11953', 'Star Notepad', 'starnotepad', 'Star Notepads', '11953', 6::numeric),
    ('starnotepad-4625', 'Star Notepad', 'starnotepad', 'Star Notepads', '4625', 6::numeric),
    ('starnotepad-51529', 'Star Notepad', 'starnotepad', 'Star Notepads', '51529', 6::numeric),
    ('starnotepad-67771', 'Star Notepad', 'starnotepad', 'Star Notepads', '67771', 6::numeric),
    ('starnotepad-53890', 'Star Notepad', 'starnotepad', 'Star Notepads', '53890', 6::numeric),
    ('starnotepad-45265', 'Star Notepad', 'starnotepad', 'Star Notepads', '45265', 6::numeric),
    ('starnotepad-40887', 'Star Notepad', 'starnotepad', 'Star Notepads', '40887', 6::numeric),
    ('bdaycandle-154712', 'B-Day Candle', 'bdaycandle', 'B-Day Candles', '154712', 6::numeric),
    ('bdaycandle-158980', 'B-Day Candle', 'bdaycandle', 'B-Day Candles', '158980', 6::numeric),
    ('bdaycandle-16418', 'B-Day Candle', 'bdaycandle', 'B-Day Candles', '16418', 6::numeric),
    ('bdaycandle-47355', 'B-Day Candle', 'bdaycandle', 'B-Day Candles', '47355', 6::numeric),
    ('bdaycandle-159906', 'B-Day Candle', 'bdaycandle', 'B-Day Candles', '159906', 6::numeric),
    ('bdaycandle-224065', 'B-Day Candle', 'bdaycandle', 'B-Day Candles', '224065', 6::numeric),
    ('bdaycandle-239408', 'B-Day Candle', 'bdaycandle', 'B-Day Candles', '239408', 6::numeric),
    ('bdaycandle-82987', 'B-Day Candle', 'bdaycandle', 'B-Day Candles', '82987', 6::numeric),
    ('jellybunny-36868', 'Jelly Bunny', 'jellybunny', 'Jelly Bunnies', '36868', 9::numeric),
    ('jellybunny-11745', 'Jelly Bunny', 'jellybunny', 'Jelly Bunnies', '11745', 10::numeric),
    ('jellybunny-31594', 'Jelly Bunny', 'jellybunny', 'Jelly Bunnies', '31594', 10::numeric),
    ('jellybunny-47181', 'Jelly Bunny', 'jellybunny', 'Jelly Bunnies', '47181', 10::numeric),
    ('jellybunny-53274', 'Jelly Bunny', 'jellybunny', 'Jelly Bunnies', '53274', 10::numeric),
    ('berrybox-29950', 'Berry Box', 'berrybox', 'Berry Boxes', '29950', 10::numeric),
    ('berrybox-43980', 'Berry Box', 'berrybox', 'Berry Boxes', '43980', 10::numeric),
    ('berrybox-15534', 'Berry Box', 'berrybox', 'Berry Boxes', '15534', 10::numeric),
    ('berrybox-26808', 'Berry Box', 'berrybox', 'Berry Boxes', '26808', 10::numeric),
    ('berrybox-27127', 'Berry Box', 'berrybox', 'Berry Boxes', '27127', 10::numeric),
    ('witchhat-4880', 'Witch Hat', 'witchhat', 'Witch Hats', '4880', 10::numeric),
    ('witchhat-51869', 'Witch Hat', 'witchhat', 'Witch Hats', '51869', 10::numeric),
    ('witchhat-1452', 'Witch Hat', 'witchhat', 'Witch Hats', '1452', 10::numeric),
    ('witchhat-30837', 'Witch Hat', 'witchhat', 'Witch Hats', '30837', 10::numeric),
    ('witchhat-3114', 'Witch Hat', 'witchhat', 'Witch Hats', '3114', 10::numeric),
    ('tophat-30452', 'Top Hat', 'tophat', 'Top Hats', '30452', 11::numeric),
    ('tophat-23409', 'Top Hat', 'tophat', 'Top Hats', '23409', 11::numeric),
    ('tophat-20131', 'Top Hat', 'tophat', 'Top Hats', '20131', 12::numeric),
    ('tophat-3910', 'Top Hat', 'tophat', 'Top Hats', '3910', 12::numeric),
    ('tophat-29225', 'Top Hat', 'tophat', 'Top Hats', '29225', 12::numeric),
    ('sleighbell-10550', 'Sleigh Bell', 'sleighbell', 'Sleigh Bells', '10550', 14::numeric),
    ('sleighbell-11712', 'Sleigh Bell', 'sleighbell', 'Sleigh Bells', '11712', 14::numeric),
    ('sleighbell-15770', 'Sleigh Bell', 'sleighbell', 'Sleigh Bells', '15770', 14::numeric),
    ('sleighbell-16705', 'Sleigh Bell', 'sleighbell', 'Sleigh Bells', '16705', 14::numeric),
    ('sleighbell-17069', 'Sleigh Bell', 'sleighbell', 'Sleigh Bells', '17069', 14::numeric),
    ('lovepotion-15594', 'Love Potion', 'lovepotion', 'Love Potions', '15594', 16::numeric),
    ('lovepotion-16347', 'Love Potion', 'lovepotion', 'Love Potions', '16347', 16::numeric),
    ('lovepotion-16688', 'Love Potion', 'lovepotion', 'Love Potions', '16688', 16::numeric),
    ('lovepotion-9740', 'Love Potion', 'lovepotion', 'Love Potions', '9740', 17::numeric),
    ('lovepotion-14462', 'Love Potion', 'lovepotion', 'Love Potions', '14462', 18::numeric),
    ('diamondring-9858', 'Diamond Ring', 'diamondring', 'Diamond Rings', '9858', 36::numeric),
    ('diamondring-26470', 'Diamond Ring', 'diamondring', 'Diamond Rings', '26470', 37::numeric),
    ('diamondring-9703', 'Diamond Ring', 'diamondring', 'Diamond Rings', '9703', 37::numeric),
    ('diamondring-11172', 'Diamond Ring', 'diamondring', 'Diamond Rings', '11172', 39::numeric),
    ('diamondring-1163', 'Diamond Ring', 'diamondring', 'Diamond Rings', '1163', 39::numeric),
    ('astralshard-4808', 'Astral Shard', 'astralshard', 'Astral Shards', '4808', 147::numeric),
    ('astralshard-3935', 'Astral Shard', 'astralshard', 'Astral Shards', '3935', 148::numeric),
    ('astralshard-1577', 'Astral Shard', 'astralshard', 'Astral Shards', '1577', 149::numeric),
    ('astralshard-5017', 'Astral Shard', 'astralshard', 'Astral Shards', '5017', 150::numeric),
    ('astralshard-1124', 'Astral Shard', 'astralshard', 'Astral Shards', '1124', 165::numeric),
    ('artisanbrick-5426', 'Artisan Brick', 'artisanbrick', 'Artisan Bricks', '5426', 85::numeric),
    ('artisanbrick-2601', 'Artisan Brick', 'artisanbrick', 'Artisan Bricks', '2601', 99::numeric),
    ('artisanbrick-2916', 'Artisan Brick', 'artisanbrick', 'Artisan Bricks', '2916', 99::numeric),
    ('artisanbrick-2504', 'Artisan Brick', 'artisanbrick', 'Artisan Bricks', '2504', 100::numeric),
    ('artisanbrick-3342', 'Artisan Brick', 'artisanbrick', 'Artisan Bricks', '3342', 104::numeric),
    ('heartlocket-416', 'Heart Locket', 'heartlocket', 'Heart Lockets', '416', 1444::numeric),
    ('heartlocket-1437', 'Heart Locket', 'heartlocket', 'Heart Lockets', '1437', 1700::numeric),
    ('heartlocket-290', 'Heart Locket', 'heartlocket', 'Heart Lockets', '290', 1775::numeric),
    ('heartlocket-1569', 'Heart Locket', 'heartlocket', 'Heart Lockets', '1569', 1777::numeric),
    ('heartlocket-626', 'Heart Locket', 'heartlocket', 'Heart Lockets', '626', 1778::numeric),
    ('plushpepe-2163', 'Plush Pepe', 'plushpepe', 'Plush Pepes', '2163', 7000::numeric),
    ('plushpepe-955', 'Plush Pepe', 'plushpepe', 'Plush Pepes', '955', 7800::numeric),
    ('plushpepe-203', 'Plush Pepe', 'plushpepe', 'Plush Pepes', '203', 8000::numeric),
    ('plushpepe-1392', 'Plush Pepe', 'plushpepe', 'Plush Pepes', '1392', 8900::numeric),
    ('plushpepe-2655', 'Plush Pepe', 'plushpepe', 'Plush Pepes', '2655', 8900::numeric)
),
case_definitions (slug, title, description, cover_emoji, price_stars, gift_keys) as (
  values
    ('crystal', 'Кристальный старт', 'Кристальные находки и редкие подарки.', '💎', 15,
      array['icecream-191541','starnotepad-8774','bdaycandle-154712','jellybunny-36868','berrybox-29950','tophat-30452','sleighbell-10550','lovepotion-15594','diamondring-9858','astralshard-4808']::text[]),
    ('sweet', 'Сладкий микс', 'Яркие подарки — от сладостей до редких реликвий.', '🍬', 20,
      array['icecream-100753','starnotepad-11953','bdaycandle-158980','jellybunny-11745','witchhat-4880','tophat-23409','sleighbell-11712','lovepotion-16347','diamondring-26470','artisanbrick-5426']::text[]),
    ('starlight', 'Звёздный бонус', 'Звёздные коллекции и шанс на дорогой подарок.', '🌌', 25,
      array['icecream-92742','starnotepad-4625','bdaycandle-16418','jellybunny-31594','berrybox-15534','tophat-20131','witchhat-1452','sleighbell-15770','astralshard-3935','heartlocket-416']::text[]),
    ('royal', 'Королевская коллекция', 'Королевские аксессуары и ценные NFT.', '👑', 28,
      array['icecream-117399','starnotepad-51529','bdaycandle-47355','jellybunny-47181','berrybox-26808','tophat-3910','witchhat-30837','lovepotion-16688','artisanbrick-2601','plushpepe-2163']::text[]),
    ('legendary', 'Первый джекпот', 'Легендарные подарки и первые крупные призы.', '🏆', 30,
      array['icecream-289404','starnotepad-67771','bdaycandle-159906','jellybunny-53274','berrybox-27127','tophat-29225','sleighbell-16705','lovepotion-9740','diamondring-9703','plushpepe-955']::text[]),
    ('ice-mix', 'Ледяной микс', 'Лёгкие подарки и призы с шансом на заметный плюс.', '❄️', 50,
      array['icecream-303437','starnotepad-8774','bdaycandle-224065','icecream-206768','starnotepad-11953','astralshard-4808','astralshard-3935','artisanbrick-5426','artisanbrick-2601','artisanbrick-2916']::text[]),
    ('berry-burst', 'Ягодный заряд', 'Собери сладкий микс с шансом на редкую находку.', '🍓', 55,
      array['icecream-278117','starnotepad-4625','bdaycandle-239408','icecream-191541','starnotepad-51529','astralshard-1577','astralshard-5017','astralshard-1124','artisanbrick-2504','artisanbrick-3342']::text[]),
    ('starry-night', 'Звёздная ночь', 'Знакомые коллекции и редкие звёздные подарки.', '⭐', 60,
      array['icecream-100753','starnotepad-67771','bdaycandle-82987','icecream-92742','starnotepad-53890','astralshard-4808','astralshard-1577','astralshard-1124','artisanbrick-2601','artisanbrick-3342']::text[]),
    ('winter-box', 'Зимняя шкатулка', 'Зимние и праздничные подарки с ценными призами.', '🔔', 65,
      array['icecream-289404','starnotepad-45265','bdaycandle-154712','icecream-278117','starnotepad-40887','astralshard-3935','astralshard-5017','astralshard-1124','artisanbrick-2504','artisanbrick-2916']::text[]),
    ('lucky-70', 'Большая удача', 'Десять разных подарков и редкий астральный шанс.', '🍀', 70,
      array['icecream-303437','starnotepad-11953','bdaycandle-158980','icecream-206768','starnotepad-4625','astralshard-4808','astralshard-3935','astralshard-1577','astralshard-5017','artisanbrick-2504']::text[]),
    ('aurora', 'Аврора', 'Мерцание повседневных подарков и шанс на редкие NFT.', '🌠', 70,
      array['icecream-191541','starnotepad-8774','bdaycandle-16418','icecream-100753','starnotepad-51529','astralshard-3935','astralshard-5017','astralshard-1124','artisanbrick-2504','artisanbrick-3342']::text[]),
    ('wish-casket', 'Шкатулка желаний', 'Праздничные призы и редкие подарки Fragment.', '🎁', 90,
      array['icecream-92742','starnotepad-11953','bdaycandle-47355','jellybunny-11745','berrybox-43980','astralshard-4808','astralshard-1124','heartlocket-416','heartlocket-1437','plushpepe-2163']::text[]),
    ('diamond-vault', 'Алмазный резерв', 'Смешай доступные подарки с ценными лотами.', '💠', 120,
      array['icecream-117399','starnotepad-4625','bdaycandle-159906','jellybunny-31594','berrybox-15534','astralshard-1124','heartlocket-290','heartlocket-1569','plushpepe-955','plushpepe-203']::text[]),
    ('astral-jackpot', 'Астральный джекпот', 'Простые призы и редкие NFT с высокой оценкой.', '🌌', 180,
      array['icecream-289404','starnotepad-67771','bdaycandle-224065','jellybunny-47181','berrybox-27127','heartlocket-416','heartlocket-1437','heartlocket-290','plushpepe-955','plushpepe-203']::text[]),
    ('vyrn-legend', 'Легендарный VYRN', 'Крупный кейс с разнообразными призами и редкими лотами.', '👑', 300,
      array['icecream-303437','starnotepad-8774','bdaycandle-154712','jellybunny-36868','diamondring-9858','heartlocket-626','heartlocket-1569','heartlocket-1437','plushpepe-2163','plushpepe-955']::text[])
),
prize_rows as (
  select
    cases.slug as case_slug,
    cases.title,
    cases.description,
    cases.cover_emoji,
    cases.price_stars,
    gifts.*,
    selected.position,
    round(gifts.market_gram / 10 * 8)::bigint as value_stars
  from case_definitions as cases
  cross join lateral unnest(cases.gift_keys) with ordinality as selected(gift_key, position)
  join market_gifts as gifts on gifts.gift_key = selected.gift_key
),
case_stats as (
  select
    case_slug,
    count(*) filter (where value_stars > price_stars) as profit_count,
    count(*) filter (where value_stars <= price_stars) as break_even_or_loss_count
  from prize_rows
  group by case_slug
),
grouped_prizes as (
  select
    prizes.*,
    stats.profit_count,
    stats.break_even_or_loss_count,
    value_stars > price_stars as is_profit,
    sum(1::numeric / value_stars) over (
      partition by case_slug, (value_stars > price_stars)
    ) as inverse_total,
    row_number() over (
      partition by case_slug, (value_stars > price_stars)
      order by value_stars, gift_key
    ) as prize_rank,
    case
      when stats.profit_count = 0 or stats.break_even_or_loss_count = 0 then 100000::bigint
      else 50000::bigint
    end as group_weight
  from prize_rows as prizes
  join case_stats as stats using (case_slug)
),
base_weights as (
  select
    grouped_prizes.*,
    floor(group_weight * (1::numeric / value_stars) / inverse_total)::bigint as base_weight
  from grouped_prizes
),
weighted_prizes as (
  select
    base_weights.*,
    base_weight + case
      when prize_rank = 1 then group_weight - sum(base_weight) over (
        partition by case_slug, is_profit
      )
      else 0
    end as weight
  from base_weights
),
catalog_prizes as (
  select
    case_slug,
    jsonb_agg(
      jsonb_build_object(
        'id', case_slug || '-' || gift_key,
        'name', name,
        'collection_slug', collection_slug,
        'collection_name', collection_name,
        'value_stars', value_stars,
        'weight', weight,
        'fragment_url', 'https://fragment.com/gift/' || collection_slug || '-' || gift_number,
        'preview_url', 'https://nft.fragment.com/gift/' || collection_slug || '-' || gift_number || '.webp',
        'animation_url', 'https://nft.fragment.com/gift/' || collection_slug || '-' || gift_number || '.tgs',
        'market_gram', market_gram,
        'market_checked_at', '2026-10-31'
      )
      order by position
    ) as prizes
  from weighted_prizes
  group by case_slug
)
insert into public.case_catalog (slug, title, description, cover_emoji, cover_url, price_stars, prizes, enabled)
select
  cases.slug,
  cases.title,
  cases.description,
  cases.cover_emoji,
  prizes.prizes->0->>'preview_url',
  cases.price_stars,
  prizes.prizes,
  true
from case_definitions as cases
join catalog_prizes as prizes on prizes.case_slug = cases.slug
on conflict (slug) do update
  set title = excluded.title,
      description = excluded.description,
      cover_emoji = excluded.cover_emoji,
      cover_url = excluded.cover_url,
      price_stars = excluded.price_stars,
      prizes = excluded.prizes,
      enabled = true,
      updated_at = now();

with normalized_prizes as (
  select
    catalog.id,
    jsonb_agg(
      (prize.value - 'emoji') || jsonb_build_object(
        'fragment_url',
        coalesce(
          nullif(prize.value->>'fragment_url', ''),
          'https://fragment.com/gift/' || (prize.value->>'collection_slug') || '-' ||
            coalesce(substring(prize.value->>'preview_url' from '/gift/[a-z0-9]+-(\d{1,12})\.webp$'), '1')
        ),
        'preview_url',
        case
          when prize.value->>'fragment_url' ~ '^https://fragment\.com/gift/[a-z0-9]+-\d{1,12}/?$'
            then 'https://nft.fragment.com/gift/' ||
              (prize.value->>'collection_slug') || '-' ||
              substring(prize.value->>'fragment_url' from '([0-9]{1,12})/?$') || '.webp'
          else coalesce(
            nullif(prize.value->>'preview_url', ''),
            'https://nft.fragment.com/gift/' || (prize.value->>'collection_slug') || '-1.webp'
          )
        end,
        'animation_url',
        case
          when prize.value->>'fragment_url' ~ '^https://fragment\.com/gift/[a-z0-9]+-\d{1,12}/?$'
            then 'https://nft.fragment.com/gift/' ||
              (prize.value->>'collection_slug') || '-' ||
              substring(prize.value->>'fragment_url' from '([0-9]{1,12})/?$') || '.tgs'
          else coalesce(
            nullif(prize.value->>'animation_url', ''),
            'https://nft.fragment.com/gift/' || (prize.value->>'collection_slug') || '-1.tgs'
          )
        end
      ) order by prize.position
    ) as prizes
  from public.case_catalog as catalog
  cross join lateral jsonb_array_elements(catalog.prizes)
    with ordinality as prize(value, position)
  group by catalog.id
)
update public.case_catalog as catalog
set prizes = normalized.prizes,
    cover_url = coalesce(normalized.prizes->0->>'preview_url', catalog.cover_url)
from normalized_prizes as normalized
where catalog.id = normalized.id;

create or replace function public.open_case(p_profile_id uuid, p_case_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case public.case_catalog%rowtype;
  v_wallet_id uuid;
  v_balance bigint;
  v_total_weight bigint;
  v_roll bigint;
  v_prize jsonb;
  v_collection_id uuid;
  v_model_id uuid;
  v_item_id uuid;
  v_gift_number text;
  v_random_bytes bytea;
  v_attempt integer;
begin
  perform 1 from public.profiles where id = p_profile_id for update;
  if not found then
    raise exception 'Player not found';
  end if;

  select * into v_case
  from public.case_catalog
  where id = p_case_id and enabled = true
  for share;
  if not found then
    raise exception 'Case not found or unavailable';
  end if;

  select wallet.id, wallet.balance into v_wallet_id, v_balance
  from public.wallets as wallet
  where wallet.profile_id = p_profile_id and wallet.currency = 'stars'
  for update;
  if not found then
    raise exception 'Stars wallet not found';
  end if;
  if v_balance < v_case.price_stars then
    raise exception 'Insufficient Stars balance';
  end if;

  select sum((entry.value->>'weight')::bigint) into v_total_weight
  from jsonb_array_elements(v_case.prizes) as entry(value);
  if v_total_weight is null or v_total_weight <= 0 then
    raise exception 'Case has no valid prizes';
  end if;

  v_random_bytes := extensions.gen_random_bytes(4);
  v_roll := (
    (pg_catalog.get_byte(v_random_bytes, 0)::bigint << 24)
    | (pg_catalog.get_byte(v_random_bytes, 1)::bigint << 16)
    | (pg_catalog.get_byte(v_random_bytes, 2)::bigint << 8)
    | pg_catalog.get_byte(v_random_bytes, 3)::bigint
  ) % v_total_weight;

  select entry.value into v_prize
  from jsonb_array_elements(v_case.prizes) with ordinality as entry(value, position)
  where (
    select coalesce(sum((previous.value->>'weight')::bigint), 0)
    from jsonb_array_elements(v_case.prizes) with ordinality as previous(value, position)
    where previous.position < entry.position
  ) <= v_roll
    and v_roll < (
      select coalesce(sum((previous.value->>'weight')::bigint), 0)
      from jsonb_array_elements(v_case.prizes) with ordinality as previous(value, position)
      where previous.position <= entry.position
    )
  limit 1;
  if v_prize is null then
    raise exception 'Could not select a case prize';
  end if;

  insert into public.nft_collections (slug, name)
  values (v_prize->>'collection_slug', v_prize->>'collection_name')
  on conflict (slug) do update set name = excluded.name
  returning id into v_collection_id;

  for v_attempt in 1..20 loop
    v_random_bytes := extensions.gen_random_bytes(4);
    v_gift_number := (
      1000 + (
        (
          (pg_catalog.get_byte(v_random_bytes, 0)::bigint << 24)
          | (pg_catalog.get_byte(v_random_bytes, 1)::bigint << 16)
          | (pg_catalog.get_byte(v_random_bytes, 2)::bigint << 8)
          | pg_catalog.get_byte(v_random_bytes, 3)::bigint
        ) % 90000
      )
    )::text;
    begin
      insert into public.nft_models (collection_id, slug, name, preview_url, animation_url)
      values (
        v_collection_id,
        'case-' || v_case.slug || '-' || (v_prize->>'id') || '-' || v_gift_number,
        v_prize->>'name',
        coalesce(
          nullif(v_prize->>'preview_url', ''),
          'https://nft.fragment.com/gift/' || (v_prize->>'collection_slug') || '-' || v_gift_number || '.webp'
        ),
        coalesce(
          nullif(v_prize->>'animation_url', ''),
          'https://nft.fragment.com/gift/' || (v_prize->>'collection_slug') || '-' || v_gift_number || '.tgs'
        )
      )
      on conflict (collection_id, slug) do update
        set name = excluded.name,
            preview_url = excluded.preview_url,
            animation_url = excluded.animation_url
      returning id into v_model_id;

      insert into public.nft_items (model_id, external_id, owner_profile_id, attributes)
      values (
        v_model_id,
        v_gift_number,
        p_profile_id,
        jsonb_build_object(
          'custom_nft', true,
          'case_reward', true,
          'starter_gift', false,
          'case_id', v_case.id,
          'value_stars', (v_prize->>'value_stars')::bigint,
          'custom_price_stars', (v_prize->>'value_stars')::bigint
        )
      )
      returning id into v_item_id;
      exit;
    exception when unique_violation then
      if v_attempt = 20 then raise; end if;
    end;
  end loop;

  insert into public.nft_transfers (nft_item_id, from_profile_id, to_profile_id, transfer_type)
  values (v_item_id, null, p_profile_id, 'mint');

  update public.wallets
  set balance = balance - v_case.price_stars, updated_at = now()
  where id = v_wallet_id
  returning balance into v_balance;
  insert into public.wallet_transactions (wallet_id, amount, reason, reference_id)
  values (v_wallet_id, -v_case.price_stars, 'case_open', v_item_id);

  return jsonb_build_object(
    'case_id', v_case.id,
    'prize_id', v_prize->>'id',
    'item_id', v_item_id,
    'name', v_prize->>'name',
    'collection_name', v_prize->>'collection_name',
    'collection_slug', v_prize->>'collection_slug',
    'gift_number', v_gift_number,
    'value_stars', (v_prize->>'value_stars')::bigint,
    'preview_url', coalesce(
      nullif(v_prize->>'preview_url', ''),
      'https://nft.fragment.com/gift/' || (v_prize->>'collection_slug') || '-' || v_gift_number || '.webp'
    ),
    'balance', v_balance
  );
end;
$$;

revoke all on function public.open_case(uuid, uuid) from public, anon, authenticated;
grant execute on function public.open_case(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
