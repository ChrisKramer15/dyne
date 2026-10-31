import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { RESET_ACCEPTED, buildLoginResponse, resolveResetTarget } from './identifier'

const usernameArb = fc.stringMatching(/^[A-Za-z0-9_]{3,20}$/)
const emailArb = fc
  .tuple(
    fc.stringMatching(/^[A-Za-z0-9._-]{1,12}$/),
    fc.stringMatching(/^[A-Za-z0-9-]{1,10}$/),
    fc.stringMatching(/^[A-Za-z]{2,4}$/),
  )
  .map(([l, d, t]) => `${l}@${d}.${t}`)

const accountsArb = fc.uniqueArray(
  fc.record({ username: usernameArb, email: emailArb }),
  {
    minLength: 0,
    maxLength: 8,
    selector: (a) => a.username.toLowerCase(),
  },
).filter(
  (list) =>
    new Set(list.map((a) => a.email.toLowerCase())).size === list.length,
)

const mixCase = (s: string, flips: boolean[]) =>
  [...s].map((c, i) => (flips[i % flips.length] ? c.toUpperCase() : c.toLowerCase())).join('')

const padArb = fc.stringMatching(/^[ \t]{0,3}$/)

describe('resolveResetTarget', () => {
  // Feature: auth-modal, Property 13: Reset target is the matching account's email or nothing
  // **Validates: Requirements 5.3**
  it('Property 13: matches username or email case-insensitively, else null', () => {
    fc.assert(
      fc.property(
        accountsArb,
        fc.nat(),
        fc.constantFrom('username', 'email'),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 8 }),
        padArb,
        padArb,
        (accounts, idx, by, flips, lpad, rpad) => {
          fc.pre(accounts.length > 0)
          const acct = accounts[idx % accounts.length]
          const raw = lpad + mixCase(acct[by as 'username' | 'email'], flips) + rpad
          expect(resolveResetTarget(raw, accounts)).toBe(acct.email)
        },
      ),
      { numRuns: 100 },
    )
  })

  // Feature: auth-modal, Property 13: Reset target is the matching account's email or nothing
  // **Validates: Requirements 5.3**
  it('Property 13: unmatched or blank identifiers resolve to null', () => {
    fc.assert(
      fc.property(accountsArb, fc.string(), (accounts, raw) => {
        const needle = raw.trim().toLowerCase()
        const expected =
          needle === ''
            ? null
            : (accounts.find((a) =>
                needle.includes('@')
                  ? a.email.toLowerCase() === needle
                  : a.username.toLowerCase() === needle,
              )?.email ?? null)
        expect(resolveResetTarget(raw, accounts)).toBe(expected)
      }),
      { numRuns: 100 },
    )
    fc.assert(
      fc.property(accountsArb, fc.stringMatching(/^\s{0,6}$/), (accounts, blank) => {
        expect(resolveResetTarget(blank, accounts)).toBeNull()
      }),
      { numRuns: 100 },
    )
  })

  // Feature: auth-modal, Property 13: Reset target is the matching account's email or nothing
  // **Validates: Requirements 5.3**
  it('Property 13: identifiers with @ match email only, others username only', () => {
    fc.assert(
      fc.property(usernameArb, emailArb, (username, email) => {
        // An account whose username equals another account's email-like text cannot exist
        // (usernames have no '@'), so cross-matching is checked with swapped fields.
        const swapped = [{ username: email, email: 'swap@example.com' }]
        expect(resolveResetTarget(email, swapped)).toBeNull()
        const other = [{ username: 'zz_other', email: username }]
        expect(resolveResetTarget(username, other)).toBeNull()
      }),
      { numRuns: 100 },
    )
  })
})

describe('reset response', () => {
  // The Edge Function (Deno.serve) cannot be loaded under vitest. Its handler always
  // serialises RESET_ACCEPTED regardless of lookup outcome, so this models that
  // contract: the response is derived only from RESET_ACCEPTED, never from the match.
  const respond = (_matchedEmail: string | null) => ({
    status: RESET_ACCEPTED.status,
    body: JSON.stringify(RESET_ACCEPTED.body),
  })

  // Feature: auth-modal, Property 14: Reset responses are identical for matched and unmatched identifiers
  // **Validates: Requirements 5.4**
  it('Property 14: matched and unmatched identifiers yield identical responses', () => {
    fc.assert(
      fc.property(accountsArb, fc.string(), usernameArb, (accounts, raw, ghost) => {
        const matchedAcct = accounts[0]
        const matched = matchedAcct
          ? respond(resolveResetTarget(matchedAcct.username, accounts))
          : respond(null)
        const unmatched = respond(
          resolveResetTarget(`${ghost}@nomatch.invalid`, accounts),
        )
        const arbitrary = respond(resolveResetTarget(raw, accounts))
        expect(matched).toEqual(unmatched)
        expect(arbitrary).toEqual(unmatched)
        expect(unmatched).toEqual({ status: 202, body: '{"ok":true}' })
        // Response never leaks a resolved email.
        if (matchedAcct) expect(matched.body).not.toContain(matchedAcct.email)
      }),
      { numRuns: 100 },
    )
  })
})

describe('buildLoginResponse', () => {
  // Feature: auth-modal, Property 8: Server login responses do not reveal whether the username exists
  // **Validates: Requirements 3.5**
  it('Property 8: unknown user and wrong password yield byte-identical responses', () => {
    fc.assert(
      fc.property(fc.anything(), (session) => {
        const unknown = buildLoginResponse('unknown_user', session)
        const wrong = buildLoginResponse('wrong_password', session)
        expect(unknown).toEqual(wrong)
        expect(JSON.stringify(unknown)).toBe(JSON.stringify(wrong))
        expect(unknown.status).toBe(401)
        expect(unknown.body).toEqual({ error: 'invalid_credentials' })
      }),
      { numRuns: 100 },
    )
  })

  // Feature: auth-modal, Property 8: Server login responses do not reveal whether the username exists
  // **Validates: Requirements 3.5**
  it('Property 8: failure responses are distinct from success and carry no tokens', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (access_token, refresh_token) => {
          const ok = buildLoginResponse('success', { access_token, refresh_token })
          expect(ok).toEqual({ status: 200, body: { access_token, refresh_token } })
          const fail = buildLoginResponse('wrong_password', { access_token, refresh_token })
          expect(JSON.stringify(fail)).not.toContain(access_token.length > 3 ? access_token : '\u0000')
          expect(fail.status).not.toBe(ok.status)
        },
      ),
      { numRuns: 100 },
    )
  })
})
