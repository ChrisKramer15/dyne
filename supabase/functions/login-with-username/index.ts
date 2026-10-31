// Edge Function: login-with-username
// Resolves a username to its account email (service role), signs in with
// Supabase Auth, and returns the same response for unknown user and wrong
// password. Infrastructure errors return 503.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { DUMMY_EMAIL, buildLoginResponse } from '../_shared/identifier.ts'

const MAX_USERNAME = 64
const MAX_PASSWORD = 128
const MIN_RESPONSE_MS = 600

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Auth errors that mean "these credentials are wrong" rather than "Auth is broken". */
function isCredentialError(err: { status?: number; code?: string }): boolean {
  if (err.code === 'invalid_credentials') return true
  return err.status === 400 || err.status === 401 || err.status === 422
}

async function handle(req: Request): Promise<{ status: number; body: unknown }> {
  if (req.method !== 'POST') return { status: 405, body: { error: 'method_not_allowed' } }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return { status: 400, body: { error: 'bad_request' } }
  }
  const { username, password } = (payload ?? {}) as Record<string, unknown>
  if (typeof username !== 'string' || typeof password !== 'string') {
    return { status: 400, body: { error: 'bad_request' } }
  }
  if (username.trim() === '' || password === '') {
    return { status: 400, body: { error: 'bad_request' } }
  }
  // Over-limit values get the generic failure so length reveals nothing.
  if (username.length > MAX_USERNAME || password.length > MAX_PASSWORD) {
    return buildLoginResponse('wrong_password')
  }

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) {
    console.error('login-with-username: missing environment configuration')
    return { status: 503, body: { error: 'unavailable' } }
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const { data, error } = await admin.rpc('email_for_username', { u: username.trim() })
    if (error) {
      console.error('login-with-username: lookup failed', error.message)
      return { status: 503, body: { error: 'unavailable' } }
    }
    const found = typeof data === 'string' && data !== ''
    const email = found ? data : DUMMY_EMAIL

    const { data: signIn, error: signInError } = await admin.auth.signInWithPassword({
      email,
      password,
    })
    if (signInError) {
      if (isCredentialError(signInError)) {
        return buildLoginResponse(found ? 'wrong_password' : 'unknown_user')
      }
      console.error('login-with-username: sign-in failed', signInError.message)
      return { status: 503, body: { error: 'unavailable' } }
    }
    if (!found || !signIn.session) {
      // Cannot happen for the dummy address; never return a session for it.
      return buildLoginResponse('unknown_user')
    }
    return buildLoginResponse('success', signIn.session)
  } catch (e) {
    console.error('login-with-username: unexpected error', e instanceof Error ? e.message : e)
    return { status: 503, body: { error: 'unavailable' } }
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const started = Date.now()
  const result = await handle(req)
  const remaining = MIN_RESPONSE_MS - (Date.now() - started)
  if (remaining > 0) await sleep(remaining)
  return respond(result.status, result.body)
})
