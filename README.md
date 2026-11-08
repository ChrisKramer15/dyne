# dyne

React + TypeScript app built with Vite.

## Scripts

- `npm install` - install dependencies
- `npm run dev` - start dev server
- `npm run build` - type-check and build
- `npm run lint` - lint
- `npm test` - run the test suite once

CI (`.github/workflows/deploy.yml`) runs lint, type-check and tests on every
push and pull request to `main`, and only builds and deploys when they pass on a
push to `main`.

## Supabase

The app connects to Supabase from the browser using the credentials in `.env`
(copy `.env.example` to `.env`):

- `VITE_SUPABASE_URL` - project URL
- `VITE_SUPABASE_ANON_KEY` - publishable key (`sb_publishable_...`)

### Backend objects

The auth modal (login / register / password reset) depends on these, defined in
`supabase/migrations/20250101000000_auth_modal.sql`:

- `public.profiles` table (RLS enabled, no anon access) + `on_auth_user_created` trigger
- `username_available(text)` RPC - callable by anon, used by the register form
- `email_for_username(text)` / `email_for_identifier(text)` RPCs - service role only
- Edge Functions `login-with-username` and `request-password-reset`

The Edge Functions require the `SUPABASE_SERVICE_ROLE_KEY` secret or they return
503. Set it with `supabase secrets set` (never commit it).

`request-password-reset` also reads an optional `SITE_URL` secret for the reset
link's redirect. Because the app is served from a sub-path on GitHub Pages, set it
to the full app URL including the base path, for example
`supabase secrets set SITE_URL=https://<user>.github.io/dyne/`. Without it the
function falls back to the request `Origin` header, which has no `/dyne/` path, so
reset links would land on the wrong page. The same URL must be allowed under
**Authentication -> URL Configuration -> Redirect URLs**.

### Deploying behind a corporate VPN (Zscaler)

Zscaler performs TLS inspection, which breaks the Supabase CLI (a Go binary that
does not trust the Zscaler root CA, even though Windows does). Two workarounds we
use:

1. **CLI TLS trust.** Export the Zscaler root CA to a PEM file and point the CLI
   at it before every `supabase` command:

   ```powershell
   $env:SSL_CERT_FILE = "$env:USERPROFILE\.supabase\zscaler-ca.pem"
   ```

   Make it permanent with `setx SSL_CERT_FILE "$env:USERPROFILE\.supabase\zscaler-ca.pem"`.

2. **Database migrations.** `supabase db push` connects to the Postgres pooler on
   a raw TCP port, which Zscaler stalls (connection times out). Apply migrations
   through the dashboard SQL Editor instead, or run `db push` off the VPN. Edge
   Function deploys use HTTPS and work through the VPN: use
   `supabase functions deploy <name> --use-api` (`--use-api` avoids needing Docker).

## TODO

### Configure custom SMTP before launch

Auth emails (password reset, and email confirmation if re-enabled) currently
rely on Supabase's built-in email service, which is for testing only:

- Hard-capped at ~2 emails per hour, project-wide, and can change without notice.
- Only delivers to members of the Supabase organization - it will not email real
  users.

Before any real use, configure a custom SMTP provider (e.g. Resend, SendGrid,
Mailgun, Brevo) in the dashboard under **Authentication -> Emails -> SMTP
Settings**, then raise the email rate limit under **Authentication -> Rate
Limits**.

Note: email confirmation is currently **disabled** (`mailer_autoconfirm = true`)
to allow testing without SMTP. Re-enable it (**Authentication -> Sign In /
Providers -> Email -> Confirm email**) once SMTP is in place.
