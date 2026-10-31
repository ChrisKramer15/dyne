import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { validateIdentifier, validateLogin, validateRegister } from './validation'
import type { FieldError } from './validation'

const RUNS = { numRuns: 100 }

// Every character matched by the JS `\s` class.
const WS_CHARS = Array.from(
  { length: 0x10000 },
  (_, i) => String.fromCharCode(i),
).filter((c) => /\s/.test(c))

// Empty or whitespace-only strings built from `\s` characters.
const blank = fc
  .array(fc.constantFrom(...WS_CHARS), { maxLength: 20 })
  .map((a) => a.join(''))

const nonBlank = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim() !== '')

// Feature: auth-modal, Property 5: Blank required fields are reported and block submission
describe('Feature: auth-modal, Property 5: blank required fields', () => {
  /** **Validates: Requirements 3.4, 5.5, 6.5** */
  it('validateLogin reports required for each blank field', () => {
    fc.assert(
      fc.property(blank, blank, (username, password) => {
        const errors = validateLogin({ username, password })
        expect(errors).toContainEqual({ field: 'username', code: 'required' })
        expect(errors).toContainEqual({ field: 'password', code: 'required' })
      }),
      RUNS,
    )
  })

  it('validateLogin reports only the blank field', () => {
    fc.assert(
      fc.property(blank, nonBlank, fc.boolean(), (ws, other, usernameBlank) => {
        const errors = validateLogin(
          usernameBlank ? { username: ws, password: other } : { username: other, password: ws },
        )
        expect(errors).toEqual([
          { field: usernameBlank ? 'username' : 'password', code: 'required' },
        ])
      }),
      RUNS,
    )
  })

  it('validateRegister reports required for every blank field', () => {
    fc.assert(
      fc.property(blank, blank, blank, blank, (username, email, password, confirmPassword) => {
        const errors = validateRegister({ username, email, password, confirmPassword })
        for (const field of ['username', 'email', 'password', 'confirmPassword'] as const) {
          expect(errors).toContainEqual({ field, code: 'required' })
        }
      }),
      RUNS,
    )
  })

  it('validateIdentifier reports required for blank input', () => {
    fc.assert(
      fc.property(blank, (identifier) => {
        expect(validateIdentifier(identifier)).toEqual([{ field: 'identifier', code: 'required' }])
      }),
      RUNS,
    )
  })

  it('whitespace generator includes empty and non-space whitespace', () => {
    expect(WS_CHARS.length).toBeGreaterThan(5)
  })
})

// Feature: auth-modal, Property 6: Valid login input is accepted and passed through unchanged
describe('Feature: auth-modal, Property 6: valid login input', () => {
  const username = fc
    .string({ minLength: 1, maxLength: 64 })
    .filter((s) => s.trim() !== '')
  const password = fc
    .string({ minLength: 1, maxLength: 128 })
    .filter((s) => s.trim() !== '')

  /** **Validates: Requirements 3.2** */
  it('validateLogin returns no errors and does not mutate input', () => {
    fc.assert(
      fc.property(username, password, (u, p) => {
        const input = { username: u, password: p }
        expect(validateLogin(input)).toEqual([])
        expect(input).toEqual({ username: u, password: p })
      }),
      RUNS,
    )
  })
})

// Feature: auth-modal, Property 16: Registration validation reports exactly the violated rules
describe('Feature: auth-modal, Property 16: registration validation', () => {
  const alnum = fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split(''))
  const word = (min: number, max: number) =>
    fc.array(alnum, { minLength: min, maxLength: max }).map((a) => a.join(''))
  const printable = fc.constantFrom(
    ...Array.from({ length: 94 }, (_, i) => String.fromCharCode(33 + i)),
  )

  const validUsername = fc
    .array(fc.constantFrom(...'ABCabc019_'.split('')), { minLength: 3, maxLength: 20 })
    .map((a) => a.join(''))
  const invalidUsername = fc.oneof(
    fc.array(printable, { minLength: 1, maxLength: 2 }).map((a) => a.join('')), // too short
    word(21, 40), // too long
    fc
      .tuple(word(1, 5), fc.constantFrom('-', ' ', '.', '@', '!', 'é'), word(1, 5))
      .map(([a, c, b]) => a + c + b), // bad character
  )

  // Email of exactly `total` characters, shaped local@b.co
  const emailOfLength = (total: number) => 'a'.repeat(total - 5) + '@b.co'
  const shortValidEmail = fc
    .tuple(word(1, 10), word(1, 10), word(2, 5))
    .map(([l, d, t]) => `${l}@${d}.${t}`)
  const malformedEmail = fc.oneof(
    word(1, 20), // no @
    word(1, 10).map((s) => `${s}@nodot`),
    word(1, 10).map((s) => `${s}@@x.com`),
    word(1, 10).map((s) => `${s} x@y.com`),
    word(1, 10).map((s) => `@${s}.com`),
  )
  const email = fc.oneof(
    shortValidEmail.map((e) => ({ value: e, valid: true })),
    fc.integer({ min: 250, max: 258 }).map((n) => ({ value: emailOfLength(n), valid: n <= 254 })),
    malformedEmail.map((e) => ({ value: e, valid: false })),
  )

  const password = fc.oneof(
    fc.array(printable, { minLength: 1, maxLength: 7 }).map((a) => a.join('')),
    fc.array(printable, { minLength: 8, maxLength: 30 }).map((a) => a.join('')),
  )
  const confirm = fc.tuple(printable, fc.boolean())

  /** **Validates: Requirements 6.2, 6.6, 6.7, 6.8, 6.9** */
  it('reports exactly the violated rules for non-blank input', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        validUsername,
        invalidUsername,
        email,
        password,
        confirm,
        (userOk, vu, iu, em, pw, [extra, same]) => {
          const username = userOk ? vu : iu
          const confirmPassword = same ? pw : pw + extra
          const errors = validateRegister({ username, email: em.value, password: pw, confirmPassword })

          const expected: FieldError[] = []
          if (!userOk) expected.push({ field: 'username', code: 'format' })
          if (!em.valid) expected.push({ field: 'email', code: 'invalid' })
          if (pw.length < 8) expected.push({ field: 'password', code: 'too_short' })
          if (!same) expected.push({ field: 'confirmPassword', code: 'mismatch' })

          expect(errors).toEqual(expected)
        },
      ),
      RUNS,
    )
  })

  it('accepts email of exactly 254 characters and rejects 255', () => {
    const base = { username: 'user_1', password: 'password1', confirmPassword: 'password1' }
    expect(validateRegister({ ...base, email: emailOfLength(254) })).toEqual([])
    expect(validateRegister({ ...base, email: emailOfLength(255) })).toEqual([
      { field: 'email', code: 'invalid' },
    ])
  })
})
