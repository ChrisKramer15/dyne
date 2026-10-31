-- Auth modal: usernames, profile creation trigger, and lookup RPCs.

create extension if not exists citext;

create table public.profiles (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  username citext not null unique,
  constraint username_format check (username ~ '^[A-Za-z0-9_]{3,20}$')
);

-- RLS enabled with no policies: the browser cannot read or write profiles.
alter table public.profiles enable row level security;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end $$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.username_available(u text) returns boolean
language sql security definer set search_path = public as
$$ select not exists (select 1 from public.profiles where username = u::citext) $$;

grant execute on function public.username_available(text) to anon, authenticated;

create function public.email_for_username(u text) returns text
language sql security definer set search_path = public as
$$ select a.email from public.profiles p join auth.users a on a.id = p.user_id where p.username = u::citext $$;

create function public.email_for_identifier(i text) returns text
language sql security definer set search_path = public as
$$ select coalesce(
     (select a.email from auth.users a where lower(a.email) = lower(i)),
     (select a.email from public.profiles p join auth.users a on a.id = p.user_id where p.username = i::citext)
   ) $$;

revoke all on function public.email_for_username(text), public.email_for_identifier(text) from public, anon, authenticated;
grant execute on function public.email_for_username(text), public.email_for_identifier(text) to service_role;
