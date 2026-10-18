const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const readFragmentPrice = (html: string) => {
  const priceField = html.match(/id=["']bid_value["'][^>]*value=["']([^"']+)["']/i)
    || html.match(/value=["']([^"']+)["'][^>]*id=["']bid_value["']/i);
  const rawPrice = priceField?.[1]?.replace(/,/g, '').trim() || '';
  const grams = Number(rawPrice);
  if (!Number.isFinite(grams) || grams <= 0) return null;
  return grams;
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

  const slug = typeof input.collection_slug === 'string' ? input.collection_slug.trim().toLowerCase() : '';
  const number = typeof input.gift_number === 'string' ? input.gift_number.trim() : String(input.gift_number || '').trim();
  if (!/^[a-z0-9]+$/.test(slug) || !/^\d{1,12}$/.test(number) || Number(number) <= 0) {
    return json({ error: 'Invalid Fragment gift collection or number' }, 400);
  }

  const url = `https://fragment.com/gift/${slug}-${number}`;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 VYRN Fragment price reader' },
    });
    if (!response.ok) return json({ error: `Fragment returned ${response.status}` }, 502);
    const grams = readFragmentPrice(await response.text());
    if (grams === null) return json({ error: 'Цена этого подарка не найдена на Fragment.' }, 404);
    return json({ grams, stars: Math.max(1, Math.round(grams / 10 * 80)) });
  } catch {
    return json({ error: 'Не удалось получить цену Fragment.' }, 502);
  }
});
