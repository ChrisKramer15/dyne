# Seed scripts

Dev/test data for the chat feature. Both scripts refuse to run against a
non-local URL unless you pass `--allow-hosted` (or set `SEED_ALLOW_HOSTED=1`).
Variables are read from the environment, and from `.env` if present. Never
commit the service role key or the database password.

| Variable | Used by | Meaning |
| --- | --- | --- |
| `SUPABASE_URL` | both | Project URL. Falls back to `VITE_SUPABASE_URL` from `.env` (hosted, so `--allow-hosted` is then required). Local: `http://127.0.0.1:54321` |
| `SUPABASE_SERVICE_ROLE_KEY` | users | Service role key (local: `supabase status`; hosted: Project Settings -> API) |
| `SEED_DATABASE_URL` | messages | Postgres connection string including the DB password. Local default: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Hosted: Project Settings -> Database -> Connection string (session pooler, port 5432) |

## 1. Users

```
npm run seed:users -- --allow-hosted      # hosted
npm run seed:users                        # local
npm run seed:users -- --reset [--allow-hosted]   # delete the seed users
```

Creates six confirmed users, idempotently (re-runs reset the password and
username). The username goes in `user_metadata.username`; the existing
`on_auth_user_created` trigger copies it to `public.profiles`, which is what
`search_users` and the chat UI read.

Password for all: `SeedPass123!`

| Username | Email |
| --- | --- |
| `seed_alice` | `seed.alice@example.test` |
| `seed_bob` | `seed.bob@example.test` |
| `seed_carol` | `seed.carol@example.test` |
| `seed_dave` | `seed.dave@example.test` |
| `seed_erin` | `seed.erin@example.test` |
| `seed_frank` | `seed.frank@example.test` |

Sign in with either the username or the email. Search for `seed_` in the new
conversation panel.

## 2. Messages

```
npm run seed:messages -- you@example.com --allow-hosted
npm run seed:messages                      # target defaults to seed.alice@example.test
npm run seed:messages -- --reset [--allow-hosted]   # remove seed conversations only
```

Run `seed:users` first. The target email must belong to an existing user with a
profile (your own account works). Result for the target: DM with unread 1, group
"Weekend Padel" with 5 (includes a member who left, plus joined notices), group
"Match Day Crew" with 42 (includes a ~2,000-character message and a multi-line
latest message), DM with 150 (shows the 99+ cap), and a fully read DM. A DM
between `seed_dave` and `seed_erin` is added as well.

The script is rebuild-style: each run deletes conversations created by a
`seed.*@example.test` user and recreates them. Conversations created by real
users are never touched. If a real DM between the target and a seed user already
exists, that one is skipped with a warning.

### How timestamps are handled

`messages.created_at` is forced to `clock_timestamp()` by the
`messages_set_created_at` trigger, and updates to it are rejected, so the API
cannot back-date messages. The script connects to Postgres directly as the table
owner and, in a single transaction, disables only that trigger, inserts rows with
explicit timestamps, and re-enables it before commit (a failure rolls back).
All other checks still run. Read markers are set directly on
`conversation_participants.last_read_at` so the unread counts are exact.
