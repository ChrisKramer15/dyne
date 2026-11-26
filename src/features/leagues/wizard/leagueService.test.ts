import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CREATE_FAILURE_MESSAGE, NOT_SIGNED_IN_MESSAGE, createLeagueService } from './leagueService'

const input = { format: 'Dynasty', name: 'Sunday Slugger', avatarId: 'avatar-012', teamCount: 16, scoring: { h_homeRuns: 4 } }

function clientWith(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as unknown as SupabaseClient
}

describe('createLeagueService', () => {
  it('calls create_league with every setting and returns the new id', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'new-id', error: null })
    const result = await createLeagueService(clientWith(rpc)).createLeague(input)
    expect(rpc).toHaveBeenCalledWith('create_league', {
      p_name: 'Sunday Slugger',
      p_format: 'Dynasty',
      p_avatar_id: 'avatar-012',
      p_team_count: 16,
      p_scoring: { h_homeRuns: 4 },
    })
    expect(result).toEqual({ ok: true, id: 'new-id' })
  })

  it('maps a database error to a generic message without leaking details', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'duplicate key value violates...' } })
    expect(await createLeagueService(clientWith(rpc)).createLeague(input)).toEqual({
      ok: false,
      reason: CREATE_FAILURE_MESSAGE,
    })
  })

  it('tells the user when their session is gone', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'not_authenticated' } })
    expect(await createLeagueService(clientWith(rpc)).createLeague(input)).toEqual({
      ok: false,
      reason: NOT_SIGNED_IN_MESSAGE,
    })
  })

  it('does not reject when the call throws or returns no id', async () => {
    const thrown = vi.fn().mockRejectedValue(new Error('network'))
    expect((await createLeagueService(clientWith(thrown)).createLeague(input)).ok).toBe(false)
    const empty = vi.fn().mockResolvedValue({ data: null, error: null })
    expect((await createLeagueService(clientWith(empty)).createLeague(input)).ok).toBe(false)
  })
})

describe('create_league team count migration', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20250310000000_create_league_team_count.sql'), 'utf8')

  it('replaces the old function and drops the temporary team_count default', () => {
    expect(sql).toMatch(/drop function if exists public\.create_league\(text, text, text, jsonb\)/i)
    expect(sql).toMatch(/alter column team_count drop default/i)
  })
  it('takes p_team_count and stays security definer, granted only to authenticated', () => {
    expect(sql).toMatch(/p_team_count\s+integer/i)
    expect(sql).toMatch(/security\s+definer\s+set\s+search_path/i)
    expect(sql).toMatch(/revoke all on function public\.create_league\(text, text, text, integer, jsonb\) from public, anon/i)
    expect(sql).toMatch(/grant execute on function public\.create_league\(text, text, text, integer, jsonb\) to authenticated/i)
  })
})

describe('create_league migration', () => {
  const path = join(process.cwd(), 'supabase/migrations/20250309000000_create_league.sql')
  const sql = () => readFileSync(path, 'utf8')

  it('exists and sorts after the drop migration', () => {
    expect(existsSync(path)).toBe(true)
    const names = ['20250309000000_create_league.sql', '20250308000000_drop_create_league_wizard.sql']
    expect([...names].sort()).toEqual([names[1], names[0]])
  })
  it('stores avatar and scoring and defaults the team count', () => {
    expect(sql()).toMatch(/add column if not exists avatar_id text/i)
    expect(sql()).toMatch(/add column if not exists scoring\s+jsonb not null/i)
    expect(sql()).toMatch(/alter column team_count set default/i)
  })
  it('is a security definer function granted only to authenticated', () => {
    expect(sql()).toMatch(/security\s+definer\s+set\s+search_path/i)
    expect(sql()).toMatch(/revoke all on function public\.create_league\(text, text, text, jsonb\) from public, anon/i)
    expect(sql()).toMatch(/grant execute on function public\.create_league\(text, text, text, jsonb\) to authenticated/i)
  })
})
