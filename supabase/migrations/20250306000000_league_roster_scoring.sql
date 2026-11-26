-- League roster and scoring settings, collected by the create-league wizard.
--
-- roster:  starting slots per position, e.g. {"SP": 4, "C": 1}.
-- scoring: points per unit per category, e.g. {"bat_hr": 4, "pit_w": 5}.
-- Keys are defined by the app (src/features/leagues/wizard/leagueCategories.ts),
-- so the database only checks shape and value ranges.
-- description and visibility keep their column defaults ('' and 'private');
-- the wizard no longer asks for them.

alter table public.leagues
  add column roster  jsonb not null default '{}'::jsonb,
  add column scoring jsonb not null default '{}'::jsonb,
  add constraint league_roster_is_object  check (jsonb_typeof(roster)  = 'object'),
  add constraint league_scoring_is_object check (jsonb_typeof(scoring) = 'object');

drop function public.create_league(text, text, text, integer, text);

create function public.create_league(
  p_name        text,
  p_format      text,
  p_team_count  integer,
  p_roster      jsonb,
  p_scoring     jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  -- Table check constraints reject invalid values.
  insert into public.leagues (owner_id, name, format, team_count, roster, scoring)
  values (me, btrim(p_name), p_format, p_team_count,
          coalesce(p_roster, '{}'::jsonb), coalesce(p_scoring, '{}'::jsonb))
  returning id into new_id;

  insert into public.league_members (league_id, user_id, role)
  values (new_id, me, 'owner');

  return new_id;
end $$;

revoke all on function public.create_league(text, text, integer, jsonb, jsonb) from public, anon;
grant execute on function public.create_league(text, text, integer, jsonb, jsonb) to authenticated;
