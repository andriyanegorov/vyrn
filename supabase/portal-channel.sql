create table if not exists public.portal_channel_managers (
  telegram_id bigint primary key check (telegram_id > 0),
  created_at timestamptz not null default now()
);

alter table public.portal_channel_managers enable row level security;
revoke all on public.portal_channel_managers from public, anon, authenticated;

create or replace function public.ensure_portal_chat(p_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  portal_chat_id uuid;
begin
  if p_profile_id is null or not exists (
    select 1 from public.profiles where id = p_profile_id
  ) then
    raise exception 'Player not found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('vyrn-portal-channel', 0));
  select chats.id into portal_chat_id
  from public.chats
  where chats.chat_type = 'channel' and chats.title = 'VYRN — Портал'
  order by chats.created_at
  limit 1
  for update;

  if portal_chat_id is null then
    insert into public.chats (chat_type, title)
    values ('channel', 'VYRN — Портал')
    returning id into portal_chat_id;
  end if;

  insert into public.chat_members (chat_id, profile_id)
  values (portal_chat_id, p_profile_id)
  on conflict (chat_id, profile_id) do nothing;

  return portal_chat_id;
end;
$$;

create or replace function public.admin_list_portal_managers(p_password text)
returns table (
  telegram_id bigint,
  nickname text,
  username text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_hash text;
begin
  select settings.password_hash into configured_hash
  from public.admin_settings as settings
  where settings.singleton = true;

  if configured_hash is null or p_password is null
    or extensions.crypt(p_password, configured_hash) <> configured_hash then
    raise exception 'Invalid administrator password' using errcode = '28000';
  end if;

  return query
    select managers.telegram_id, profiles.nickname, profiles.username, managers.created_at
    from public.portal_channel_managers as managers
    left join public.profiles as profiles on profiles.telegram_id = managers.telegram_id
    order by managers.created_at, managers.telegram_id;
end;
$$;

create or replace function public.admin_add_portal_manager(p_password text, p_telegram_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_hash text;
begin
  select settings.password_hash into configured_hash
  from public.admin_settings as settings
  where settings.singleton = true;

  if configured_hash is null or p_password is null
    or extensions.crypt(p_password, configured_hash) <> configured_hash then
    raise exception 'Invalid administrator password' using errcode = '28000';
  end if;
  if p_telegram_id is null or p_telegram_id <= 0 then
    raise exception 'Telegram ID must be a positive number';
  end if;

  insert into public.portal_channel_managers (telegram_id)
  values (p_telegram_id)
  on conflict (telegram_id) do nothing;
end;
$$;

create or replace function public.admin_remove_portal_manager(p_password text, p_telegram_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_hash text;
begin
  select settings.password_hash into configured_hash
  from public.admin_settings as settings
  where settings.singleton = true;

  if configured_hash is null or p_password is null
    or extensions.crypt(p_password, configured_hash) <> configured_hash then
    raise exception 'Invalid administrator password' using errcode = '28000';
  end if;
  if p_telegram_id is null or p_telegram_id <= 0 then
    raise exception 'Telegram ID must be a positive number';
  end if;

  delete from public.portal_channel_managers
  where portal_channel_managers.telegram_id = p_telegram_id;
  return found;
end;
$$;

revoke all on function public.ensure_portal_chat(uuid) from public, anon, authenticated;
grant execute on function public.ensure_portal_chat(uuid) to service_role;
revoke all on function public.admin_list_portal_managers(text) from public, anon, authenticated;
grant execute on function public.admin_list_portal_managers(text) to anon;
revoke all on function public.admin_add_portal_manager(text, bigint) from public, anon, authenticated;
grant execute on function public.admin_add_portal_manager(text, bigint) to anon;
revoke all on function public.admin_remove_portal_manager(text, bigint) from public, anon, authenticated;
grant execute on function public.admin_remove_portal_manager(text, bigint) to anon;

notify pgrst, 'reload schema';
