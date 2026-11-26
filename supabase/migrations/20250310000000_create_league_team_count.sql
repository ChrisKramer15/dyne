-- The create-league wizard now asks for the number of teams.
--
-- Replaces create_league(text, text, text, jsonb) from 20250309000000 with a
-- version that also takes p_team_count, and removes the temporary default of 12
-- that existed only because no wizard step collected the value.
-- The existing checks still apply: 4 to 32 teams, and at least 6 for Guillotine.

drop function if exists public.create_league(text, text, text, jsonb);

alter table public.leagues alter column team_count drop default;

create function public.create_league(
  p_name       text,
  p_format     text,
  p_avatar_id  text,
  p_team_count integer,
  p_scoring    jsonb
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

  -- Table check constraints reject an invalid name, avatar id or team count.
  insert into public.leagues (owner_id, name, format, avatar_id, team_count, scoring)
  values (me, btrim(p_name), p_format, p_avatar_id, p_team_count, p_scoring)
  returning id into new_id;

  insert into public.league_members (league_id, user_id, role)
  values (new_id, me, 'owner');

  return new_id;
end $$;

revoke all on function public.create_league(text, text, text, integer, jsonb) from public, anon;
grant execute on function public.create_league(text, text, text, integer, jsonb) to authenticated;
