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

const decodeHtml = (value: string) => value
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&#(\d+);/g, (entity, code: string) => {
    const point = Number(code);
    return point <= 0x10ffff ? String.fromCodePoint(point) : entity;
  })
  .replace(/&#x([0-9a-f]+);/gi, (entity, code: string) => {
    const point = parseInt(code, 16);
    return point <= 0x10ffff ? String.fromCodePoint(point) : entity;
  });

const getAttribute = (attributes: string, name: string) =>
  attributes.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1] || '';

const parseCollections = (html: string): FragmentCollection[] => {
  const collections: FragmentCollection[] = [];
  const anchors = html.matchAll(/<a\b([^>]*\bjs-choose-collection-item\b[^>]*)>([\s\S]*?)<\/a>/gi);

  for (const [, attributes, contents] of anchors) {
    const slug = getAttribute(attributes, 'data-value').trim().toLowerCase();
    const embeddedName = contents.match(/class=["'][^"']*\btm-main-filters-name\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '';
    const name = decodeHtml(getAttribute(attributes, 'data-keywords') || embeddedName.replace(/<[^>]*>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    if (!/^[a-z0-9]+$/.test(slug) || !name || name.length > 100) continue;
    collections.push({ slug, name });
  }

  return [...new Map(collections.map((collection) => [collection.slug, collection])).values()];
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VYRN_SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server is not configured' }, 500);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (input.action === 'list') {
    const result = await supabase.from('nft_collections').select('slug,name').order('name');
    return result.error
      ? json({ error: result.error.message }, 500)
      : json({ collections: result.data });
  }

  if (input.action !== 'sync') return json({ error: 'Unknown catalog action' }, 400);
  if (typeof input.password !== 'string' || !input.password || input.password.length > 256) {
    return json({ error: 'Введите пароль администратора.' }, 400);
  }

  let fragmentResponse: Response;
  try {
    fragmentResponse = await fetch('https://fragment.com/gifts', {
      headers: { 'User-Agent': 'Mozilla/5.0 VYRN Fragment catalog reader' },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return json({ error: 'Не удалось подключиться к Fragment.' }, 502);
  }
  if (!fragmentResponse.ok) return json({ error: `Fragment вернул HTTP ${fragmentResponse.status}.` }, 502);

  const contentLength = Number(fragmentResponse.headers.get('content-length') || 0);
  if (contentLength > 8_000_000) return json({ error: 'Ответ Fragment слишком большой.' }, 502);
  const html = await fragmentResponse.text();
  if (html.length > 8_000_000) return json({ error: 'Ответ Fragment слишком большой.' }, 502);
  const collections = parseCollections(html);
  if (collections.length < 20 || collections.length > 500) {
    return json({ error: 'Не удалось распознать каталог Fragment. Список в базе не изменён.' }, 502);
  }

  const synced = await supabase.rpc('admin_sync_fragment_collections', {
    p_password: input.password,
    p_collections: collections,
  });
  if (synced.error) {
    const invalidPassword = synced.error.code === '28000' || synced.error.message.includes('Invalid administrator password');
    return json({
      error: invalidPassword ? 'Неверный пароль администратора.' : synced.error.message,
    }, invalidPassword ? 401 : 500);
  }

  return json({ collections: synced.data, synced_count: collections.length });
});
