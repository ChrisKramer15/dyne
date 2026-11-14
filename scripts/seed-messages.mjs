// Seeds conversations, messages, notices and read markers for the chat feature.
// Usage: node scripts/seed-messages.mjs [target-email] [--reset] [--allow-hosted]
//
// Run seed-users first. `target-email` is the account that should see unread
// badges of 1, 5, 42 and 150 (default: seed.alice@example.test). It must already
// exist and have a profile; it can be a real account.
//
// Why direct SQL: public.messages has a BEFORE INSERT trigger
// (messages_set_created_at) that overwrites created_at with clock_timestamp(),
// and an UPDATE trigger that forbids changing it. The REST/RPC API therefore
// cannot create back-dated messages. This script connects to Postgres as the
// table owner and, inside ONE transaction, disables that single trigger, inserts
// the rows with explicit timestamps, and re-enables it before COMMIT. If anything
// fails the transaction rolls back and the trigger stays enabled. All other
// triggers and constraints (text checks, personal 2-participant check, group
// size) still run.
//
// Every seeded conversation is created_by a seed user. Re-running (and --reset)
// deletes only conversations created_by a seed.*@example.test user, then rebuilds.
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import {
  SEED_EMAIL_DOMAIN,
  SEED_USERS,
  assertTargetAllowed,
  isLocalUrl,
  loadEnv,
  parseArgs,
  supabaseUrl,
} from './lib/seedCommon.mjs'

loadEnv()
const { flags, positional } = parseArgs(process.argv.slice(2))
const targetEmail = (positional[0] ?? SEED_USERS[0].email).toLowerCase()

const url = supabaseUrl()
let dbUrl = process.env.SEED_DATABASE_URL
if (!dbUrl && url && isLocalUrl(url)) dbUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
if (!dbUrl) {
  console.error(
    'Missing SEED_DATABASE_URL (Postgres connection string with the database password).\n' +
      'Hosted: Project Settings -> Database -> Connection string (session pooler, port 5432).',
  )
  process.exit(1)
}
assertTargetAllowed([url, dbUrl], flags)

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const now = Date.now()

/** n strictly increasing timestamps (ms) spread over [from, to]. */
function spread(n, from, to) {
  const step = n > 1 ? (to - from) / (n - 1) : 0
  let prev = 0
  return Array.from({ length: n }, (_, i) => {
    prev = Math.max(prev + 1, Math.round(from + i * step))
    return prev
  })
}

const CHATTER = [
  'Are we still on for this weekend?',
  'Yes, I booked the court for 10am.',
  'Can someone bring balls? Mine are flat.',
  'I have a fresh tube in the car.',
  'Running ten minutes late, start without me.',
  'Good game today! Same time next week?',
  'Who is picking up the drinks after?',
  'Updated the rota, have a look when you can.',
  'Rain forecast for Saturday, backup plan is the indoor hall.',
  'Thanks for sorting that out.',
  'Anyone fancy a hit-around on Tuesday evening?',
  'Count me in.',
]
const text = (i, tag) => `${CHATTER[i % CHATTER.length]}${tag ? ` (${tag} #${i + 1})` : ''}`

// 10 sections is ~2000 chars; the messages table rejects more than 2000.
const LONG_MESSAGE = Array.from(
  { length: 10 },
  (_, i) =>
    `Section ${i + 1}: the league committee has agreed that fixtures will be played on the published dates, ` +
    'that rescheduling needs at least 48 hours notice, and that both captains confirm the result by message.',
)
  .join(' ')
  .slice(0, 2000)

const MULTILINE_MESSAGE =
  'Plan for Saturday:\n1. Meet at 9:30 for warm-up\n2. Singles from 10:00\n3. Doubles after lunch\n\nBring water and a spare shirt.'

/**
 * Builds the messages of one conversation. `read` messages come first, then
 * `unread` messages from other people than the target. Returns the marker
 * (the Read_Marker that yields exactly `unread` unread messages for the target).
 */
function buildMessages({ createdAt, others, target, read, unread, readEnd, unreadStart, special = {} }) {
  const messages = []
  const readTimes = spread(read, createdAt + 5 * MIN, readEnd)
  readTimes.forEach((at, i) => {
    const sender = i % 3 === 1 ? target : others[i % others.length]
    messages.push({ sender, at, text: text(i, 'read') })
  })
  const unreadTimes = spread(unread, unreadStart, now - 2 * MIN)
  unreadTimes.forEach((at, i) => {
    messages.push({ sender: others[i % others.length], at, text: text(i + read, 'new') })
  })
  for (const [index, value] of Object.entries(special)) {
    const m = messages[index < 0 ? messages.length + Number(index) : Number(index)]
    if (m) m.text = value
  }
  // Marker sits on the last read message, or at creation when none are read.
  const marker = readTimes.length > 0 ? readTimes[readTimes.length - 1] : createdAt
  return { messages, marker }
}

const client = new pg.Client({ connectionString: dbUrl })
await client.connect()

try {
  const { rows: seedRows } = await client.query(
    `select u.id, lower(u.email) as email, p.username
     from auth.users u left join public.profiles p on p.user_id = u.id
     where lower(u.email) like $1`,
    [`seed.%@${SEED_EMAIL_DOMAIN}`],
  )
  const seedIds = seedRows.map((r) => r.id)

  await client.query('begin')

  // Remove previous seed conversations (cascades to participants/messages/events).
  const del = await client.query('delete from public.conversations where created_by = any($1::uuid[])', [seedIds])
  console.log(`removed ${del.rowCount} seed conversation(s)`)

  if (flags.has('--reset')) {
    await client.query('commit')
    console.log('Reset complete.')
    process.exit(0)
  }

  const byEmail = new Map(seedRows.map((r) => [r.email, r]))
  const missing = SEED_USERS.filter((u) => !byEmail.has(u.email))
  if (missing.length > 0) throw new Error('Seed users missing. Run `npm run seed:users` first.')

  const { rows: targetRows } = await client.query(
    `select u.id, p.username from auth.users u join public.profiles p on p.user_id = u.id
     where lower(u.email) = $1`,
    [targetEmail],
  )
  if (targetRows.length === 0) throw new Error(`No user with a profile found for ${targetEmail}.`)
  const target = targetRows[0].id
  const names = new Map([[target, targetRows[0].username]])
  for (const r of seedRows) names.set(r.id, r.username)

  // Seed users other than the target, in a stable order.
  const partners = SEED_USERS.map((u) => byEmail.get(u.email).id).filter((id) => id !== target)
  const P = (i) => partners[i % partners.length]

  const plans = []

  // 1 unread: DM
  {
    const createdAt = now - 9 * DAY
    const { messages, marker } = buildMessages({
      createdAt, others: [P(0)], target, read: 10, unread: 1,
      readEnd: now - 2 * DAY, unreadStart: now - 12 * MIN,
    })
    plans.push({ kind: 'personal', creator: P(0), members: [P(0), target], createdAt, messages, marker, events: [] })
  }

  // 5 unread: group where one member joined and later left
  {
    const createdAt = now - 6 * DAY
    const members = [P(1), target, P(2), P(3)]
    const leaver = P(3)
    const { messages, marker } = buildMessages({
      createdAt, others: [P(1), P(2), leaver], target, read: 14, unread: 5,
      readEnd: now - 1 * DAY, unreadStart: now - 2 * HOUR,
    })
    plans.push({
      kind: 'group', name: 'Weekend Padel', creator: P(1), members, createdAt, messages, marker,
      events: [{ kind: 'left', user: leaver, at: createdAt + 3 * DAY }],
      leavers: [leaver],
    })
  }

  // 42 unread: group with a long and a multi-line message
  {
    const createdAt = now - 12 * DAY
    const members = [...new Set([P(0), target, P(1), P(2), P(4)])]
    const { messages, marker } = buildMessages({
      createdAt, others: [P(0), P(1), P(2), P(4)], target, read: 30, unread: 42,
      readEnd: now - 3 * DAY, unreadStart: now - 20 * HOUR,
      special: { 40: LONG_MESSAGE, '-1': MULTILINE_MESSAGE },
    })
    plans.push({ kind: 'group', name: 'Match Day Crew', creator: P(0), members, createdAt, messages, marker, events: [] })
  }

  // 150 unread (shows the 99+ cap): DM
  {
    const createdAt = now - 20 * DAY
    const { messages, marker } = buildMessages({
      createdAt, others: [P(1)], target, read: 20, unread: 150,
      readEnd: now - 10 * DAY, unreadStart: now - 5 * HOUR,
    })
    plans.push({ kind: 'personal', creator: P(1), members: [P(1), target], createdAt, messages, marker, events: [] })
  }

  // 0 unread: fully read DM
  {
    const createdAt = now - 30 * DAY
    const { messages, marker } = buildMessages({
      createdAt, others: [P(2)], target, read: 8, unread: 0,
      readEnd: now - 14 * DAY, unreadStart: now,
    })
    plans.push({ kind: 'personal', creator: P(2), members: [P(2), target], createdAt, messages, marker, events: [] })
  }

  // Seed-only DM so seed accounts can chat with each other too.
  {
    const a = byEmail.get(SEED_USERS[3].email).id
    const b = byEmail.get(SEED_USERS[4].email).id
    const createdAt = now - 4 * DAY
    const { messages } = buildMessages({
      createdAt, others: [a, b], target: b, read: 6, unread: 0,
      readEnd: now - 3 * DAY, unreadStart: now,
    })
    plans.push({
      kind: 'personal', creator: a, members: [a, b], createdAt, messages,
      marker: messages[messages.length - 1].at, readAll: true, events: [],
    })
  }

  await client.query('alter table public.messages disable trigger messages_set_created_at')

  const iso = (ms) => new Date(ms).toISOString()
  let skipped = 0
  const summary = []

  for (const plan of plans) {
    const convId = randomUUID()
    // Same expression as get_or_create_personal_conversation, evaluated by Postgres
    // so the collation-dependent least/greatest ordering matches the integrity trigger.
    const ins = await client.query(
      `insert into public.conversations (id, kind, name, personal_key, created_by, created_at)
       values ($1, $2, $3,
         case when $2 = 'personal' then least($4::text, $5::text) || ':' || greatest($4::text, $5::text) end,
         $6, $7)
       on conflict (personal_key) do nothing returning id`,
      [convId, plan.kind, plan.name ?? null, plan.members[0], plan.members[1], plan.creator, iso(plan.createdAt)],
    )
    if (ins.rowCount === 0) {
      console.warn(`skipped: a personal conversation between these users already exists (${plan.members.map((m) => names.get(m)).join(' / ')})`)
      skipped++
      continue
    }

    const remaining = plan.members.filter((m) => !(plan.leavers ?? []).includes(m))
    const lastAt = plan.messages[plan.messages.length - 1].at
    for (const m of plan.members) {
      if (!remaining.includes(m)) continue
      // The target gets the crafted marker; everyone else has read everything.
      const marker = m === target && !plan.readAll ? plan.marker : lastAt
      await client.query(
        `insert into public.conversation_participants (conversation_id, user_id, last_read_at, joined_at)
         values ($1, $2, $3, $4)`,
        [convId, m, iso(marker), iso(plan.createdAt)],
      )
    }

    if (plan.kind === 'group') {
      // One "joined" notice per initial member, as create_group_conversation does.
      await client.query(
        `insert into public.conversation_events (conversation_id, kind, user_id, created_at)
         select $1::uuid, 'joined', u, $3::timestamptz from unnest($2::uuid[]) u`,
        [convId, plan.members, iso(plan.createdAt)],
      )
    }
    for (const e of plan.events) {
      await client.query(
        `insert into public.conversation_events (conversation_id, kind, user_id, created_at)
         values ($1, $2, $3, $4)`,
        [convId, e.kind, e.user, iso(e.at)],
      )
    }

    const sorted = [...plan.messages].sort((x, y) => x.at - y.at)
    await client.query(
      `insert into public.messages (id, conversation_id, sender_id, text, created_at)
       select id, $2::uuid, sender, body, ts
       from unnest($1::uuid[], $3::uuid[], $4::text[], $5::timestamptz[]) with ordinality
         as t(id, sender, body, ts, ord)
       order by ord`,
      [sorted.map(() => randomUUID()), convId, sorted.map((m) => m.sender), sorted.map((m) => m.text), sorted.map((m) => iso(m.at))],
    )

    summary.push({
      conversation: plan.name ?? `DM ${plan.members.map((m) => names.get(m)).join(' / ')}`,
      messages: sorted.length,
      expectedUnreadForTarget: plan.readAll ? '-' : sorted.filter((m) => m.sender !== target && m.at > plan.marker).length,
    })
  }

  await client.query('alter table public.messages enable trigger messages_set_created_at')
  await client.query('commit')

  console.table(summary)
  if (skipped > 0) console.warn(`${skipped} conversation(s) skipped.`)
  console.log(`Seeded chat data for ${targetEmail}.`)
} catch (err) {
  await client.query('rollback').catch(() => {})
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  await client.end()
}
