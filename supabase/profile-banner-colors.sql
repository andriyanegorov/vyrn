alter table public.profiles
  add column if not exists banner_color text;

alter table public.profiles
  add column if not exists banner_gradient boolean not null default false;

do $$
begin
  alter table public.profiles
    add constraint profiles_banner_color_check
    check (banner_color is null or banner_color ~ '^#[0-9A-Fa-f]{6}$');
exception
  when duplicate_object then null;
end;
$$;
