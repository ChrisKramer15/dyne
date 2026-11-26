import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateLeagueWizard from './CreateLeagueWizard'
import { LEAGUE_AVATARS } from './leagueAvatars'
import { LEAGUE_NAME_MAX, validateGeneral } from './generalSettings'

const format = { name: 'Dynasty', sport: 'Baseball', accent: 'green' }

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
  it('requires a name and an avatar', () => {
    expect(Object.keys(validateGeneral({ name: '  ', avatarId: null }))).toEqual(['name', 'avatarId'])
  })
  it('rejects unknown avatar ids and over-long names', () => {
    expect(validateGeneral({ name: 'x', avatarId: 'nope' }).avatarId).toBeTruthy()
    expect(validateGeneral({ name: 'x'.repeat(LEAGUE_NAME_MAX + 1), avatarId }).name).toBeTruthy()
  })
  it('accepts a valid draft', () => {
    expect(validateGeneral({ name: 'Sunday Slugger', avatarId })).toEqual({})
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

  it('blocks Next and shows errors when name and avatar are missing', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    render(<CreateLeagueWizard format={format} onClose={() => {}} onNext={onNext} />)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(onNext).not.toHaveBeenCalled()
    expect(screen.getByText('Enter a league name.')).toBeTruthy()
    expect(screen.getByText('Choose a league avatar.')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByLabelText(/League name/))
  })

  it('continues with a trimmed name and the selected avatar', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    render(<CreateLeagueWizard format={format} onClose={() => {}} onNext={onNext} />)
    await user.type(screen.getByLabelText(/League name/), '  Sunday Slugger ')
    await user.click(screen.getByRole('radio', { name: 'Trophy' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(onNext).toHaveBeenCalledWith({
      name: 'Sunday Slugger',
      avatarId: LEAGUE_AVATARS.find((a) => a.label === 'Trophy')!.id,
    })
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
