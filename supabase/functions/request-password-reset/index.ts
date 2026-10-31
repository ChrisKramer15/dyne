// Edge Function: request-password-reset
// Always answers with RESET_ACCEPTED so callers cannot tell whether an
// account matched. Failures are logged server side only.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { classifyIdentifier, RESET_ACCEPTED } from '../_shared/identifier.ts'

declare const Deno: {
  env: { get(k: string): string | undefined }
  serve(h: (req: Request) => Response | Promise<Response>): void
}

const MIN_DURATION_MS = 600
const MAX_IDENTIFIER_LENGTH = 254

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function accepted(): Response {
  return new Response(JSON.stringify(RESET_ACCEPTED.body), {
    status: RESET_ACCEPTED.status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

async function process(req: Request): Promise<void> {
  try {
    const body = await req.json().catch(() => null)
    const raw = body && typeof body.identifier === 'string' ? body.identifier : ''
    const id = classifyIdentifier(raw)
    if (!id || id.value.length > MAX_IDENTIFIER_LENGTH) return

    const url = Deno.env.get('SUPABASE_URL')
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !key) {
      console.error('request-password-reset: missing Supabase env')
      return
    }
    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: email, error: lookupError } = await admin.rpc('email_for_identifier', {
      i: id.value,
    })
    if (lookupError) {
      console.error('request-password-reset: lookup failed', lookupError.message)
      return
    }
    if (typeof email !== 'string' || email === '') return

    const redirectTo = Deno.env.get('SITE_URL') ?? req.headers.get('origin') ?? undefined
    const { error: sendError } = await admin.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    )
    if (sendError) console.error('request-password-reset: send failed', sendError.message)
  } catch (err) {
    console.error('request-password-reset: unexpected error', err instanceof Error ? err.message : err)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') {
    return new Response(null, { status: 405, headers: CORS_HEADERS })
  }
  const started = Date.now()
  await process(req)
  const remaining = MIN_DURATION_MS - (Date.now() - started)
  if (remaining > 0) await sleep(remaining)
  return accepted()
})
