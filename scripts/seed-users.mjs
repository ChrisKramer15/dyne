// Creates (or reconciles) the seed test users through the Supabase Auth admin API.
// Usage: node scripts/seed-users.mjs [--reset] [--allow-hosted]
//
// The on_auth_user_created trigger copies user_metadata.username into
// public.profiles, which is what search_users() and the chat UI read, so passing
// `username` in user_metadata is all the profile setup needed.
import {
  SEED_PASSWORD,
  SEED_USERS,
  assertTargetAllowed,
  createAdminClient,
  findUserByEmail,
  loadEnv,
  parseArgs,
  supabaseUrl,
} from './lib/seedCommon.mjs'

loadEnv()
const { flags } = parseArgs(process.argv.slice(2))
assertTargetAllowed([supabaseUrl()], flags)
const admin = createAdminClient()

for (const u of SEED_USERS) {
  const existing = await findUserByEmail(admin, u.email)

  if (flags.has('--reset')) {
    if (existing) {
      // Cascades to profiles, participants, messages and conversations they created.
      const { error } = await admin.auth.admin.deleteUser(existing.id)
      if (error) throw error
      console.log(`deleted  ${u.email}`)
    }
    continue
  }

  if (existing) {
    // Re-assert password and username so re-runs converge on the documented state.
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { username: u.username },
    })
    if (error) throw error
    console.log(`exists   ${u.email} (${u.username})`)
    continue
  }

  const { error } = await admin.auth.admin.createUser({
    email: u.email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { username: u.username },
  })
  if (error) throw new Error(`createUser ${u.email}: ${error.message}`)
  console.log(`created  ${u.email} (${u.username})`)
}

if (!flags.has('--reset')) {
  console.log(`\nSign in with username or email, password: ${SEED_PASSWORD}`)
}
