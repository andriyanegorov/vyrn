do $$
declare
  new_password text := 'REPLACE_WITH_A_LONG_RANDOM_ADMIN_PASSWORD';
begin
  if new_password like 'REPLACE_%' or char_length(new_password) < 20 then
    raise exception 'Replace the placeholder with a unique password of at least 20 characters before running this script';
  end if;

  update public.admin_settings
  set password_hash = extensions.crypt(new_password, extensions.gen_salt('bf')),
      updated_at = now()
  where singleton = true;
end;
$$;

select case
  when password_hash is not null then 'Admin password configured'
  else 'Admin password was not configured'
end as status
from public.admin_settings
where singleton = true;