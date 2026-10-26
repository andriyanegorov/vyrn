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

const eventKeys = new Set([
  'visit_app', 'visit_home', 'visit_profile', 'visit_market', 'visit_chats',
  'visit_daily_tasks', 'view_collection', 'view_nft', 'view_market_listing',
  'send_message', 'create_listing', 'purchase_listing',
]);

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
  const password = typeof input.password === 'string' ? input.password : '';
  if (!password || password.length > 256
    || !['list', 'create', 'delete', 'restore', 'get_settings', 'update_settings', 'reset_all_tasks'].includes(action)) {
    return json({ error: 'Проверь действие и пароль администратора.' }, 400);
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

  if (action === 'reset_all_tasks') {
    const reset = await supabase.rpc('admin_reset_current_daily_tasks');
    if (reset.error) {
      const missingFunction = reset.error.code === 'PGRST202' || reset.error.code === '42883';
      return json({
        error: missingFunction
          ? 'Функция сброса не установлена. Повторно примените supabase/daily-tasks.sql.'
          : reset.error.message,
      }, missingFunction ? 503 : 500);
    }
    return json({ reset: reset.data });
  }

  if (action === 'list') {
    const result = await supabase.from('daily_task_definitions')
      .select('id,period_type,title,description,event_key,target,reward,enabled,created_at')
      .order('period_type').order('created_at', { ascending: false });
    return result.error ? json({ error: result.error.message }, 500) : json({ tasks: result.data });
  }

  if (action === 'get_settings' || action === 'update_settings') {
    let settings;
    if (action === 'update_settings') {
      const dailyCount = input.daily_task_count;
      const weeklyCount = input.weekly_task_count;
      if (!Number.isInteger(dailyCount) || Number(dailyCount) < 1 || Number(dailyCount) > 100
        || !Number.isInteger(weeklyCount) || Number(weeklyCount) < 1 || Number(weeklyCount) > 100) {
        return json({ error: 'Количество заданий должно быть целым числом от 1 до 100 для каждого периода.' }, 400);
      }
      const updated = await supabase.from('daily_task_settings')
        .update({ daily_task_count: dailyCount, weekly_task_count: weeklyCount, updated_at: new Date().toISOString() })
        .eq('singleton', true)
        .select('daily_task_count,weekly_task_count')
        .maybeSingle();
      if (updated.error) return json({ error: updated.error.message }, 500);
      if (!updated.data) return json({ error: 'Настройки заданий не найдены. Повторно примените supabase/daily-tasks.sql.' }, 503);
      settings = updated.data;
    } else {
      const current = await supabase.from('daily_task_settings')
        .select('daily_task_count,weekly_task_count')
        .eq('singleton', true)
        .maybeSingle();
      if (current.error) return json({ error: current.error.message }, 500);
      if (!current.data) return json({ error: 'Настройки заданий не найдены. Примените supabase/daily-tasks.sql.' }, 503);
      settings = current.data;
    }

    const pool = await supabase.from('daily_task_definitions')
      .select('period_type')
      .eq('enabled', true);
    if (pool.error) return json({ error: pool.error.message }, 500);
    const poolSizes = { daily: 0, weekly: 0 };
    for (const task of pool.data || []) {
      if (task.period_type === 'daily') poolSizes.daily += 1;
      if (task.period_type === 'weekly') poolSizes.weekly += 1;
    }
    return json({ settings, enabled_pool: poolSizes });
  }

  const taskId = typeof input.task_id === 'string' ? input.task_id : '';
  if (action === 'delete' || action === 'restore') {
    if (!/^[0-9a-f-]{36}$/i.test(taskId)) return json({ error: 'Некорректный ID задания.' }, 400);
    const result = await supabase.from('daily_task_definitions')
      .update({ enabled: action === 'restore' })
      .eq('id', taskId)
      .select('id,enabled')
      .maybeSingle();
    if (result.error) return json({ error: result.error.message }, 500);
    return result.data
      ? json({ task: result.data })
      : json({ error: 'Задание не найдено.' }, 404);
  }

  const periodType = input.period_type;
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  const eventKey = typeof input.event_key === 'string' ? input.event_key : '';
  const target = Number(input.target);
  const reward = Number(input.reward);
  const validReward = periodType === 'daily'
    ? Number.isInteger(reward) && reward >= 1 && reward <= 3
    : periodType === 'weekly' && Number.isInteger(reward) && reward >= 2 && reward <= 5;
  if ((periodType !== 'daily' && periodType !== 'weekly')
    || title.length < 3 || title.length > 100
    || description.length > 180
    || !eventKeys.has(eventKey)
    || !Number.isInteger(target) || target < 1 || target > 1000
    || !validReward) {
    return json({ error: 'Проверь период, текст, тип события, цель и размер награды.' }, 400);
  }

  const created = await supabase.from('daily_task_definitions')
    .insert({
      period_type: periodType,
      title,
      description,
      event_key: eventKey,
      target,
      reward,
      enabled: true,
    })
    .select('id,period_type,title,description,event_key,target,reward,enabled,created_at')
    .single();
  if (created.error) {
    return json({
      error: created.error.code === '23505'
        ? 'Задание с таким названием уже есть в этом периоде.'
        : created.error.message,
    }, created.error.code === '23505' ? 409 : 500);
  }
  return json({ task: created.data });
});
