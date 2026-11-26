-- Raise the maximum league size from 20 to 32 teams (matches MAX_TEAMS in
-- src/features/leagues/wizard/leagueValidation.ts).

alter table public.leagues drop constraint league_team_count_range;
alter table public.leagues
  add constraint league_team_count_range check (team_count between 4 and 32);
