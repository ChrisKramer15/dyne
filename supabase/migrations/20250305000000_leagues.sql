-- Leagues: public.leagues and public.league_members, row-level security and
-- the create_league() RPC used by the create-league wizard.
--
-- Clients read through RLS-protected selects. Every write goes through the
-- security definer create_league() function, which inserts the league and the
-- owner membership in one transaction.

----------------------------------------------------------------------
-- Tables
----------------------------------------------------------------------

create table public.leagues (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text not null default '',
  format      text not null,
  team_count  integer not null,
  visibility  text not null default 'private',
  created_at  timestamptz not null default now(),
  constraint league_name_length        check (char_length(name) between 1 and 50),
  constraint league_name_not_blank     check (btrim(name) <> ''),
  constraint league_description_length check (char_length(description) <= 280),
  constraint league_team_count_range   check (team_count between 4 and 20),
  constraint league_guillotine_min     check (format <> 'Guillotine' or team_count >= 6),
  constraint league_visibility_values  check (visibility in ('private', 'public'))
);
create index leagues_owner_idx on public.leagues (owner_id);

create table public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index league_members_user_idx on public.league_members (user_id);

----------------------------------------------------------------------
-- Row-level security
----------------------------------------------------------------------

alter table public.leagues        enable row level security;
alter table public.league_members enable row level security;

-- Defence in depth: no anonymous access, and no client writes at all.
revoke all on public.leagues, public.league_members from anon;
revoke insert, update, delete, truncate on public.leagues, public.league_members from authenticated;

-- security definer avoids policy recursion on league_members.
create function public.is_league_member(lg uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.league_members
     where league_id = lg and user_id = auth.uid()
   ) $$;

revoke all on function public.is_league_member(uuid) from public, anon;
grant execute on function public.is_league_member(uuid) to authenticated;

create policy leagues_select on public.leagues
  for select to authenticated
  using (public.is_league_member(id));

create policy league_members_select on public.league_members
  for select to authenticated
  using (public.is_league_member(league_id));

-- No insert, update or delete policies: clients cannot write directly.

-- Table privileges (same reason as 20250301000000_chat_table_grants.sql):
-- RLS decides which rows are visible, these grants let the policies run.
grant select on public.leagues, public.league_members to authenticated;

----------------------------------------------------------------------
-- RPC
----------------------------------------------------------------------

create function public.create_league(
  p_name        text,
  p_description text,
  p_format      text,
  p_team_count  integer,
  p_visibility  text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;

  -- Table check constraints reject invalid values.
  insert into public.leagues (owner_id, name, description, format, team_count, visibility)
  values (me, btrim(p_name), btrim(coalesce(p_description, '')), p_format, p_team_count, p_visibility)
  returning id into new_id;

  insert into public.league_members (league_id, user_id, role)
  values (new_id, me, 'owner');

  return new_id;
end $$;

revoke all on function public.create_league(text, text, text, integer, text) from public, anon;
grant execute on function public.create_league(text, text, text, integer, text) to authenticated;
