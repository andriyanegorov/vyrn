import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

type FragmentCollection = { slug: string; name: string };
type FragmentGift = FragmentCollection & { number: string };
type FragmentTrait = { name: string; rarity_percent: number | null };
type FragmentTraits = Partial<Record<'model' | 'backdrop' | 'symbol', FragmentTrait>>;
type PricedGift = FragmentGift & {
  grams: number;
  price_stars: number;
  fragment_traits: FragmentTraits;
};
type FragmentFilter = 'sale' | 'auction';

const shuffle = <T>(values: T[]) => {
  for (let index = values.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
};

const randomInteger = (minimum: number, maximum: number) => {
  const range = maximum - minimum + 1;
  const sampleSpace = 2 ** 53;
  const limit = Math.floor(sampleSpace / range) * range;
  let sample: number;
  do {
    const values = crypto.getRandomValues(new Uint32Array(2));
    sample = (values[0] & 0x1fffff) * 2 ** 32 + values[1];
  } while (sample >= limit);
  return minimum + (sample % range);
};

const mapLimit = async <T, R>(values: T[], limit: number, mapper: (value: T) => Promise<R>) => {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await mapper(values[index]);
    }
  }));
  return results;
};

const getAttribute = (attributes: string, name: string) =>
  attributes.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1]
    ?.replace(/&amp;/gi, '&') || '';

const readFragmentListings = (html: string, filter: FragmentFilter, collectionNames: Map<string, string>) => {
  const gifts: FragmentGift[] = [];
  const cards = html.matchAll(/<a\b([^>]*\bclass=["'][^"']*\btm-grid-item\b[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi);
  for (const [, attributes, contents] of cards) {
    const href = getAttribute(attributes, 'href').replace(/\\\//g, '/');
    let path: string;
    try {
      path = new URL(href, 'https://fragment.com').pathname;
    } catch {
      continue;
    }
    const match = path.match(/^\/gift\/([a-z0-9]+)-(\d{1,12})$/);
    if (!match || Number(match[2]) <= 0) continue;
    const statusHtml = contents.match(/<div\b[^>]*\bclass=["'][^"']*\btm-grid-item-status\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '';
    const statusWide = statusHtml.match(/<span\b[^>]*\bclass=["'][^"']*\bwide-only\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || statusHtml;
    const status = statusWide.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    if ((filter === 'sale' && status !== 'for sale') || (filter === 'auction' && status !== 'on auction')) continue;
    gifts.push({
      slug: match[1],
      name: collectionNames.get(match[1]) || match[1],
      number: match[2],
    });
  }
  return gifts;
};

const extractNextOffset = (html: string) => {
  const nextOffset = html.match(/data-next-offset=["'](\d+)["']/i)?.[1];
  return nextOffset ? Number(nextOffset) : null;
};

const fetchFragmentListings = async (
  filter: FragmentFilter,
  collectionSlug: string,
  collectionNames: Map<string, string>,
) => {
  const params = new URLSearchParams();
  if (collectionSlug) params.set('collection', collectionSlug);
  params.set('filter', filter);
  if (filter === 'auction') params.set('sort', 'price_asc');
  const pageUrl = `https://fragment.com/gifts?${params.toString()}`;
  const headers = { 'User-Agent': 'Mozilla/5.0 VYRN Fragment random gift reader' };
  const pageResponse = await fetch(pageUrl, {
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  if (!pageResponse.ok) throw new Error(`Fragment returned HTTP ${pageResponse.status}.`);
  const contentLength = Number(pageResponse.headers.get('content-length') || 0);
  if (contentLength > 8_000_000) throw new Error('Ответ Fragment слишком большой.');
  const pageHtml = await pageResponse.text();
  if (pageHtml.length > 8_000_000) throw new Error('Ответ Fragment слишком большой.');

  const apiConfig = pageHtml.match(/ajInit\((\{[\s\S]*?\})\);/i)?.[1];
  if (!apiConfig) throw new Error('Fragment не вернул адрес поиска объявлений.');
  let apiUrl: URL;
  try {
    const config = JSON.parse(apiConfig);
    apiUrl = new URL(String(config.apiUrl).replace(/\\\//g, '/'), 'https://fragment.com');
  } catch {
    throw new Error('Fragment вернул некорректный адрес поиска объявлений.');
  }
  if (apiUrl.origin !== 'https://fragment.com' || apiUrl.pathname !== '/api') {
    throw new Error('Fragment вернул небезопасный адрес поиска объявлений.');
  }

  const gifts = readFragmentListings(pageHtml, filter, collectionNames);
  let nextOffset = extractNextOffset(pageHtml);
  const cookie = pageResponse.headers.get('set-cookie')?.split(';')[0];
  let pagesLoaded = 1;
  while (nextOffset !== null && pagesLoaded < 30) {
    const body = new URLSearchParams({
      type: 'gifts',
      collection: collectionSlug,
      sort: filter === 'auction' ? 'price_asc' : '',
      filter,
      view: '',
      query: '',
      offset_id: String(nextOffset),
      method: 'searchAuctions',
    });
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Origin: 'https://fragment.com',
        Referer: pageUrl,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Fragment returned HTTP ${response.status} while loading listings.`);
    const result = await response.json().catch(() => null);
    if (result?.ok !== true || typeof result.body !== 'string' || typeof result.foot !== 'string') {
      throw new Error('Fragment вернул некорректный список объявлений.');
    }
    if (result.body.length > 8_000_000 || result.foot.length > 100_000) {
      throw new Error('Ответ Fragment слишком большой.');
    }
    gifts.push(...readFragmentListings(result.body, filter, collectionNames));
    const followingOffset = extractNextOffset(result.foot);
    nextOffset = followingOffset !== null && followingOffset > nextOffset ? followingOffset : null;
    pagesLoaded++;
  }
  return gifts;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Некорректный JSON-запрос.' }, 400);
  }

  const password = typeof input.password === 'string' ? input.password : '';
  const mode = input.mode;
  const profileId = typeof input.profile_id === 'string' ? input.profile_id : null;
  const fragmentFilter = input.fragment_filter === undefined ? 'sale' : input.fragment_filter;
  const minStars = Number(input.min_stars);
  const maxStars = Number(input.max_stars);
  const quantity = Number(input.quantity);
  const collectionSlug = typeof input.collection_slug === 'string'
    ? input.collection_slug.trim().toLowerCase()
    : '';

  if (!password || password.length > 256
    || (mode !== 'market' && mode !== 'player')
    || (fragmentFilter !== 'sale' && fragmentFilter !== 'auction' && fragmentFilter !== 'both')
    || (mode === 'player' && !profileId)
    || !Number.isSafeInteger(minStars) || minStars < 1
    || !Number.isSafeInteger(maxStars) || maxStars < minStars
    || !Number.isInteger(quantity) || quantity < 1 || quantity > 30
    || (collectionSlug && !/^[a-z0-9]+$/.test(collectionSlug))) {
    return json({ error: 'Проверь диапазон Stars, количество NFT, режим и выбранную коллекцию.' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    || Deno.env.get('VYRN_SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server is not configured' }, 500);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const verified = await supabase.rpc('admin_verify_password', { p_password: password });
  if (verified.error) {
    const missingFunction = verified.error.code === 'PGRST202' || verified.error.code === '42883';
    return json({
      error: missingFunction
        ? 'Функции массовой публикации не настроены. Примените обновлённый supabase/admin-panel.sql.'
        : verified.error.message,
    }, missingFunction ? 503 : 500);
  }
  if (verified.data !== true) return json({ error: 'Неверный пароль администратора.' }, 401);

  const catalogResult = await supabase.from('nft_collections')
    .select('slug,name').order('slug').limit(500);
  if (catalogResult.error) return json({ error: catalogResult.error.message }, 500);
  const allCollections = catalogResult.data as FragmentCollection[];
  const selectedCollection = collectionSlug
    ? allCollections.find((collection) => collection.slug === collectionSlug)
    : null;
  if (collectionSlug && !selectedCollection) {
    return json({
      error: 'Коллекция не найдена в каталоге. Сначала обнови каталог Fragment в админ-панели.',
    }, 404);
  }
  if (!allCollections.length) {
    return json({ error: 'Каталог коллекций пуст. Сначала обнови каталог Fragment в админ-панели.' }, 404);
  }

  const collectionNames = new Map(allCollections.map((collection) => [collection.slug, collection.name]));
  const filters: FragmentFilter[] = fragmentFilter === 'both' ? ['sale', 'auction'] : [fragmentFilter];
  const listingFailures: string[] = [];
  const listingsByFilter = await Promise.all(filters.map(async (filter) => {
    try {
      return await fetchFragmentListings(filter, collectionSlug, collectionNames);
    } catch (error) {
      listingFailures.push(`${filter}: ${error instanceof Error ? error.message : 'ошибка загрузки'}`);
      return [];
    }
  }));
  const uniqueCandidates = shuffle([...new Map(
    listingsByFilter.flat().map((gift) => [`${gift.slug}-${gift.number}`, gift]),
  ).values()]).slice(0, 360);
  if (!uniqueCandidates.length) {
    return json({
      error: listingFailures.length
        ? `Не удалось загрузить объявления Fragment: ${listingFailures.join('; ')}`
        : 'Fragment не вернул активных объявлений с выбранным фильтром и коллекцией.',
      listing_failures: listingFailures,
    }, 502);
  }

  const existingResult = await supabase.from('nft_items')
    .select('external_id,nft_models!inner(nft_collections!inner(slug))')
    .in('external_id', [...new Set(uniqueCandidates.map((gift) => gift.number))])
    .in('nft_models.nft_collections.slug', [...new Set(uniqueCandidates.map((gift) => gift.slug))]);
  if (existingResult.error) return json({ error: existingResult.error.message }, 500);
  const existingRows = existingResult.data as Array<{
    external_id: string;
    nft_models: { nft_collections: { slug: string } };
  }>;
  const existingGifts = new Set(existingRows.map((item) => `${item.nft_models.nft_collections.slug}-${item.external_id}`));
  const newCandidates = uniqueCandidates.filter((gift) => !existingGifts.has(`${gift.slug}-${gift.number}`));

  const pricedGifts: PricedGift[] = [];
  let priceFailures = 0;
  let checkedCount = 0;
  for (let start = 0; start < newCandidates.length && pricedGifts.length < quantity; start += 24) {
    const batch = newCandidates.slice(start, start + 24);
    checkedCount += batch.length;
    const results = await mapLimit(batch, 8, async (gift): Promise<PricedGift | null> => {
      try {
        const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/fragment-price`, {
          method: 'POST',
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ collection_slug: gift.slug, gift_number: gift.number }),
          signal: AbortSignal.timeout(15_000),
        });
        const price = await response.json().catch(() => null);
        if (!response.ok
          || typeof price?.grams !== 'number' || !Number.isFinite(price.grams) || price.grams <= 0
          || typeof price?.stars !== 'number' || !Number.isSafeInteger(price.stars)
          || price.stars !== Math.max(1, Math.round(price.grams / 10 * 80))) {
          priceFailures++;
          return null;
        }
        if (mode === 'player' && (price.stars < minStars || price.stars > maxStars)) return null;
        const traits = price.traits && typeof price.traits === 'object' && !Array.isArray(price.traits)
          ? price.traits as FragmentTraits
          : {};
        return { ...gift, grams: price.grams, price_stars: price.stars, fragment_traits: traits };
      } catch {
        priceFailures++;
        return null;
      }
    });
    pricedGifts.push(...results.filter((gift): gift is PricedGift => gift !== null));
  }

  if (pricedGifts.length < quantity) {
    return json({
      error: mode === 'market'
        ? `Среди ${checkedCount} новых активных объявлений Fragment найдено только ${pricedGifts.length} NFT с доступной ценой Fragment (запрошено ${quantity}). Для ${priceFailures} объявлений не удалось получить цену. Ничего не опубликовано; попробуй выбрать другой фильтр или коллекцию.`
        : `Среди ${checkedCount} новых активных объявлений Fragment только ${pricedGifts.length} NFT попали в диапазон ${minStars}–${maxStars} Stars (запрошено ${quantity}). Для ${priceFailures} объявлений не удалось получить цену. Ничего не опубликовано; попробуй расширить диапазон или выбрать другую коллекцию.`,
      listing_failures: listingFailures,
      price_failures: priceFailures,
    }, 404);
  }

  const shuffledPricedGifts = shuffle([...pricedGifts]);
  const selectedGifts: PricedGift[] = [];
  if (!collectionSlug) {
    const includedCollections = new Set<string>();
    for (const gift of shuffledPricedGifts) {
      if (includedCollections.has(gift.slug)) continue;
      includedCollections.add(gift.slug);
      selectedGifts.push(gift);
      if (selectedGifts.length === quantity) break;
    }
  }
  if (selectedGifts.length < quantity) {
    const includedGifts = new Set(selectedGifts.map((gift) => `${gift.slug}-${gift.number}`));
    selectedGifts.push(...shuffledPricedGifts
      .filter((gift) => !includedGifts.has(`${gift.slug}-${gift.number}`))
      .slice(0, quantity - selectedGifts.length));
  }
  const published = await supabase.rpc('admin_publish_random_fragment_gifts', {
    p_password: password,
    p_profile_id: mode === 'player' ? profileId : null,
    p_to_market: mode === 'market',
    p_gifts: selectedGifts.map((gift) => ({
      slug: gift.slug,
      name: gift.name,
      number: gift.number,
      grams: gift.grams,
      price_stars: gift.price_stars,
      fragment_traits: gift.fragment_traits,
      market_price_stars: mode === 'market' ? randomInteger(minStars, maxStars) : null,
    })),
  });
  if (published.error) {
    const missingFunction = published.error.code === 'PGRST202' || published.error.code === '42883';
    return json({
      error: missingFunction
        ? 'Функция массовой публикации не настроена. Примените обновлённый supabase/admin-panel.sql.'
        : published.error.message,
    }, missingFunction ? 503 : 409);
  }

  return json({
    items: published.data,
    listing_failures: listingFailures,
    price_failures: priceFailures,
  });
});
