create table if not exists public.daily_task_definitions (
  id uuid primary key default gen_random_uuid(),
  period_type text not null check (period_type in ('daily', 'weekly')),
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '' check (char_length(description) <= 180),
  event_key text not null check (event_key in (
    'visit_app', 'visit_home', 'visit_profile', 'visit_market', 'visit_chats',
    'visit_daily_tasks', 'view_collection', 'view_nft', 'view_market_listing',
    'send_message', 'create_listing', 'purchase_listing'
  )),
  target integer not null check (target between 1 and 1000),
  reward integer not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  check ((period_type = 'daily' and reward between 1 and 3)
    or (period_type = 'weekly' and reward between 2 and 5)),
  unique (period_type, title)
);

create table if not exists public.daily_task_settings (
  singleton boolean primary key default true check (singleton),
  daily_task_count integer not null default 3 check (daily_task_count between 1 and 100),
  weekly_task_count integer not null default 5 check (weekly_task_count between 1 and 100),
  updated_at timestamptz not null default now()
);
alter table public.daily_task_settings enable row level security;
revoke all on public.daily_task_settings from public, anon, authenticated;
insert into public.daily_task_settings(singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.daily_task_assignments (
  id uuid primary key default gen_random_uuid(),
  period_type text not null check (period_type in ('daily', 'weekly')),
  period_start date not null,
  task_id uuid not null references public.daily_task_definitions(id) on delete cascade,
  unique (period_type, period_start, task_id)
);
create index if not exists daily_task_assignments_period_idx
  on public.daily_task_assignments(period_type, period_start);

create table if not exists public.daily_task_events (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null check (event_key in (
    'visit_app', 'visit_home', 'visit_profile', 'visit_market', 'visit_chats',
    'visit_daily_tasks', 'view_collection', 'view_nft', 'view_market_listing',
    'send_message', 'create_listing', 'purchase_listing'
  )),
  created_at timestamptz not null default now()
);
create index if not exists daily_task_events_profile_period_idx
  on public.daily_task_events(profile_id, event_key, created_at desc);

create table if not exists public.daily_task_completions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  assignment_id uuid not null references public.daily_task_assignments(id) on delete cascade,
  reward integer not null check (reward > 0),
  completed_at timestamptz not null default now(),
  unique (profile_id, assignment_id)
);

alter table public.daily_task_definitions enable row level security;
alter table public.daily_task_assignments enable row level security;
alter table public.daily_task_events enable row level security;
alter table public.daily_task_completions enable row level security;
revoke all on public.daily_task_definitions, public.daily_task_assignments,
  public.daily_task_events, public.daily_task_completions from public, anon, authenticated;

insert into public.daily_task_definitions (period_type, title, description, event_key, target, reward)
values
  ('daily', 'Зайди в VYRN', 'Открой приложение', 'visit_app', 1, 1),
  ('daily', 'Посети главную страницу', 'Загляни на главную', 'visit_home', 1, 1),
  ('daily', 'Открой свой профиль', 'Посети страницу профиля', 'visit_profile', 1, 1),
  ('daily', 'Посети маркет', 'Загляни в раздел рынка', 'visit_market', 1, 1),
  ('daily', 'Открой раздел чатов', 'Посети список чатов', 'visit_chats', 1, 1),
  ('daily', 'Посмотри свою коллекцию NFT', 'Открой коллекцию в профиле', 'view_collection', 1, 1),
  ('daily', 'Посети раздел заданий', 'Открой ежедневные задания', 'visit_daily_tasks', 1, 1),
  ('daily', 'Посмотри 3 NFT', 'Открой карточки разных NFT', 'view_nft', 3, 1),
  ('daily', 'Посмотри 5 лотов', 'Открой карточки на маркете', 'view_market_listing', 5, 1),
  ('daily', 'Отправь 3 сообщения', 'Пообщайся с другими игроками', 'send_message', 3, 1),
  ('daily', 'Отправь 5 сообщений', 'Продолжай общаться с игроками', 'send_message', 5, 2),
  ('daily', 'Выставь NFT на продажу', 'Создай объявление на маркете', 'create_listing', 1, 2),
  ('weekly', 'Заходи в приложение в 3 разных дня', 'Возвращайся в VYRN в течение недели', 'visit_app', 3, 2),
  ('weekly', 'Заходи в приложение в 5 разных дней', 'Возвращайся в VYRN в течение недели', 'visit_app', 5, 3),
  ('weekly', 'Посети маркет в 3 разных дня', 'Исследуй рынок на этой неделе', 'visit_market', 3, 2),
  ('weekly', 'Посмотри 10 NFT', 'Открывай карточки NFT всю неделю', 'view_nft', 10, 2),
  ('weekly', 'Посмотри 25 NFT', 'Продолжай изучать коллекции', 'view_nft', 25, 4),
  ('weekly', 'Изучи коллекцию в 4 разных дня', 'Возвращайся к своей коллекции', 'view_collection', 4, 2),
  ('weekly', 'Посмотри 20 лотов', 'Изучай предложения на маркете', 'view_market_listing', 20, 3),
  ('weekly', 'Отправь 10 сообщений', 'Общайся с игроками в течение недели', 'send_message', 10, 2),
  ('weekly', 'Отправь 25 сообщений', 'Будь активным в чатах', 'send_message', 25, 4),
  ('weekly', 'Выставь 3 NFT на продажу', 'Пополняй предложения маркета', 'create_listing', 3, 4)
on conflict (period_type, title) do nothing;

create or replace function public.ensure_daily_task_assignments(
  p_period_type text,
  p_period_start date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment_count integer;
  selection_limit integer;
begin
  if p_period_type not in ('daily', 'weekly') then
    raise exception 'Invalid task period';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_period_type || ':' || p_period_start::text));
  select count(*) into assignment_count
  from public.daily_task_assignments
  where period_type = p_period_type and period_start = p_period_start;
  if assignment_count > 0 then return; end if;

  select case
    when p_period_type = 'daily' then settings.daily_task_count
    else settings.weekly_task_count
  end
  into selection_limit
  from public.daily_task_settings as settings
  where settings.singleton = true;
  if selection_limit is null then raise exception 'Task count settings are not configured'; end if;

  insert into public.daily_task_assignments (period_type, period_start, task_id)
  select p_period_type, p_period_start, task.id
  from public.daily_task_definitions as task
  where task.period_type = p_period_type and task.enabled
  order by random()
  limit selection_limit
  on conflict (period_type, period_start, task_id) do nothing;
end;
$$;

create or replace function public.admin_reset_current_daily_tasks()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  moscow_now timestamp := now() at time zone 'Europe/Moscow';
  daily_start date := moscow_now::date;
  weekly_start date := moscow_now::date - (extract(isodow from moscow_now)::integer - 1);
  previous_daily_ids uuid[] := '{}'::uuid[];
  previous_weekly_ids uuid[] := '{}'::uuid[];
  daily_selection_limit integer;
  weekly_selection_limit integer;
  daily_assignment_count integer;
  weekly_assignment_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('daily:' || daily_start::text));
  perform pg_advisory_xact_lock(hashtext('weekly:' || weekly_start::text));

  select coalesce(array_agg(task_id), '{}'::uuid[])
  into previous_daily_ids
  from public.daily_task_assignments
  where period_type = 'daily' and period_start = daily_start;

  select coalesce(array_agg(task_id), '{}'::uuid[])
  into previous_weekly_ids
  from public.daily_task_assignments
  where period_type = 'weekly' and period_start = weekly_start;

  select settings.daily_task_count, settings.weekly_task_count
  into daily_selection_limit, weekly_selection_limit
  from public.daily_task_settings as settings
  where settings.singleton = true;
  if daily_selection_limit is null or weekly_selection_limit is null then
    raise exception 'Task count settings are not configured';
  end if;

  delete from public.daily_task_events
  where created_at >= (weekly_start::timestamp at time zone 'Europe/Moscow')
    and created_at < ((weekly_start + 7)::timestamp at time zone 'Europe/Moscow');

  delete from public.daily_task_assignments
  where (period_type = 'daily' and period_start = daily_start)
     or (period_type = 'weekly' and period_start = weekly_start);

  insert into public.daily_task_assignments (period_type, period_start, task_id)
  select 'daily', daily_start, task.id
  from public.daily_task_definitions as task
  where task.period_type = 'daily' and task.enabled
  order by (task.id = any(previous_daily_ids)), random()
  limit daily_selection_limit;
  get diagnostics daily_assignment_count = row_count;

  insert into public.daily_task_assignments (period_type, period_start, task_id)
  select 'weekly', weekly_start, task.id
  from public.daily_task_definitions as task
  where task.period_type = 'weekly' and task.enabled
  order by (task.id = any(previous_weekly_ids)), random()
  limit weekly_selection_limit;
  get diagnostics weekly_assignment_count = row_count;

  return jsonb_build_object(
    'daily_count', daily_assignment_count,
    'weekly_count', weekly_assignment_count,
    'daily_period_start', daily_start,
    'weekly_period_start', weekly_start
  );
end;
$$;

create or replace function public.record_daily_task_event(
  p_profile_id uuid,
  p_event_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  moscow_day date := (now() at time zone 'Europe/Moscow')::date;
begin
  if p_event_key not in (
    'visit_app', 'visit_home', 'visit_profile', 'visit_market', 'visit_chats',
    'visit_daily_tasks', 'view_collection', 'view_nft', 'view_market_listing'
  ) then
    raise exception 'Unsupported task event';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'Player not found';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_profile_id::text || ':' || p_event_key));
  if p_event_key in (
    'visit_app', 'visit_home', 'visit_profile', 'visit_market', 'visit_chats',
    'visit_daily_tasks', 'view_collection'
  ) and exists (
    select 1 from public.daily_task_events
    where profile_id = p_profile_id and event_key = p_event_key
      and created_at >= (moscow_day::timestamp at time zone 'Europe/Moscow')
  ) then
    return false;
  end if;
  if p_event_key in ('view_nft', 'view_market_listing') and exists (
    select 1 from public.daily_task_events
    where profile_id = p_profile_id and event_key = p_event_key
      and created_at > now() - interval '1 second'
  ) then
    return false;
  end if;

  insert into public.daily_task_events(profile_id, event_key)
  values (p_profile_id, p_event_key);
  return true;
end;
$$;

create or replace function public.track_daily_task_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'text' then
    insert into public.daily_task_events(profile_id, event_key, created_at)
    values (new.sender_profile_id, 'send_message', new.created_at);
  end if;
  return new;
end;
$$;
drop trigger if exists messages_track_daily_task on public.messages;
create trigger messages_track_daily_task
  after insert on public.messages
  for each row execute function public.track_daily_task_message();

create or replace function public.track_daily_task_listing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.daily_task_events(profile_id, event_key, created_at)
  values (new.seller_profile_id, 'create_listing', new.created_at);
  return new;
end;
$$;
drop trigger if exists listings_track_daily_task on public.market_listings;
create trigger listings_track_daily_task
  after insert on public.market_listings
  for each row execute function public.track_daily_task_listing();

create or replace function public.track_daily_task_purchase()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.daily_task_events(profile_id, event_key, created_at)
  values (new.buyer_profile_id, 'purchase_listing', new.created_at);
  return new;
end;
$$;
drop trigger if exists market_transactions_track_daily_task on public.market_transactions;
create trigger market_transactions_track_daily_task
  after insert on public.market_transactions
  for each row execute function public.track_daily_task_purchase();

create or replace function public.get_daily_task_board(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  moscow_now timestamp := now() at time zone 'Europe/Moscow';
  daily_start date := moscow_now::date;
  weekly_start date := moscow_now::date - (extract(isodow from moscow_now)::integer - 1);
  daily_result jsonb;
  weekly_result jsonb;
begin
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'Player not found';
  end if;
  perform public.ensure_daily_task_assignments('daily', daily_start);
  perform public.ensure_daily_task_assignments('weekly', weekly_start);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', assignment.id,
    'title', task.title,
    'description', task.description,
    'reward', task.reward,
    'target', task.target,
    'progress', least(task.target, event_count.total),
    'completed', completion.id is not null,
    'completed_at', completion.completed_at
  ) order by assignment.id), '[]'::jsonb)
  into daily_result
  from public.daily_task_assignments as assignment
  join public.daily_task_definitions as task on task.id = assignment.task_id
  left join public.daily_task_completions as completion
    on completion.assignment_id = assignment.id and completion.profile_id = p_profile_id
  cross join lateral (
    select count(*)::integer as total
    from public.daily_task_events as event
    where event.profile_id = p_profile_id
      and event.event_key = task.event_key
      and event.created_at >= (daily_start::timestamp at time zone 'Europe/Moscow')
      and event.created_at < ((daily_start + 1)::timestamp at time zone 'Europe/Moscow')
  ) as event_count
  where assignment.period_type = 'daily' and assignment.period_start = daily_start;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', assignment.id,
    'title', task.title,
    'description', task.description,
    'reward', task.reward,
    'target', task.target,
    'progress', least(task.target, event_count.total),
    'completed', completion.id is not null,
    'completed_at', completion.completed_at
  ) order by assignment.id), '[]'::jsonb)
  into weekly_result
  from public.daily_task_assignments as assignment
  join public.daily_task_definitions as task on task.id = assignment.task_id
  left join public.daily_task_completions as completion
    on completion.assignment_id = assignment.id and completion.profile_id = p_profile_id
  cross join lateral (
    select count(*)::integer as total
    from public.daily_task_events as event
    where event.profile_id = p_profile_id
      and event.event_key = task.event_key
      and event.created_at >= (weekly_start::timestamp at time zone 'Europe/Moscow')
      and event.created_at < ((weekly_start + 7)::timestamp at time zone 'Europe/Moscow')
  ) as event_count
  where assignment.period_type = 'weekly' and assignment.period_start = weekly_start;

  return jsonb_build_object(
    'daily', jsonb_build_object(
      'period_start', daily_start,
      'reset_at', ((daily_start + 1)::timestamp at time zone 'Europe/Moscow'),
      'tasks', daily_result
    ),
    'weekly', jsonb_build_object(
      'period_start', weekly_start,
      'reset_at', ((weekly_start + 7)::timestamp at time zone 'Europe/Moscow'),
      'tasks', weekly_result
    )
  );
end;
$$;

create or replace function public.check_daily_task(
  p_profile_id uuid,
  p_assignment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment public.daily_task_assignments%rowtype;
  task public.daily_task_definitions%rowtype;
  period_start date;
  progress_count integer;
  wallet_id uuid;
  completion_id uuid;
begin
  select * into assignment
  from public.daily_task_assignments
  where id = p_assignment_id
  for update;
  if not found then raise exception 'Задание уже обновилось. Обновите страницу.'; end if;

  if assignment.period_type = 'daily' then
    period_start := (now() at time zone 'Europe/Moscow')::date;
  else
    period_start := (now() at time zone 'Europe/Moscow')::date
      - (extract(isodow from now() at time zone 'Europe/Moscow')::integer - 1);
  end if;
  if assignment.period_start <> period_start then
    raise exception 'Период задания завершён. Обновите список заданий.';
  end if;

  select * into task from public.daily_task_definitions where id = assignment.task_id;
  if not found then raise exception 'Задание больше не доступно'; end if;
  select id into completion_id from public.daily_task_completions
  where profile_id = p_profile_id and assignment_id = p_assignment_id;
  if found then
    return jsonb_build_object('completed', true, 'already_completed', true, 'reward', task.reward, 'progress', task.target, 'target', task.target);
  end if;

  select count(*)::integer into progress_count
  from public.daily_task_events
  where profile_id = p_profile_id
    and event_key = task.event_key
    and created_at >= (period_start::timestamp at time zone 'Europe/Moscow')
    and created_at < (
      case when assignment.period_type = 'daily' then (period_start + 1) else (period_start + 7) end
      ::timestamp at time zone 'Europe/Moscow'
    );
  if progress_count < task.target then
    return jsonb_build_object(
      'completed', false,
      'reward', task.reward,
      'progress', progress_count,
      'target', task.target
    );
  end if;

  select id into wallet_id from public.wallets
  where profile_id = p_profile_id and currency = 'stars'
  for update;
  if not found then raise exception 'Stars-кошелёк игрока не найден'; end if;

  insert into public.daily_task_completions(profile_id, assignment_id, reward)
  values (p_profile_id, p_assignment_id, task.reward)
  on conflict (profile_id, assignment_id) do nothing
  returning id into completion_id;
  if completion_id is null then
    return jsonb_build_object('completed', true, 'already_completed', true, 'reward', task.reward, 'progress', task.target, 'target', task.target);
  end if;

  update public.wallets set balance = balance + task.reward where id = wallet_id;
  insert into public.wallet_transactions(wallet_id, amount, reason, reference_id)
  values (wallet_id, task.reward, 'daily_task_reward', completion_id);
  return jsonb_build_object(
    'completed', true,
    'already_completed', false,
    'reward', task.reward,
    'progress', task.target,
    'target', task.target
  );
end;
$$;

revoke all on function public.ensure_daily_task_assignments(text, date) from public, anon, authenticated;
revoke all on function public.admin_reset_current_daily_tasks() from public, anon, authenticated;
revoke all on function public.record_daily_task_event(uuid, text) from public, anon, authenticated;
revoke all on function public.get_daily_task_board(uuid) from public, anon, authenticated;
revoke all on function public.check_daily_task(uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_daily_task_event(uuid, text) to service_role;
grant execute on function public.admin_reset_current_daily_tasks() to service_role;
grant execute on function public.get_daily_task_board(uuid) to service_role;
grant execute on function public.check_daily_task(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
