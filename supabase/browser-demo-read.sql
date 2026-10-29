insert into public.profiles (telegram_id, nickname, first_name, last_name)
values (0, 'browser000000', 'Browser', 'Player')
on conflict (telegram_id) do nothing;

insert into public.wallets (profile_id, currency, balance)
select profiles.id, currencies.currency, 0
from public.profiles
cross join (values ('stars'), ('ton')) as currencies(currency)
where profiles.telegram_id = 0
on conflict (profile_id, currency) do nothing;

alter table public.profiles enable row level security;
revoke select (id, telegram_id, nickname, username, first_name, last_name, avatar_url, bio)
	on public.profiles from anon;
drop policy if exists profiles_browser_demo_read on public.profiles;

drop view if exists public.browser_demo_profile;
create view public.browser_demo_profile with (security_barrier = true) as
select profiles.id, profiles.telegram_id, profiles.nickname, profiles.username,
	profiles.first_name, profiles.last_name, profiles.avatar_url, profiles.bio,
	coalesce(stars_wallet.balance, 0) as stars_balance
from public.profiles
left join public.wallets as stars_wallet
	on stars_wallet.profile_id = profiles.id and stars_wallet.currency = 'stars'
where profiles.telegram_id = 0;

revoke all on public.browser_demo_profile from public, anon, authenticated;
grant select on public.browser_demo_profile to anon;

drop view if exists public.browser_demo_nfts;
create view public.browser_demo_nfts with (security_barrier = true) as
select items.id as item_id, items.external_id, items.attributes, items.acquired_at,
	models.id as model_id, models.slug as model_slug, models.name as model_name,
	case when items.attributes->>'custom_nft' = 'true'
		then models.preview_url
		else 'https://nft.fragment.com/gift/' || collections.slug || '-' || items.external_id || '.webp'
	end as preview_url,
	case when items.attributes->>'custom_nft' = 'true'
		then models.animation_url
		else 'https://nft.fragment.com/gift/' || collections.slug || '-' || items.external_id || '.tgs'
	end as animation_url,
	collections.name as collection_name, collections.slug as collection_slug,
	listings.id as listing_id, listings.price as listing_price,
	listings.currency as listing_currency, listings.status as listing_status
from public.nft_items as items
join public.profiles as owners on owners.id = items.owner_profile_id
join public.nft_models as models on models.id = items.model_id
join public.nft_collections as collections on collections.id = models.collection_id
left join public.market_listings as listings
	on listings.nft_item_id = items.id and listings.status = 'active'
where owners.telegram_id = 0;

revoke all on public.browser_demo_nfts from public, anon, authenticated;
grant select on public.browser_demo_nfts to anon;

notify pgrst, 'reload schema';
