import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Smoke test for the leagues migration (Requirements 8.1, 8.4).
const migrationPath = join(process.cwd(), 'supabase/migrations/20250305000000_leagues.sql')

const leagueTables = ['leagues', 'league_members']

describe('leagues migration', () => {
  it('exists', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it.each(leagueTables)('enables row level security on public.%s', (table) => {
    const sql = readFileSync(migrationPath, 'utf8')
    const pattern = new RegExp(
      `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
      'i',
    )
    expect(sql).toMatch(pattern)
  })

  it('defines create_league as security definer, granted to authenticated', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toMatch(/create\s+function\s+public\.create_league\s*\(/i)
    expect(sql).toMatch(/security\s+definer\s+set\s+search_path/i)
    expect(sql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.create_league\([^)]*\)\s+to\s+authenticated/i,
    )
  })
})
