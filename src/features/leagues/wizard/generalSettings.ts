import { findAvatar } from './leagueAvatars'

export const LEAGUE_NAME_MAX = 40

/** Answers collected by the General Settings step. */
export interface GeneralSettings {
  name: string
  /** Id from LEAGUE_AVATARS, or null until one is picked. */
  avatarId: string | null
}

export type GeneralErrors = Partial<Record<keyof GeneralSettings, string>>

export const EMPTY_GENERAL: GeneralSettings = { name: '', avatarId: null }

export function validateGeneral(s: GeneralSettings): GeneralErrors {
  const errors: GeneralErrors = {}
  const name = s.name.trim()
  if (name.length === 0) errors.name = 'Enter a league name.'
  else if (name.length > LEAGUE_NAME_MAX) errors.name = `Use ${LEAGUE_NAME_MAX} characters or fewer.`
  if (!findAvatar(s.avatarId)) errors.avatarId = 'Choose a league avatar.'
  return errors
}
