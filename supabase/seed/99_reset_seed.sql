-- Removes seed data only. Paste into the Supabase dashboard SQL Editor and run.
--
-- 1. Deletes conversations created by a seed.*@example.test user
--    (cascades to participants, messages and notices).
-- 2. Deletes the seed users themselves (cascades to identities and profiles,
--    and to anything else they own).
-- Real users' data is not touched, except that a real user's membership in a
-- seed-created conversation disappears with that conversation.
-- To keep the seed users and remove only seed conversations, delete section 2.

begin;

-- 1. Seed conversations.
delete from public.conversations
where created_by in (select id from auth.users where lower(email) like 'seed.%@example.test');

-- 2. Seed users.
delete from auth.users
where lower(email) like 'seed.%@example.test';

commit;

select count(*) as remaining_seed_users
from auth.users where lower(email) like 'seed.%@example.test';
