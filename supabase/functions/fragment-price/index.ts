const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const decodeHtml = (value: string) => value
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&#(\d+);/g, (entity, code: string) => {
    const point = Number(code);
    return point <= 0x10ffff ? String.fromCodePoint(point) : entity;
  });

const readFragmentGift = (html: string) => {
  const priceField = html.match(/id=["']bid_value["'][^>]*value=["']([^"']+)["']/i)
    || html.match(/value=["']([^"']+)["'][^>]*id=["']bid_value["']/i);
  const rawPrice = priceField?.[1]?.replace(/,/g, '').trim() || '';
  const grams = Number(rawPrice);

  const traits: Record<string, { name: string; rarity_percent: number | null }> = {};
  for (const [, row] of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const label = row.match(/class=["'][^"']*\btable-cell\b[^"']*["'][^>]*>\s*([^<]+)\s*</i)?.[1]?.trim().toLowerCase();
    if (!label || !['model', 'backdrop', 'symbol'].includes(label)) continue;
    const rawName = row.match(/class=["'][^"']*\btable-cell-value-link\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1];
    if (!rawName) continue;
    const name = decodeHtml(rawName.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
    const rawRarity = row.match(/class=["'][^"']*\btm-rarity\b[^"']*["'][^>]*>\s*([\d.,]+)\s*%/i)?.[1];
    const rarity = rawRarity ? Number(rawRarity.replace(',', '.')) : NaN;
    traits[label] = { name, rarity_percent: Number.isFinite(rarity) ? rarity : null };
  }

  return { grams: Number.isFinite(grams) && grams > 0 ? grams : null, traits };
};

const fetchFragmentGift = async (slug: string, number: string) => {
  const response = await fetch(`https://fragment.com/gift/${slug}-${number}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 VYRN Fragment price reader' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Fragment returned ${response.status}`);
  const gift = readFragmentGift(await response.text());
  if (gift === null || gift.grams === null) throw new Error('Цена этого подарка не найдена на Fragment.');
  return {
    grams: gift.grams,
    stars: Math.max(1, Math.round(gift.grams / 10 * 80)),
    traits: gift.traits,
  };
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (Array.isArray(input.gifts)) {
    if (input.gifts.length < 1 || input.gifts.length > 40) {
      return json({ error: 'Batch must contain between 1 and 40 Fragment gifts.' }, 400);
    }
    const gifts = input.gifts.map((entry) => {
      const gift = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
      const slug = typeof gift.collection_slug === 'string' ? gift.collection_slug.trim().toLowerCase() : '';
      const number = typeof gift.gift_number === 'string'
        ? gift.gift_number.trim()
        : String(gift.gift_number || '').trim();
      return { slug, number };
    });
    if (gifts.some(({ slug, number }) =>
      !/^[a-z0-9]+$/.test(slug) || !/^\d{1,12}$/.test(number) || Number(number) <= 0)) {
      return json({ error: 'Invalid Fragment gift collection or number in batch.' }, 400);
    }

    const items = await mapLimit(gifts, 8, async ({ slug, number }) => {
      try {
        const details = await fetchFragmentGift(slug, number);
        return {
          collection_slug: slug,
          gift_number: number,
          grams: details.grams,
          stars: details.stars,
          traits: details.traits,
        };
      } catch (error) {
        return {
          collection_slug: slug,
          gift_number: number,
          error: error instanceof Error ? error.message : 'Не удалось загрузить атрибуты Fragment.',
        };
      }
    });
    return json({ items });
  }

  const slug = typeof input.collection_slug === 'string' ? input.collection_slug.trim().toLowerCase() : '';
  const number = typeof input.gift_number === 'string' ? input.gift_number.trim() : String(input.gift_number || '').trim();
  if (!/^[a-z0-9]+$/.test(slug) || !/^\d{1,12}$/.test(number) || Number(number) <= 0) {
    return json({ error: 'Invalid Fragment gift collection or number' }, 400);
  }

  try {
    return json(await fetchFragmentGift(slug, number));
  } catch {
    return json({ error: 'Не удалось получить цену Fragment.' }, 502);
  }
});
