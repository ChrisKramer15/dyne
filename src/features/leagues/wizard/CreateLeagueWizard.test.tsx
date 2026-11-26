import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CreateLeagueWizard } from './CreateLeagueWizard'
import {
  GENERIC_FAILURE_MESSAGE,
  LEAGUE_SUBMIT_TIMEOUT_MS,
  TIMEOUT_MESSAGE,
  type CreateLeagueResult,
  type LeagueService,
} from './leagueService'

function makeService(impl?: LeagueService['createLeague']): LeagueService {
  return {
    createLeague: vi.fn(impl ?? (async () => ({ ok: true, leagueId: 'league-1' }) as CreateLeagueResult)),
  }
}

function renderWizard(opts: { format?: string; service?: LeagueService } = {}) {
  const service = opts.service ?? makeService()
  const onClose = vi.fn()
  const onCreated = vi.fn()
  render(
    <CreateLeagueWizard
      format={opts.format ?? 'Dynasty'}
      service={service}
      onClose={onClose}
      onCreated={onCreated}
    />,
  )
  return { service, onClose, onCreated }
}

const next = () => screen.getByRole('button', { name: 'Next' })
const back = () => screen.getByRole('button', { name: 'Back' })
const closeBtn = () => screen.getByRole('button', { name: 'Close' })
const create = () => screen.getByRole('button', { name: 'Create league' })
const nameInput = () => screen.getByLabelText('League name')

/** General (valid name) -> Roster -> Scoring, with real timers. */
async function reachScoring(user: ReturnType<typeof userEvent.setup>) {
  await user.type(nameInput(), 'Sandlot Kings')
  await user.click(next())
  await user.click(next())
}

/** Same walk without user-event, safe under fake timers. */
function reachScoringSync() {
  fireEvent.change(nameInput(), { target: { value: 'Sandlot Kings' } })
  fireEvent.click(next())
  fireEvent.click(next())
}

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('CreateLeagueWizard dialog shell', () => {
  it('renders a modal dialog named after the opening format (1.1, 1.5)', () => {
    renderWizard({ format: 'Bestball' })
    const dialog = screen.getByRole('dialog', { name: 'Create a Bestball league' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).not.toHaveAttribute('aria-busy')
  })

  it('opens on General and never asks for a format (1.1, 3.1)', () => {
    renderWizard()
    expect(screen.getByText('Step 1 of 3: General')).toBeInTheDocument()
    expect(screen.queryAllByRole('radio', { name: /Dynasty|Keeper|Redraft/ })).toHaveLength(0)
    expect(screen.queryByRole('group', { name: 'League format' })).toBeNull()
    expect(screen.getByRole('list', { name: 'Progress' }).querySelectorAll('li')).toHaveLength(3)
  })

  it('focuses the first interactive element of the General step on open (1.2)', () => {
    renderWizard()
    expect(document.activeElement).toBe(nameInput())
  })

  it('wraps Tab from the last control to the first and Shift+Tab back (1.6, 9.9)', async () => {
    const user = userEvent.setup()
    renderWizard()
    // Back is disabled on step 1, so Next is the last focusable control.
    next().focus()
    await user.tab()
    expect(document.activeElement).toBe(closeBtn())
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(next())
  })
})

describe('CreateLeagueWizard steps', () => {
  it('shows step titles and status text as the user moves (2.1)', async () => {
    const user = userEvent.setup()
    renderWizard()
    expect(screen.getByText('Step 1 of 3: General')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument()

    await user.type(nameInput(), 'Sandlot Kings')
    await user.click(next())
    expect(screen.getByText('Step 2 of 3: Roster')).toBeInTheDocument()
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Roster' }))

    const progress = screen.getByRole('list', { name: 'Progress' })
    const items = within(progress).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[1]).toHaveAttribute('aria-current', 'step')
    expect(items[0]).not.toHaveAttribute('aria-current')
    expect(items[2]).not.toHaveAttribute('aria-current')
  })

  it('disables Back on the General step and enables it afterwards (6.4)', async () => {
    const user = userEvent.setup()
    renderWizard()
    expect(back()).toBeDisabled()
    await user.type(nameInput(), 'Sandlot Kings')
    await user.click(next())
    expect(back()).toBeEnabled()
  })

  it('replaces Next with Create league on Scoring (6.7)', async () => {
    const user = userEvent.setup()
    renderWizard()
    await reachScoring(user)
    expect(create()).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
    expect(screen.getByText('Step 3 of 3: Scoring')).toBeInTheDocument()
  })

  it('marks an invalid field with aria-invalid and a described error, and clears it on edit (4.5, 4.6)', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.click(next())

    const input = nameInput()
    expect(screen.getByText('Step 1 of 3: General')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const errorId = input.getAttribute('aria-describedby')
    expect(errorId).toBeTruthy()
    expect(document.getElementById(errorId!)).toHaveTextContent('Enter a league name')
    expect(document.activeElement).toBe(input)

    await user.type(input, 'A')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByText('Enter a league name')).toBeNull()
  })

  it('shows the Guillotine hint and range error for the team count (5.4)', async () => {
    const user = userEvent.setup()
    renderWizard({ format: 'Guillotine' })
    expect(screen.getByText('6 to 32 teams')).toBeInTheDocument()
    await user.type(nameInput(), 'Cut Throat')
    const teams = screen.getByLabelText('Number of teams')
    await user.clear(teams)
    await user.type(teams, '5')
    await user.click(next())
    expect(teams).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(/from 6 to 32/)).toBeInTheDocument()
    expect(teams).toHaveValue('5')
    expect(screen.getByText('Step 1 of 3: General')).toBeInTheDocument()
  })
  it('offers a slot count for each roster position', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.type(nameInput(), 'Sandlot Kings')
    await user.click(next())
    for (const label of [
      'Starting Pitcher',
      'Relief Pitcher',
      'Closing Pitcher',
      'Catcher',
      'First Base',
      'Second Base',
      'Shortstop',
      'Third Base',
      'Left Fielder',
      'Center Fielder',
      'Right Fielder',
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })
  it('blocks Next on Roster for an invalid slot count and when no slot is filled', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.type(nameInput(), 'Sandlot Kings')
    await user.click(next())
    const sp = screen.getByLabelText('Starting Pitcher')
    await user.clear(sp)
    await user.type(sp, 'x')
    await user.click(next())
    expect(sp).toHaveAttribute('aria-invalid', 'true')
    expect(sp).toHaveFocus()
    expect(screen.getByText('Step 2 of 3: Roster')).toBeInTheDocument()
    for (const p of ['Starting Pitcher', 'Relief Pitcher', 'Closing Pitcher', 'Catcher', 'First Base', 'Second Base', 'Shortstop', 'Third Base', 'Left Fielder', 'Center Fielder', 'Right Fielder']) {
      const input = screen.getByLabelText(p)
      await user.clear(input)
      await user.type(input, '0')
    }
    await user.click(next())
    expect(screen.getByText('Fill at least one roster slot')).toBeInTheDocument()
  })
  it('offers hitting, pitching and fielding scoring categories and validates them', async () => {
    const user = userEvent.setup()
    renderWizard()
    await reachScoring(user)
    for (const group of ['Hitting', 'Pitching', 'Fielding']) {
      expect(screen.getByRole('group', { name: group })).toBeInTheDocument()
    }
    expect(within(screen.getByRole('group', { name: 'Hitting' })).getByLabelText('Home Runs (HR)')).toHaveValue('4')
    expect(within(screen.getByRole('group', { name: 'Pitching' })).getByLabelText('Saves (SV)')).toBeInTheDocument()
    const errors = within(screen.getByRole('group', { name: 'Fielding' })).getByLabelText('Errors (E)')
    await user.clear(errors)
    await user.type(errors, 'abc')
    await user.click(create())
    expect(errors).toHaveAttribute('aria-invalid', 'true')
    expect(errors).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Create league' })).toBeEnabled()
  })
  it('keeps edited roster and scoring values when navigating back and forward', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.type(nameInput(), 'Sandlot Kings')
    await user.click(next())
    const sp = screen.getByLabelText('Starting Pitcher')
    await user.clear(sp)
    await user.type(sp, '6')
    await user.click(next())
    await user.click(back())
    expect(screen.getByLabelText('Starting Pitcher')).toHaveValue('6')
  })
})
describe('CreateLeagueWizard submission', () => {
  it('is busy while submitting, then closes via onCreated on success (8.3, 8.4)', async () => {
    const user = userEvent.setup()
    const d = deferred<CreateLeagueResult>()
    const { service, onCreated, onClose } = renderWizard({ service: makeService(() => d.promise) })
    await reachScoring(user)

    await user.click(create())
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-busy', 'true')
    expect(create()).toBeDisabled()
    expect(back()).toBeDisabled()
    expect(closeBtn()).toBeDisabled()

    await user.keyboard('{Escape}')
    fireEvent.mouseDown(dialog.parentElement!)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await act(async () => {
      d.resolve({ ok: true, leagueId: 'abc' })
    })
    expect(service.createLeague).toHaveBeenCalledTimes(1)
    expect(service.createLeague).toHaveBeenCalledWith({
      format: 'Dynasty',
      name: 'Sandlot Kings',
      teamCount: 10,
      roster: expect.objectContaining({ SP: 4, RP: 2, CP: 1, C: 1, RF: 1 }),
      scoring: expect.objectContaining({ bat_hr: 4, bat_k: -0.5, pit_w: 5, fld_e: -1 }),
    })
    expect(onCreated).toHaveBeenCalledWith('abc')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows the failure reason, re-enables controls and retains the draft (8.5)', async () => {
    const user = userEvent.setup()
    const { onCreated } = renderWizard({
      service: makeService(async () => ({ ok: false, reason: 'Name already taken' })),
    })
    await reachScoring(user)
    await user.click(create())

    expect(await screen.findByText('Name already taken')).toBeInTheDocument()
    const dialog = screen.getByRole('dialog')
    expect(dialog).not.toHaveAttribute('aria-busy')
    expect(create()).toBeEnabled()
    expect(back()).toBeEnabled()
    expect(closeBtn()).toBeEnabled()
    await user.click(back())
    await user.click(back())
    expect(nameInput()).toHaveValue('Sandlot Kings')
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('falls back to the generic message without a reason (8.5)', async () => {
    const user = userEvent.setup()
    renderWizard({ service: makeService(async () => ({ ok: false })) })
    await reachScoring(user)
    await user.click(create())
    expect(await screen.findByText(GENERIC_FAILURE_MESSAGE)).toBeInTheDocument()
  })

  it('clears the message and resubmits on retry (8.8)', async () => {
    const user = userEvent.setup()
    const d = deferred<CreateLeagueResult>()
    const createLeague = vi
      .fn<LeagueService['createLeague']>()
      .mockResolvedValueOnce({ ok: false, reason: 'Server busy' })
      .mockReturnValueOnce(d.promise)
    const { onCreated } = renderWizard({ service: { createLeague } })
    await reachScoring(user)
    await user.click(create())
    expect(await screen.findByText('Server busy')).toBeInTheDocument()

    await user.click(create())
    expect(screen.queryByText('Server busy')).toBeNull()
    expect(createLeague).toHaveBeenCalledTimes(2)
    expect(createLeague.mock.calls[1][0]).toEqual(createLeague.mock.calls[0][0])

    await act(async () => {
      d.resolve({ ok: true, leagueId: 'retry-id' })
    })
    expect(onCreated).toHaveBeenCalledWith('retry-id')
  })

  it('times out after 15 s and ignores a late response (8.7)', async () => {
    vi.useFakeTimers()
    const d = deferred<CreateLeagueResult>()
    const { onCreated } = renderWizard({ service: makeService(() => d.promise) })
    reachScoringSync()

    fireEvent.click(create())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LEAGUE_SUBMIT_TIMEOUT_MS - 1)
    })
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(screen.getByText(TIMEOUT_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-busy')

    await act(async () => {
      d.resolve({ ok: true, leagueId: 'late' })
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(onCreated).not.toHaveBeenCalled()
    expect(screen.getByText(TIMEOUT_MESSAGE)).toBeInTheDocument()
  })
})

describe('CreateLeagueWizard dismissal', () => {
  it('closes without confirmation on Escape when the draft is unchanged (9.1, 9.5)', async () => {
    const user = userEvent.setup()
    const { onClose } = renderWizard()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on backdrop press (9.2) and on the close button (9.3)', async () => {
    const user = userEvent.setup()
    const first = renderWizard()
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!)
    expect(first.onClose).toHaveBeenCalledTimes(1)

    const second = renderWizard()
    await user.click(screen.getAllByRole('button', { name: 'Close' })[1])
    expect(second.onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close when pressing inside the dialog (9.2)', () => {
    const { onClose } = renderWizard()
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('asks for confirmation when dirty; Keep editing and Escape restore focus (9.6, 9.7)', async () => {
    const user = userEvent.setup()
    const { onClose } = renderWizard()
    const input = nameInput()
    await user.type(input, 'Sandlot')
    expect(input).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    const confirm = screen.getByRole('group', { name: 'Discard changes' })
    const buttons = within(confirm).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['Discard', 'Keep editing'])
    expect(screen.getByRole('button', { name: 'Keep editing' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.queryByRole('group', { name: 'Discard changes' })).toBeNull()
    expect(input).toHaveValue('Sandlot')
    expect(input).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.getByRole('group', { name: 'Discard changes' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('group', { name: 'Discard changes' })).toBeNull()
    expect(input).toHaveFocus()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes after Discard (9.6, 9.8)', async () => {
    const user = userEvent.setup()
    const { onClose } = renderWizard()
    await user.type(nameInput(), 'Sandlot')
    await user.click(closeBtn())
    expect(onClose).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
