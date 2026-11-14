# Seed data (SQL, for the Supabase dashboard)

Plain SQL versions of `scripts/seed-users.mjs` and `scripts/seed-messages.mjs`.
Not migrations, so they are never applied automatically. The chat migration
(`supabase/migrations/20250201000000_chat_messaging.sql`) and the auth migration
must already be applied.

1. Dashboard -> SQL Editor: paste `01_seed_users.sql` and run (creates `seed_alice` ... `seed_frank`, password `SeedPass123!`).
2. Edit your email on the marked line at the top of `02_seed_messages.sql`, paste it and run (the result table shows unread counts 1, 5, 42, 150, 0).
3. Sign in to the app with your account and open the conversation list.

Both files can be re-run. `99_reset_seed.sql` removes the seed conversations and seed users only.
