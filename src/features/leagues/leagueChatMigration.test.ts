import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20250313000000_league_chat.sql'), 'utf8')

describe('league chat migration', () => {
  it('links conversations to a league and allows one group chat per league', () => {
    expect(sql).toMatch(/add\s+column\s+league_id\s+uuid\s+references\s+public\.leagues\(id\)\s+on\s+delete\s+cascade/i)
    expect(sql).toMatch(/create\s+unique\s+index\s+conversations_league_chat_idx[\s\S]*where\s+kind\s*=\s*'group'/i)
  })

  it('keeps league DMs separate by putting the league id in the personal key', () => {
    expect(sql).toMatch(/key\s*:=\s*lg::text\s*\|\|/i)
    expect(sql).toMatch(/expected\s*:=\s*conv_league::text/i)
  })

  it('requires both people to be league members before opening a league DM', () => {
    const fn = sql.slice(sql.indexOf('create function public.get_or_create_league_dm'))
    expect(fn).toMatch(/not_league_member/)
  })

  it('blocks manual changes to league group chat membership', () => {
    expect(sql).toMatch(/league_chat_managed/)
    expect(sql).toMatch(/create\s+trigger\s+conversation_participants_league_guard/i)
  })

  it('does not expose the sync helpers to clients', () => {
    expect(sql).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.league_chat_add_participant\(uuid,\s*uuid\),\s*public\.league_chat_ensure\(uuid\)\s+from\s+public,\s+anon,\s+authenticated/i,
    )
  })

  it.each(['get_or_create_league_chat(uuid)', 'league_member_list(uuid)', 'get_or_create_league_dm(uuid, uuid)'])(
    'grants %s to authenticated',
    (fn) => {
      const grant = sql.slice(sql.lastIndexOf('grant execute on function'))
      expect(grant).toContain(`public.${fn}`)
      expect(grant).toMatch(/to\s+authenticated/i)
    },
  )
})
