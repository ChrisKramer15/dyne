// Shared helpers for the seed scripts: env loading, safety checks, seed users.
import { createClient } from '@supabase/supabase-js'

export const SEED_PASSWORD = 'SeedPass123!'
export const SEED_EMAIL_DOMAIN = 'example.test'

/** Display name (profiles.username, 3-20 chars of [A-Za-z0-9_]) and email per seed user. */
export const SEED_USERS = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank'].map((n) => ({
  username: `seed_${n}`,
  email: `seed.${n}@${SEED_EMAIL_DOMAIN}`,
}))

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal'])

export function loadEnv() {
  try {
    process.loadEnvFile('.env')
  } catch {
    // No .env file: rely on the real environment.
  }
}

export function parseArgs(argv) {
  const flags = new Set()
  const positional = []
  for (const a of argv) {
    if (a.startsWith('--')) flags.add(a)
    else positional.push(a)
  }
  return { flags, positional }
}

export function isLocalUrl(value) {
  try {
    return LOCAL_HOSTS.has(new URL(value).hostname)
  } catch {
    return false
  }
}

/**
 * Refuses to touch anything non-local unless --allow-hosted (or
 * SEED_ALLOW_HOSTED=1) is given. `targets` are the URLs the script will use.
 */
export function assertTargetAllowed(targets, flags) {
  const hosted = targets.filter((t) => t && !isLocalUrl(t))
  if (hosted.length === 0) return
  const allowed = flags.has('--allow-hosted') || process.env.SEED_ALLOW_HOSTED === '1'
  if (!allowed) {
    const hosts = hosted.map((t) => safeHost(t)).join(', ')
    console.error(
      `Refusing to run: target is not local (${hosts}).\n` +
        'Re-run with --allow-hosted (or SEED_ALLOW_HOSTED=1) to confirm you want to write test data there.',
    )
    process.exit(1)
  }
  console.warn(`WARNING: running against a hosted target (${hosted.map(safeHost).join(', ')}).`)
}

function safeHost(value) {
  try {
    return new URL(value).host
  } catch {
    return '(unparseable url)'
  }
}

export function requireEnv(name, hint) {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing env var ${name}.${hint ? ' ' + hint : ''}`)
    process.exit(1)
  }
  return v
}

export function supabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
}

export function createAdminClient() {
  const url = supabaseUrl()
  if (!url) {
    console.error('Missing SUPABASE_URL (or VITE_SUPABASE_URL in .env).')
    process.exit(1)
  }
  const key = requireEnv(
    'SUPABASE_SERVICE_ROLE_KEY',
    'Local: run `supabase status`. Hosted: Project Settings -> API. Never commit it.',
  )
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Finds an auth user by email (case-insensitive) by paging the admin list. */
export async function findUserByEmail(admin, email) {
  const wanted = email.toLowerCase()
  for (let page = 1; page < 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === wanted)
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}
