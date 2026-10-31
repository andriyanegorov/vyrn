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

type CasePrize = {
  id: string;
  name: string;
  collection_slug: string;
  collection_name: string;
  value_stars: number;
  weight: number;
  fragment_url: string;
  preview_url: string | null;
  animation_url: string | null;
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

  const action = typeof input.action === 'string' ? input.action : '';
  if (!['list', 'create', 'update', 'delete'].includes(action)) {
    return json({ error: 'Неизвестное действие с кейсами.' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    || Deno.env.get('VYRN_SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server is not configured' }, 500);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (action !== 'list') {
    const password = typeof input.password === 'string' ? input.password : '';
    if (!password || password.length > 256) return json({ error: 'Введите пароль администратора.' }, 400);
    const verified = await supabase.rpc('admin_verify_password', { p_password: password });
    if (verified.error) {
      const missingFunction = verified.error.code === 'PGRST202' || verified.error.code === '42883';
      return json({
        error: missingFunction
          ? 'Функция проверки пароля администратора не настроена. Примените supabase/admin-panel.sql.'
          : verified.error.message,
      }, missingFunction ? 503 : 500);
    }
    if (verified.data !== true) return json({ error: 'Неверный пароль администратора.' }, 401);
  }

  if (action === 'list') {
    const result = await supabase.from('case_catalog')
      .select('id,slug,title,description,cover_url,price_stars,prizes,enabled')
      .eq('enabled', true)
      .order('created_at', { ascending: true });
    if (result.error) {
      const missingTable = result.error.code === 'PGRST205' || result.error.code === '42P01';
      return json({
        error: missingTable
          ? 'Каталог кейсов не установлен. Примените supabase/cases.sql.'
          : result.error.message,
      }, missingTable ? 503 : 500);
    }
    return json({ cases: result.data });
  }

  if (action === 'delete') {
    const id = typeof input.id === 'string' ? input.id : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return json({ error: 'Некорректный ID кейса.' }, 400);
    }
    const result = await supabase.from('case_catalog').delete().eq('id', id).select('id').maybeSingle();
    if (result.error) return json({ error: result.error.message }, 500);
    return result.data ? json({ id: result.data.id }) : json({ error: 'Кейс не найден.' }, 404);
  }

  const source = input.case && typeof input.case === 'object'
    ? input.case as Record<string, unknown>
    : {};
  const title = typeof source.title === 'string' ? source.title.trim() : '';
  const description = typeof source.description === 'string' ? source.description.trim() : '';
  const price = Number(source.price_stars);
  const slugSource = typeof source.slug === 'string' ? source.slug : title;
  const slugBase = slugSource.toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const prizes = Array.isArray(source.prizes) ? source.prizes as CasePrize[] : [];

  if (title.length < 2 || title.length > 80 || description.length > 240
    || !Number.isSafeInteger(price) || price < 1 || price > 1000000
    || prizes.length < 2 || prizes.length > 20) {
    return json({ error: 'Проверь название, цену и добавь от 2 до 20 подарков.' }, 400);
  }

  const cleanPrizes: CasePrize[] = [];
  for (const [index, prize] of prizes.entries()) {
    const name = typeof prize?.name === 'string' ? prize.name.trim() : '';
    const fragmentUrl = typeof prize?.fragment_url === 'string' ? prize.fragment_url.trim() : '';
    let parsedFragmentUrl: URL | null = null;
    try {
      parsedFragmentUrl = new URL(fragmentUrl);
    } catch {
      parsedFragmentUrl = null;
    }
    const giftMatch = parsedFragmentUrl?.pathname.match(/^\/gift\/([a-z0-9]+)-(\d{1,12})\/?$/i);
    const collectionSlug = giftMatch?.[1].toLowerCase() || '';
    const fragmentNumber = giftMatch?.[2] ? String(Number(giftMatch[2])) : '';
    const collectionName = typeof prize?.collection_name === 'string' ? prize.collection_name.trim() : '';
    const valueStars = Number(prize?.value_stars);
    const weight = Number(prize?.weight);
    if (name.length < 2 || name.length > 100
      || !parsedFragmentUrl
      || parsedFragmentUrl.protocol !== 'https:'
      || !['fragment.com', 'www.fragment.com'].includes(parsedFragmentUrl.hostname.toLowerCase())
      || (parsedFragmentUrl.port !== '' && parsedFragmentUrl.port !== '443')
      || parsedFragmentUrl.username !== '' || parsedFragmentUrl.password !== ''
      || parsedFragmentUrl.search !== '' || parsedFragmentUrl.hash !== ''
      || !giftMatch || Number(giftMatch[2]) < 1
      || !/^[a-z0-9]{2,40}$/.test(collectionSlug)
      || collectionName.length < 2 || collectionName.length > 100
      || !Number.isSafeInteger(valueStars) || valueStars < 1 || valueStars > 1000000000
      || !Number.isSafeInteger(weight) || weight < 1 || weight > 100000) {
      return json({ error: `Проверь ссылку Fragment, название, ценность и шанс подарка №${index + 1}.` }, 400);
    }
    const canonicalFragmentUrl = `https://fragment.com/gift/${collectionSlug}-${fragmentNumber}`;
    const previewUrl = `https://nft.fragment.com/gift/${collectionSlug}-${fragmentNumber}.webp`;
    cleanPrizes.push({
      id: typeof prize.id === 'string' && /^[a-z0-9-]{1,60}$/i.test(prize.id)
        ? prize.id
        : crypto.randomUUID(),
      name,
      collection_slug: collectionSlug,
      collection_name: collectionName,
      value_stars: valueStars,
      weight,
      fragment_url: canonicalFragmentUrl,
      preview_url: previewUrl,
      animation_url: `https://nft.fragment.com/gift/${collectionSlug}-${fragmentNumber}.tgs`,
    });
  }

  const caseId = typeof source.id === 'string' ? source.id : '';
  if (action === 'update'
    && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(caseId)) {
    return json({ error: 'Некорректный ID кейса.' }, 400);
  }

  const payload = {
    ...(action === 'update' ? {} : { slug: `${slugBase || 'case'}-${crypto.randomUUID().slice(0, 8)}` }),
    title,
    description,
    cover_url: cleanPrizes[0].preview_url,
    price_stars: price,
    prizes: cleanPrizes,
    enabled: true,
    updated_at: new Date().toISOString(),
  };
  const result = action === 'create'
    ? await supabase.from('case_catalog').insert(payload)
      .select('id,slug,title,description,cover_url,price_stars,prizes,enabled').single()
    : await supabase.from('case_catalog').update(payload).eq('id', caseId)
      .select('id,slug,title,description,cover_url,price_stars,prizes,enabled').maybeSingle();
  if (result.error) return json({ error: result.error.message }, 500);
  if (!result.data) return json({ error: 'Кейс не найден.' }, 404);
  return json({ case: result.data });
});
