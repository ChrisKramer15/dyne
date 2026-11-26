import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import {
  submitLeague,
  GENERIC_FAILURE_MESSAGE,
  TIMEOUT_MESSAGE,
  LEAGUE_SUBMIT_TIMEOUT_MS,
  type LeagueService,
  type NewLeague,
} from './leagueService'

const leagueArb: fc.Arbitrary<NewLeague> = fc.record({
  format: fc.string({ minLength: 1, maxLength: 20 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  teamCount: fc.integer({ min: 6, max: 32 }),
  roster: fc.constant({ SP: 4, C: 1 }),
  scoring: fc.constant({ bat_hr: 4, pit_w: 5 }),
})

const nonBlankReasonArb = fc.string({ minLength: 1, maxLength: 60 }).filter((s) => s.trim() !== '')
const blankReasonArb = fc.oneof(
  fc.constant(undefined),
  fc.constant(''),
  fc.array(fc.constantFrom(' ', '\t', '\n'), { maxLength: 5 }).map((a) => a.join('')),
)

describe('leagueService properties', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // Feature: create-league-wizard-modal, Property 14: Failure retains the draft and reports a message
  // **Validates: Requirements 8.5, 8.6, 8.8**
  it('maps a non-blank reason to itself', async () => {
    await fc.assert(
      fc.asyncProperty(leagueArb, nonBlankReasonArb, async (league, reason) => {
        const service: LeagueService = { createLeague: async () => ({ ok: false, reason }) }
        expect(await submitLeague(service, league)).toEqual({ ok: false, message: reason })
      }),
    )
  })

  // **Validates: Requirements 8.5, 8.6, 8.8**
  it('maps a missing or blank reason to the generic message', async () => {
    await fc.assert(
      fc.asyncProperty(leagueArb, blankReasonArb, async (league, reason) => {
        const service: LeagueService = { createLeague: async () => ({ ok: false, reason }) }
        expect(await submitLeague(service, league)).toEqual({
          ok: false,
          message: GENERIC_FAILURE_MESSAGE,
        })
      }),
    )
  })

  // **Validates: Requirements 8.5, 8.6, 8.8**
  it('maps any rejection or synchronous throw to the generic message without rejecting', async () => {
    await fc.assert(
      fc.asyncProperty(leagueArb, fc.anything(), fc.boolean(), async (league, err, sync) => {
        const service: LeagueService = {
          createLeague: sync
            ? () => {
                throw err
              }
            : () => Promise.reject(err),
        }
        expect(await submitLeague(service, league)).toEqual({
          ok: false,
          message: GENERIC_FAILURE_MESSAGE,
        })
      }),
    )
  })

  // **Validates: Requirements 8.5, 8.6, 8.8**
  it('maps no response within the timeout to the timeout message, ignoring a late response', async () => {
    await fc.assert(
      fc.asyncProperty(
        leagueArb,
        fc.integer({ min: 1, max: LEAGUE_SUBMIT_TIMEOUT_MS }),
        async (league, timeoutMs) => {
          let resolveLate: (v: { ok: true; leagueId: string }) => void = () => {}
          const service: LeagueService = {
            createLeague: () =>
              new Promise((resolve) => {
                resolveLate = resolve
              }),
          }
          const pending = submitLeague(service, league, timeoutMs)
          await vi.advanceTimersByTimeAsync(timeoutMs)
          expect(await pending).toEqual({ ok: false, message: TIMEOUT_MESSAGE })
          resolveLate({ ok: true, leagueId: 'late' })
          await vi.advanceTimersByTimeAsync(0)
        },
      ),
    )
  })
})
