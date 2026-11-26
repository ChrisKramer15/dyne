-- Create-league wizard storage.
--
-- Adds the columns the wizard fills in and the create_league() RPC that writes
-- them. Written to run after 20250308000000_drop_create_league_wizard.sql, which
-- drops the previous roster/scoring columns and create_league() overloads.
--
-- avatar_id: id from the app's avatar list (src/features/leagues/wizard/leagueAvatars.ts),
--            e.g. 'avatar-042'. Null for leagues created before avatars existed.
-- scoring:   points per stat, e.g. {"h_homeRuns": 4, "p_wins": 5}. Keys are defined
--            by the app (scoringSettings.ts), so the database checks shape and range only.
--
-- team_count is required but no wizard step asks for it yet, so it defaults to 12.
-- Remove the default when a step collects it.

alter table public.leagues
  add column if not exists avatar_id text,
  add column if not exists scoring   jsonb not null default '{}'::jsonb;

alter table public.leagues alter column team_count set default 12;

alter table public.leagues drop constraint if exists league_avatar_id_format;
alter table public.leagues
  add constraint league_avatar_id_format
  check (avatar_id is null or avatar_id ~ '^avatar-[0-9]{3}$');

alter table public.leagues drop constraint if exists league_scoring_is_object;
alter table public.leagues
  add constraint league_scoring_is_object
  check (jsonb_typeof(scoring) = 'object');

create or replace function public.create_league(
  p_name      text,
  p_format    text,
  p_avatar_id text,
  p_scoring   jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me     uuid := auth.uid();
  new_id uuid;
  stat   record;
begin
  if me is null then raise exception 'not_authenticated'; end if;

  if p_format is null or p_format not in ('Bestball', 'Dynasty', 'Guillotine', 'Keeper', 'Redraft') then
    raise exception 'invalid_format';
  end if;

  if p_scoring is null or jsonb_typeof(p_scoring) <> 'object' or p_scoring = '{}'::jsonb then
    raise exception 'invalid_scoring';
  end if;
  -- Every value must be a number between -100 and 100 (matches SCORING_LIMIT in the app).
  for stat in select key, value from jsonb_each(p_scoring) loop
    if jsonb_typeof(stat.value) <> 'number' or abs((stat.value #>> '{}')::numeric) > 100 then
      raise exception 'invalid_scoring';
    end if;
  end loop;

  -- Table check constraints reject an invalid name or avatar id.
  insert into public.leagues (owner_id, name, format, avatar_id, scoring)
  values (me, btrim(p_name), p_format, p_avatar_id, p_scoring)
  returning id into new_id;

  insert into public.league_members (league_id, user_id, role)
  values (new_id, me, 'owner');

  return new_id;
end $$;

revoke all on function public.create_league(text, text, text, jsonb) from public, anon;
grant execute on function public.create_league(text, text, text, jsonb) to authenticated;
