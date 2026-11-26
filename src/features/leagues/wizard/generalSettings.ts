import { findAvatar } from './leagueAvatars'

export const LEAGUE_NAME_MAX = 40
/** Matches the league_team_count_range check in the database. */
export const MIN_TEAMS = 4
export const MAX_TEAMS = 32
export const DEFAULT_TEAMS = 32
/** Matches the league_guillotine_min check in the database. */
const GUILLOTINE_MIN_TEAMS = 6

/** Answers collected by the General Settings step. */
export interface GeneralSettings {
  name: string
  /** Id from LEAGUE_AVATARS, or null until one is picked. */
  avatarId: string | null
  /** Raw text from the input so it can be edited freely. Use parseTeamCount to read it. */
  teamCount: string
}

export type GeneralErrors = Partial<Record<keyof GeneralSettings, string>>

export const EMPTY_GENERAL: GeneralSettings = { name: '', avatarId: null, teamCount: String(DEFAULT_TEAMS) }

export function minTeamsFor(format: string): number {
  return format === 'Guillotine' ? GUILLOTINE_MIN_TEAMS : MIN_TEAMS
}

/** The team count as an integer, or null if the text is not a whole number. */
export function parseTeamCount(raw: string): number | null {
  const t = raw.trim()
  return /^\d+$/.test(t) ? Number(t) : null
}

export function validateGeneral(s: GeneralSettings, format = ''): GeneralErrors {
  const errors: GeneralErrors = {}
  const name = s.name.trim()
  if (name.length === 0) errors.name = 'Enter a league name.'
  else if (name.length > LEAGUE_NAME_MAX) errors.name = `Use ${LEAGUE_NAME_MAX} characters or fewer.`
  if (!findAvatar(s.avatarId)) errors.avatarId = 'Choose a league avatar.'
  const min = minTeamsFor(format)
  const teams = parseTeamCount(s.teamCount)
  if (teams === null) errors.teamCount = 'Enter a whole number of teams.'
  else if (teams < min || teams > MAX_TEAMS) errors.teamCount = `Use ${min} to ${MAX_TEAMS} teams.`
  return errors
}
