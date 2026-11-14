import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Smoke test for the chat migration (Requirement 10.2).
const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20250201000000_chat_messaging.sql',
)

const chatTables = ['conversations', 'conversation_participants', 'messages', 'conversation_events']

describe('chat messaging migration', () => {
  it('exists', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it.each(chatTables)('enables row level security on public.%s', (table) => {
    const sql = readFileSync(migrationPath, 'utf8')
    const pattern = new RegExp(
      `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
      'i',
    )
    expect(sql).toMatch(pattern)
  })
})
