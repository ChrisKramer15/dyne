import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateLeagueWizard from './CreateLeagueWizard'
import type { LeagueService } from './leagueService'
import { LEAGUE_AVATARS } from './leagueAvatars'
import { DEFAULT_TEAMS, EMPTY_GENERAL, LEAGUE_NAME_MAX, validateGeneral } from './generalSettings'
import { ALL_SCORING_STATS, defaultScoring, validateScoring } from './scoringSettings'

const format = { name: 'Dynasty', sport: 'Baseball', accent: 'green' }

const okService = (id = 'league-1') => ({ createLeague: vi.fn().mockResolvedValue({ ok: true, id }) })

describe('league avatars', () => {
  it('offers exactly 100 avatars with unique ids, emoji and labels', () => {
    expect(LEAGUE_AVATARS).toHaveLength(100)
    for (const key of ['id', 'emoji', 'label'] as const) {
      expect(new Set(LEAGUE_AVATARS.map((a) => a[key])).size).toBe(100)
    }
  })
})

describe('validateGeneral', () => {
  const avatarId = LEAGUE_AVATARS[0].id
  const teamCount = '12'
  it('requires a name and an avatar', () => {
    expect(Object.keys(validateGeneral({ name: '  ', avatarId: null, teamCount }))).toEqual(['name', 'avatarId'])
  })
  it('rejects unknown avatar ids and over-long names', () => {
    expect(validateGeneral({ name: 'x', avatarId: 'nope', teamCount }).avatarId).toBeTruthy()
    expect(validateGeneral({ name: 'x'.repeat(LEAGUE_NAME_MAX + 1), avatarId, teamCount }).name).toBeTruthy()
  })
  it('accepts a valid draft', () => {
    expect(validateGeneral({ name: 'Sunday Slugger', avatarId, teamCount })).toEqual({})
  })
  it('defaults the team count to 32', () => {
    expect(EMPTY_GENERAL.teamCount).toBe('32')
    expect(DEFAULT_TEAMS).toBe(32)
  })
  it.each(['', 'abc', '12.5', '-8', '1e1'])('rejects non-whole team count %j', (bad) => {
    expect(validateGeneral({ name: 'x', avatarId, teamCount: bad }).teamCount).toBeTruthy()
  })
  it.each(['3', '33', '0'])('rejects out-of-range team count %s', (bad) => {
    expect(validateGeneral({ name: 'x', avatarId, teamCount: bad }).teamCount).toBeTruthy()
  })
  it.each(['4', '10', '32', ' 16 '])('accepts team count %j', (ok) => {
    expect(validateGeneral({ name: 'x', avatarId, teamCount: ok }).teamCount).toBeUndefined()
  })
  it('needs at least 6 teams for Guillotine only', () => {
    const five = { name: 'x', avatarId, teamCount: '5' }
    expect(validateGeneral(five, 'Guillotine').teamCount).toBeTruthy()
    expect(validateGeneral(five, 'Dynasty').teamCount).toBeUndefined()
    expect(validateGeneral({ ...five, teamCount: '6' }, 'Guillotine').teamCount).toBeUndefined()
  })
})

describe('CreateLeagueWizard General Settings view', () => {
  afterEach(() => cleanup())

  it('shows a General Settings header, a name field and 100 avatar choices', () => {
    render(<CreateLeagueWizard format={format} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'General Settings' })
    expect(within(dialog).getByLabelText(/League name/)).toBeTruthy()
    expect(within(dialog).getAllByRole('radio')).toHaveLength(100)
  })

  it('uses the chosen format accent color', () => {
    const { container } = render(<CreateLeagueWizard format={format} onClose={() => {}} />)
    expect(container.querySelector('.league-wizard')?.classList.contains('accent-green')).toBe(true)
  })

  it('has a Number of teams field that starts at 32', () => {
    render(<CreateLeagueWizard format={format} onClose={() => {}} />)
    expect((screen.getByLabelText(/Number of teams/) as HTMLInputElement).value).toBe('32')
    expect(screen.getByText('4 to 32 teams.')).toBeTruthy()
  })

  it('shows a 6 team minimum for Guillotine', () => {
    render(<CreateLeagueWizard format={{ ...format, name: 'Guillotine' }} onClose={() => {}} />)
    expect(screen.getByText('6 to 32 teams.')).toBeTruthy()
  })

  it('blocks Next on a bad team count and focuses the field', async () => {
    const user = userEvent.setup()
    render(<CreateLeagueWizard format={format} onClose={() => {}} service={okService()} />)
    await user.type(screen.getByLabelText(/League name/), 'Sunday Slugger')
    await user.click(screen.getByRole('radio', { name: 'Trophy' }))
    const teams = screen.getByLabelText(/Number of teams/)
    await user.clear(teams)
    await user.type(teams, '40')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Use 4 to 32 teams.')).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Scoring Settings' })).toBeNull()
    await vi.waitFor(() => expect(document.activeElement).toBe(teams))
  })

  it('blocks Next and shows errors when name and avatar are missing', async () => {
    const user = userEvent.setup()
    const service = okService()
    render(<CreateLeagueWizard format={format} onClose={() => {}} service={service} />)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(service.createLeague).not.toHaveBeenCalled()
    expect(screen.getByText('Enter a league name.')).toBeTruthy()
    expect(screen.getByText('Choose a league avatar.')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByLabelText(/League name/))
  })

  it('moves to Scoring Settings with a trimmed name and the selected avatar kept on Back', async () => {
    const user = userEvent.setup()
    render(<CreateLeagueWizard format={format} onClose={() => {}} />)
    await user.type(screen.getByLabelText(/League name/), '  Sunday Slugger ')
    await user.click(screen.getByRole('radio', { name: 'Trophy' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('dialog', { name: 'Scoring Settings' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('dialog', { name: 'General Settings' })).toBeTruthy()
    expect((screen.getByLabelText(/League name/) as HTMLInputElement).value).toBe('  Sunday Slugger ')
    expect((screen.getByRole('radio', { name: 'Trophy' }) as HTMLInputElement).checked).toBe(true)
  })
  it('clears an error once the field is fixed', async () => {
    const user = userEvent.setup()
    render(<CreateLeagueWizard format={format} onClose={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('radio', { name: 'Fire' }))
    expect(screen.queryByText('Choose a league avatar.')).toBeNull()
  })

  it('closes from Cancel and Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<CreateLeagueWizard format={format} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

async function openScoring(user: ReturnType<typeof userEvent.setup>, service: LeagueService = okService(), onCreated?: (id: string) => void) {
  render(<CreateLeagueWizard format={format} onClose={() => {}} service={service} onCreated={onCreated} />)
  await user.type(screen.getByLabelText(/League name/), 'Sunday Slugger')
  await user.click(screen.getByRole('radio', { name: 'Trophy' }))
  await user.click(screen.getByRole('button', { name: 'Next' }))
}
describe('Scoring Settings view', () => {
  afterEach(() => cleanup())

  it('has hitting, pitching and fielding groups prefilled with defaults', async () => {
    const user = userEvent.setup()
    await openScoring(user)
    for (const name of ['Hitting', 'Pitching', 'Fielding']) {
      expect(screen.getByRole('group', { name })).toBeTruthy()
    }
    const hitting = within(screen.getByRole('group', { name: 'Hitting' }))
    expect((hitting.getByLabelText(/Home runs/) as HTMLInputElement).value).toBe('4')
    expect((hitting.getByLabelText(/Strikeouts/) as HTMLInputElement).value).toBe('-0.5')
    const pitching = within(screen.getByRole('group', { name: 'Pitching' }))
    expect((pitching.getByLabelText(/Strikeouts/) as HTMLInputElement).value).toBe('1')
    expect((within(screen.getByRole('group', { name: 'Fielding' })).getByLabelText(/Errors/) as HTMLInputElement).value).toBe('-1')
  })

  it('has one input per defined stat', async () => {
    const user = userEvent.setup()
    await openScoring(user)
    expect(screen.getAllByRole('textbox')).toHaveLength(ALL_SCORING_STATS.length)
    expect(new Set(ALL_SCORING_STATS.map((s) => s.key)).size).toBe(ALL_SCORING_STATS.length)
  })

  it('blocks Finish on a bad value and shows the error', async () => {
    const user = userEvent.setup()
    const service = okService()
    await openScoring(user, service)
    const hr = within(screen.getByRole('group', { name: 'Hitting' })).getByLabelText(/Home runs/)
    await user.clear(hr)
    await user.type(hr, 'abc')
    await user.click(screen.getByRole('button', { name: 'Finish' }))
    expect(service.createLeague).not.toHaveBeenCalled()
    expect(screen.getByText('Enter a number.')).toBeTruthy()
    expect(hr.getAttribute('aria-invalid')).toBe('true')
  })

  it('Finish saves the league with every setting and reports the new id', async () => {
    const user = userEvent.setup()
    const service = okService()
    await openScoring(user, service)
    const hr = within(screen.getByRole('group', { name: 'Hitting' })).getByLabelText(/Home runs/)
    await user.clear(hr)
    await user.type(hr, '-2.5')
    await user.click(screen.getByRole('button', { name: 'Finish' }))
    expect(service.createLeague).toHaveBeenCalledTimes(1)
    const draft = service.createLeague.mock.calls[0][0]
    expect(draft.format).toBe('Dynasty')
    expect(draft.name).toBe('Sunday Slugger')
    expect(draft.teamCount).toBe(32)
    expect(draft.avatarId).toBe(LEAGUE_AVATARS.find((a) => a.label === 'Trophy')!.id)
    expect(draft.scoring.h_homeRuns).toBe(-2.5)
    expect(draft.scoring.p_wins).toBe(5)
  })

  it('Reset to defaults restores edited values', async () => {
    const user = userEvent.setup()
    await openScoring(user)
    const hr = within(screen.getByRole('group', { name: 'Hitting' })).getByLabelText(/Home runs/) as HTMLInputElement
    await user.clear(hr)
    await user.type(hr, '9')
    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }))
    expect(hr.value).toBe('4')
  })
})

describe('validateScoring', () => {
  it('accepts the defaults and common number forms', () => {
    expect(validateScoring(defaultScoring())).toEqual({})
    const v = { ...defaultScoring(), h_runs: '.5', h_rbi: '-1.', h_walks: ' 2 ' }
    expect(validateScoring(v)).toEqual({})
  })
  it('rejects blanks, text and values beyond the limit', () => {
    const v = { ...defaultScoring(), h_runs: '', h_rbi: '1e3', h_walks: '101', h_doubles: '-' }
    expect(Object.keys(validateScoring(v)).sort()).toEqual(['h_doubles', 'h_rbi', 'h_runs', 'h_walks'])
  })
})

describe('Finish', () => {
  afterEach(() => cleanup())

  it('shows Finish on the last step and calls onCreated with the id', async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    await openScoring(user, okService('abc-123'), onCreated)
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Finish' }))
    expect(onCreated).toHaveBeenCalledWith('abc-123')
  })

  it('sends the full scoring set as numbers', async () => {
    const user = userEvent.setup()
    const service = okService()
    await openScoring(user, service)
    await user.click(screen.getByRole('button', { name: 'Finish' }))
    const sent = service.createLeague.mock.calls[0][0].scoring
    expect(Object.keys(sent).sort()).toEqual(ALL_SCORING_STATS.map((s) => s.key).sort())
    expect(Object.values(sent).every((v) => typeof v === 'number')).toBe(true)
  })

  it('shows the error, keeps the entries and allows a retry when saving fails', async () => {
    const user = userEvent.setup()
    const createLeague = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, reason: 'Your league could not be created. Please try again.' })
      .mockResolvedValueOnce({ ok: true, id: 'x' })
    const onCreated = vi.fn()
    await openScoring(user, { createLeague }, onCreated)
    await user.click(screen.getByRole('button', { name: 'Finish' }))
    expect(screen.getByRole('alert').textContent).toContain('could not be created')
    expect(onCreated).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Finish' }))
    expect(onCreated).toHaveBeenCalledWith('x')
  })

  it('disables the buttons and ignores a second click while saving', async () => {
    const user = userEvent.setup()
    let resolve!: (r: { ok: true; id: string }) => void
    const createLeague = vi.fn().mockReturnValue(new Promise((r) => (resolve = r)))
    await openScoring(user, { createLeague })
    await user.click(screen.getByRole('button', { name: 'Finish' }))
    const busy = screen.getByRole('button', { name: 'Creating…' }) as HTMLButtonElement
    expect(busy.disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Back' }) as HTMLButtonElement).disabled).toBe(true)
    await user.keyboard('{Enter}')
    expect(createLeague).toHaveBeenCalledTimes(1)
    resolve({ ok: true, id: 'z' })
  })
})