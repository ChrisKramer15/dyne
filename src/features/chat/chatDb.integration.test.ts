import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Database integration tests against a local Supabase (`supabase start`).
 * Connection settings come from SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY and
 * SUPABASE_TEST_SERVICE_ROLE_KEY, or else from `supabase status -o env`.
 * The suite is skipped when no local stack answers.
 */

interface LocalEnv {
  url: string
  anonKey: string
  serviceKey: string
}

async function detectLocalSupabase(): Promise<LocalEnv | null> {
  let url = process.env.SUPABASE_TEST_URL
  let anonKey = process.env.SUPABASE_TEST_ANON_KEY
  let serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY
  if (!url || !anonKey || !serviceKey) {
    try {
      const out = execSync('supabase status -o env', {
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 15000,
      }).toString()
      const get = (k: string) => out.match(new RegExp(`^${k}="?([^"\\r\\n]+)"?`, 'm'))?.[1]
      url = url ?? get('API_URL')
      anonKey = anonKey ?? get('ANON_KEY')
      serviceKey = serviceKey ?? get('SERVICE_ROLE_KEY')
    } catch {
      return null
    }
  }
  if (!url || !anonKey || !serviceKey) return null
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return null
  } catch {
    return null
  }
  return { url, anonKey, serviceKey }
}

const local = await detectLocalSupabase()

const PASSWORD = 'Passw0rd!test-chat'

interface TestUser {
  id: string
  username: string
  email: string
  client: SupabaseClient
}

describe.skipIf(!local)('chat database (local Supabase)', () => {
  // The body is evaluated even when skipped, so use inert placeholders then.
  const { url, anonKey, serviceKey } = local ?? {
    url: 'http://127.0.0.1:54321',
    anonKey: 'unused',
    serviceKey: 'unused',
  }
  const opts = { auth: { persistSession: false, autoRefreshToken: false } }
  const admin = createClient(url, serviceKey, opts)
  const anon = createClient(url, anonKey, opts)
  const createdUserIds: string[] = []
  const run = randomUUID().replace(/-/g, '').slice(0, 8)
  let counter = 0

  async function makeUser(username?: string): Promise<TestUser> {
    const name = username ?? `u${run}${(counter++).toString(36)}`
    const email = `${name.toLowerCase()}-${run}@example.test`
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { username: name },
    })
    if (error || !data.user) throw error ?? new Error('createUser failed')
    createdUserIds.push(data.user.id)
    const client = createClient(url, anonKey, opts)
    const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD })
    if (signInError) throw signInError
    return { id: data.user.id, username: name, email, client }
  }

  async function personal(a: TestUser, b: TestUser): Promise<string> {
    const { data, error } = await a.client.rpc('get_or_create_personal_conversation', { other: b.id })
    expect(error).toBeNull()
    return data as string
  }

  async function send(u: TestUser, conv: string, text: string) {
    return u.client
      .from('messages')
      .insert({ id: randomUUID(), conversation_id: conv, sender_id: u.id, text })
  }

  let alice: TestUser
  let bob: TestUser
  let carol: TestUser
  let dave: TestUser

  beforeAll(async () => {
    ;[alice, bob, carol, dave] = await Promise.all([makeUser(), makeUser(), makeUser(), makeUser()])
  })

  afterAll(async () => {
    // Deleting users cascades to conversations, participants, messages and events.
    await Promise.allSettled(createdUserIds.map((id) => admin.auth.admin.deleteUser(id)))
  })

  describe('row level security', () => {
    it('hides messages from non-participants and anonymous clients (10.4)', async () => {
      const conv = await personal(alice, bob)
      const { error } = await send(alice, conv, 'secret')
      expect(error).toBeNull()

      const own = await bob.client.from('messages').select('id').eq('conversation_id', conv)
      expect(own.data).toHaveLength(1)

      const outsider = await carol.client.from('messages').select('id').eq('conversation_id', conv)
      expect(outsider.error).toBeNull()
      expect(outsider.data).toEqual([])

      const anonymous = await anon.from('messages').select('id').eq('conversation_id', conv)
      expect(anonymous.data ?? []).toEqual([])

      const outsiderConv = await carol.client.from('conversations').select('id').eq('id', conv)
      expect(outsiderConv.data).toEqual([])
    })

    it('rejects inserts from non-participants and anonymous clients (10.6)', async () => {
      const conv = await personal(alice, bob)
      const outsider = await send(carol, conv, 'intruder')
      expect(outsider.error).not.toBeNull()

      const anonymous = await anon
        .from('messages')
        .insert({ id: randomUUID(), conversation_id: conv, sender_id: alice.id, text: 'anon' })
      expect(anonymous.error).not.toBeNull()

      const { data } = await admin.from('messages').select('id').eq('conversation_id', conv).in('text', ['intruder', 'anon'])
      expect(data).toEqual([])
    })

    it('rejects a forged sender_id even for a participant (10.6)', async () => {
      const conv = await personal(alice, bob)
      const forged = await bob.client
        .from('messages')
        .insert({ id: randomUUID(), conversation_id: conv, sender_id: alice.id, text: 'forged' })
      expect(forged.error).not.toBeNull()
      const { data } = await admin.from('messages').select('id').eq('conversation_id', conv).eq('text', 'forged')
      expect(data).toEqual([])
    })

    it('does not expose or allow changes to another user\'s read marker (10.8)', async () => {
      const conv = await personal(alice, bob)

      const { data: seen } = await alice.client
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conv)
      expect(seen).toEqual([{ user_id: alice.id }])

      const outsider = await carol.client.from('conversation_participants').select('user_id').eq('conversation_id', conv)
      expect(outsider.data).toEqual([])

      const before = await admin
        .from('conversation_participants')
        .select('last_read_at')
        .eq('conversation_id', conv)
        .eq('user_id', bob.id)
        .single()
      await alice.client
        .from('conversation_participants')
        .update({ last_read_at: '2999-01-01T00:00:00Z' })
        .eq('conversation_id', conv)
        .eq('user_id', bob.id)
      const after = await admin
        .from('conversation_participants')
        .select('last_read_at')
        .eq('conversation_id', conv)
        .eq('user_id', bob.id)
        .single()
      expect(after.data).toEqual(before.data)
    })
  })

  describe('message text constraints', () => {
    it('rejects blank text on insert (10.10)', async () => {
      const conv = await personal(alice, bob)
      for (const text of ['', '   ', '\n\t ', '\u00a0\u3000']) {
        const { error } = await send(alice, conv, text)
        expect(error, JSON.stringify(text)).not.toBeNull()
      }
    })

    it('rejects 2001 characters and accepts 2000 on insert (10.10)', async () => {
      const conv = await personal(alice, bob)
      expect((await send(alice, conv, 'a'.repeat(2001))).error).not.toBeNull()
      expect((await send(alice, conv, 'a'.repeat(2000))).error).toBeNull()
    })

    it('rejects blank and over-long text on update (10.10)', async () => {
      const conv = await personal(alice, bob)
      const id = randomUUID()
      const ins = await alice.client
        .from('messages')
        .insert({ id, conversation_id: conv, sender_id: alice.id, text: 'original' })
      expect(ins.error).toBeNull()

      expect((await admin.from('messages').update({ text: '  ' }).eq('id', id)).error).not.toBeNull()
      expect((await admin.from('messages').update({ text: 'a'.repeat(2001) }).eq('id', id)).error).not.toBeNull()
      const { data } = await admin.from('messages').select('text').eq('id', id).single()
      expect(data?.text).toBe('original')
    })
  })

  describe('personal conversations', () => {
    it('returns one conversation per pair in either order (3.2, 3.3, 10.12)', async () => {
      const a = await makeUser()
      const b = await makeUser()
      const first = await personal(a, b)
      const second = await personal(b, a)
      const third = await personal(a, b)
      expect(second).toBe(first)
      expect(third).toBe(first)

      const { data } = await admin.from('conversations').select('id').eq('kind', 'personal').in('created_by', [a.id, b.id])
      expect(data).toHaveLength(1)
    })

    it('converges when both users open it concurrently (3.3)', async () => {
      const a = await makeUser()
      const b = await makeUser()
      const [x, y] = await Promise.all([personal(a, b), personal(b, a)])
      expect(x).toBe(y)
      const { data } = await admin.from('conversation_participants').select('user_id').eq('conversation_id', x)
      expect(data).toHaveLength(2)
    })

    it('rejects a self conversation and a third participant (10.11)', async () => {
      const self = await alice.client.rpc('get_or_create_personal_conversation', { other: alice.id })
      expect(self.error).not.toBeNull()

      const conv = await personal(alice, bob)
      const extra = await admin
        .from('conversation_participants')
        .insert({ conversation_id: conv, user_id: carol.id })
      expect(extra.error).not.toBeNull()
    })
  })

  describe('group conversations', () => {
    it('creates a group with a joined notice per participant (4.8)', async () => {
      const name = `Group ${run} a`
      const { data: conv, error } = await alice.client.rpc('create_group_conversation', {
        name,
        members: [bob.id, carol.id],
      })
      expect(error).toBeNull()

      const parts = await admin.from('conversation_participants').select('user_id').eq('conversation_id', conv)
      expect((parts.data ?? []).map((p) => p.user_id).sort()).toEqual([alice.id, bob.id, carol.id].sort())

      const events = await admin.from('conversation_events').select('kind, user_id').eq('conversation_id', conv)
      expect(events.data).toHaveLength(3)
      expect(events.data?.every((e) => e.kind === 'joined')).toBe(true)
      expect((events.data ?? []).map((e) => e.user_id).sort()).toEqual([alice.id, bob.id, carol.id].sort())

      const visible = await bob.client.from('conversation_events').select('id').eq('conversation_id', conv)
      expect(visible.data).toHaveLength(3)
    })

    it('rejects invalid groups without creating anything', async () => {
      const blank = await alice.client.rpc('create_group_conversation', { name: '   ', members: [bob.id, carol.id] })
      expect(blank.error).not.toBeNull()
      const long = await alice.client.rpc('create_group_conversation', { name: 'x'.repeat(61), members: [bob.id, carol.id] })
      expect(long.error).not.toBeNull()
      const name = `Small ${run}`
      const few = await alice.client.rpc('create_group_conversation', { name, members: [bob.id] })
      expect(few.error).not.toBeNull()
      const unknown = await alice.client.rpc('create_group_conversation', { name, members: [bob.id, randomUUID()] })
      expect(unknown.error).not.toBeNull()

      const { data } = await admin.from('conversations').select('id').eq('name', name)
      expect(data).toEqual([])
    })

    it('removes a leaving member and records a left notice (4.9)', async () => {
      const { data: conv } = await alice.client.rpc('create_group_conversation', {
        name: `Group ${run} b`,
        members: [bob.id, dave.id],
      })

      const { error } = await dave.client.rpc('leave_group_conversation', { conv })
      expect(error).toBeNull()

      const parts = await admin.from('conversation_participants').select('user_id').eq('conversation_id', conv)
      expect((parts.data ?? []).map((p) => p.user_id)).not.toContain(dave.id)
      expect(parts.data).toHaveLength(2)

      const left = await bob.client
        .from('conversation_events')
        .select('user_id')
        .eq('conversation_id', conv)
        .eq('kind', 'left')
      expect(left.data).toEqual([{ user_id: dave.id }])

      const list = await dave.client.rpc('list_conversations')
      expect((list.data as { conversation_id: string }[]).map((c) => c.conversation_id)).not.toContain(conv)

      const again = await dave.client.rpc('leave_group_conversation', { conv })
      expect(again.error).not.toBeNull()
    })
  })

  describe('mark_conversation_read and list_conversations', () => {
    async function latestMessageTime(conv: string): Promise<string> {
      const { data } = await admin
        .from('messages')
        .select('created_at')
        .eq('conversation_id', conv)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      return data?.created_at as string
    }

    it('keeps the marker monotonic via greatest() and is idempotent (7.9)', async () => {
      const a = await makeUser()
      const b = await makeUser()
      const conv = await personal(a, b)
      await send(a, conv, 'one')
      await send(a, conv, 'two')
      const last = await latestMessageTime(conv)

      const first = await b.client.rpc('mark_conversation_read', { conv, up_to: last })
      expect(first.error).toBeNull()
      const marker = first.data[0].last_read_at as string
      expect(new Date(marker).getTime()).toBe(new Date(last).getTime())
      expect(Number(first.data[0].unread)).toBe(0)

      const earlier = await b.client.rpc('mark_conversation_read', { conv, up_to: '2000-01-01T00:00:00Z' })
      expect(earlier.error).toBeNull()
      expect(new Date(earlier.data[0].last_read_at).getTime()).toBe(new Date(marker).getTime())
      expect(Number(earlier.data[0].unread)).toBe(0)

      const repeat = await b.client.rpc('mark_conversation_read', { conv, up_to: last })
      expect(repeat.data).toEqual(first.data)
    })

    it('rejects marking a conversation the caller is not in', async () => {
      const conv = await personal(alice, bob)
      const { error } = await carol.client.rpc('mark_conversation_read', { conv, up_to: new Date().toISOString() })
      expect(error).not.toBeNull()
    })

    it('excludes own messages from unread and respects the marker (7.9)', async () => {
      const a = await makeUser()
      const b = await makeUser()
      const conv = await personal(a, b)
      await send(a, conv, 'm1')
      await send(a, conv, 'm2')
      await send(b, conv, 'reply')

      const find = async (u: TestUser) => {
        const { data } = await u.client.rpc('list_conversations')
        return (data as { conversation_id: string; unread: number; latest_message_text: string }[]).find(
          (c) => c.conversation_id === conv,
        )
      }

      // a sent two and received one; b sent one and received two.
      expect(Number((await find(a))?.unread)).toBe(1)
      expect(Number((await find(b))?.unread)).toBe(2)
      expect((await find(a))?.latest_message_text).toBe('reply')

      await b.client.rpc('mark_conversation_read', { conv, up_to: await latestMessageTime(conv) })
      expect(Number((await find(b))?.unread)).toBe(0)
      expect(Number((await find(a))?.unread)).toBe(1)
    })
  })

  describe('search_users', () => {
    const tok = run.toLowerCase()

    it('matches case-insensitively (3.5)', async () => {
      const target = await makeUser(`Mixed${tok}Case`)
      const lower = await alice.client.rpc('search_users', { q: `mixed${tok}case` })
      expect(lower.error).toBeNull()
      expect((lower.data as { user_id: string }[]).map((r) => r.user_id)).toContain(target.id)
      const upper = await alice.client.rpc('search_users', { q: `MIXED${tok.toUpperCase()}CASE` })
      expect((upper.data as { user_id: string }[]).map((r) => r.user_id)).toContain(target.id)
    })

    it('treats % and _ literally (3.5)', async () => {
      const withUnderscore = await makeUser(`w${tok}a_b`)
      const withoutUnderscore = await makeUser(`w${tok}aXb`)

      const under = await alice.client.rpc('search_users', { q: `${tok}a_b` })
      const ids = (under.data as { user_id: string }[]).map((r) => r.user_id)
      expect(ids).toContain(withUnderscore.id)
      expect(ids).not.toContain(withoutUnderscore.id)

      const percent = await alice.client.rpc('search_users', { q: '%' })
      expect(percent.error).toBeNull()
      expect(percent.data).toEqual([])
    })

    it('returns at most 20 results (3.5)', async () => {
      const prefix = `lim${tok}`
      await Promise.all(Array.from({ length: 21 }, (_, i) => makeUser(`${prefix}${i}`)))
      const { data, error } = await alice.client.rpc('search_users', { q: prefix })
      expect(error).toBeNull()
      expect(data).toHaveLength(20)
    })

    it('returns nothing for empty or over-long text and is closed to anonymous callers', async () => {
      expect((await alice.client.rpc('search_users', { q: '   ' })).data).toEqual([])
      expect((await alice.client.rpc('search_users', { q: 'a'.repeat(51) })).data).toEqual([])
      expect((await anon.rpc('search_users', { q: 'a' })).error).not.toBeNull()
    })
  })
})
