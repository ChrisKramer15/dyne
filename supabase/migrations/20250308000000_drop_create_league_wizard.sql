-- Removes the database objects that supported the create-league wizard, which is
-- being rebuilt from scratch.
--
-- Kept: public.leagues, public.league_members, is_league_member() and their RLS
-- policies and grants. The max team count check (4 to 32) from
-- 20250307000000_league_max_teams_32.sql also stays.
--
-- Dropping the roster and scoring columns deletes whatever those columns held.

drop function if exists public.create_league(text, text, integer, jsonb, jsonb);
-- Signature from 20250305000000_leagues.sql, already replaced by 20250306000000.
drop function if exists public.create_league(text, text, text, integer, text);

-- The check constraints on these columns are dropped with them.
alter table public.leagues
  drop column if exists roster,
  drop column if exists scoring;
