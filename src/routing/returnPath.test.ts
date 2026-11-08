import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { readReturnPath } from './returnPath'

describe('readReturnPath', () => {
  it('accepts plain in-app paths, including search and hash', () => {
    expect(readReturnPath({ from: '/leagues' })).toBe('/leagues')
    expect(readReturnPath({ from: '/profile?tab=1#top' })).toBe('/profile?tab=1#top')
  })

  it('rejects missing or non-string values', () => {
    for (const state of [null, undefined, 'x', 42, {}, { from: 1 }, { from: null }]) {
      expect(readReturnPath(state)).toBeNull()
    }
  })

  it('rejects absolute, protocol-relative and backslash URLs', () => {
    for (const from of ['https://evil.test/', '//evil.test', '/\\evil.test', 'leagues', 'javascript:alert(1)']) {
      expect(readReturnPath({ from })).toBeNull()
    }
  })

  it('rejects the landing page so a redirect can never loop', () => {
    for (const from of ['/', '/?x=1', '/#a']) expect(readReturnPath({ from })).toBeNull()
  })

  it('never returns anything that is not a single-slash in-app path', () => {
    fc.assert(
      fc.property(fc.string(), (from) => {
        const out = readReturnPath({ from })
        if (out !== null) {
          expect(out.startsWith('/')).toBe(true)
          expect(out.startsWith('//')).toBe(false)
          expect(out.includes('\\')).toBe(false)
        }
      }),
      { numRuns: 200 },
    )
  })
})
