-- WATERBOTTLE member profile sync
-- Run this once in Supabase SQL Editor after enabling Google login.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email, avatar_url, line_user_id)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'display_name',
      new.email,
      '會員'
    ),
    new.email,
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    case
      when new.raw_app_meta_data->>'provider' = 'line'
      then coalesce(new.raw_user_meta_data->>'provider_id', new.raw_user_meta_data->>'sub')
      else null
    end
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    avatar_url = excluded.avatar_url,
    line_user_id = coalesce(excluded.line_user_id, public.profiles.line_user_id),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.profiles (id, display_name, email, avatar_url, line_user_id)
select
  u.id,
  coalesce(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    u.raw_user_meta_data->>'display_name',
    u.email,
    '會員'
  ),
  u.email,
  coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
  case
    when u.raw_app_meta_data->>'provider' = 'line'
    then coalesce(u.raw_user_meta_data->>'provider_id', u.raw_user_meta_data->>'sub')
    else null
  end
from auth.users u
on conflict (id) do update set
  display_name = excluded.display_name,
  email = excluded.email,
  avatar_url = excluded.avatar_url,
  line_user_id = coalesce(excluded.line_user_id, public.profiles.line_user_id),
  updated_at = now();
