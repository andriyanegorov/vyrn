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

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generateCode = () => {
  const random = crypto.getRandomValues(new Uint8Array(16));
  const groups = Array.from({ length: 4 }, (_, group) =>
    Array.from(random.slice(group * 4, group * 4 + 4), (byte) => alphabet[byte & 31]).join('')
  );
  return `VYRN-${groups.join('-')}`;
};

const hashCode = async (code: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Некорректный JSON-запрос.' }, 400);
  }
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return json({ error: 'Некорректный JSON-запрос.' }, 400);
  }
  const payload = input as Record<string, unknown>;

  const password = typeof payload.password === 'string' ? payload.password : '';
  if (!password || password.length > 256 || payload.action !== 'generate') {
    return json({ error: 'Проверьте действие и пароль администратора.' }, 400);
  }
  const rewardType = payload.reward_type;
  const count = payload.count;
  const rewardValue = payload.reward_value;
  const browserDemoOnly = payload.browser_demo_only === true;
  if (payload.browser_demo_only !== undefined && typeof payload.browser_demo_only !== 'boolean') {
    return json({ error: 'Проверьте режим доступности промокодов.' }, 400);
  }
  if ((rewardType !== 'stars' && rewardType !== 'premium')
    || !Number.isInteger(count) || Number(count) < 1 || Number(count) > 500
    || !Number.isInteger(rewardValue)
    || (rewardType === 'stars' && (Number(rewardValue) < 1 || Number(rewardValue) > 1_000_000))
    || (rewardType === 'premium' && (Number(rewardValue) < 1 || Number(rewardValue) > 12))) {
    return json({ error: 'Проверьте тип награды, количество кодов и размер награды.' }, 400);
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
        ? 'Функция проверки пароля администратора не настроена. Примените supabase/admin-panel.sql.'
        : verified.error.message,
    }, missingFunction ? 503 : 500);
  }
  if (verified.data !== true) return json({ error: 'Неверный пароль администратора.' }, 401);

  for (let attempt = 0; attempt < 3; attempt++) {
    const codes = new Set<string>();
    while (codes.size < Number(count)) codes.add(generateCode());
    const codeList = [...codes];
    const rows = await Promise.all(codeList.map(async (code) => ({
      code_hash: await hashCode(code),
      reward_type: rewardType,
      reward_value: rewardValue,
      browser_demo_only: browserDemoOnly,
    })));
    const inserted = await supabase.from('promo_codes').insert(rows);
    if (!inserted.error) {
      return json({
        codes: codeList,
        reward_type: rewardType,
        reward_value: rewardValue,
        browser_demo_only: browserDemoOnly,
        count: codeList.length,
      }, 201);
    }
    if (inserted.error.code !== '23505') {
      const missingTable = inserted.error.code === 'PGRST205' || inserted.error.code === '42P01';
      return json({
        error: missingTable
          ? 'Таблица промокодов не установлена. Примените supabase/promo-codes.sql.'
          : inserted.error.message,
      }, missingTable ? 503 : 500);
    }
  }
  return json({ error: 'Не удалось создать уникальные коды. Повторите попытку.' }, 503);
});
