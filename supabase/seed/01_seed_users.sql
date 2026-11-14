-- Seed users for the chat feature. Paste into the Supabase dashboard SQL Editor and run.
-- Port of scripts/seed-users.mjs. NOT a migration: never applied automatically.
--
-- Creates six confirmed users directly in auth.users / auth.identities:
--   seed.<name>@example.test  /  password SeedPass123!  /  username seed_<name>
-- The existing on_auth_user_created trigger copies raw_user_meta_data->>'username'
-- into public.profiles. Safe to re-run: existing users get the password, username
-- and confirmation re-asserted instead of being duplicated.
--
-- Requires: both migrations (auth_modal + chat_messaging) applied.

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  nm       text;
  v_email  text;
  v_name   text;
  v_id     uuid;
  v_pw     constant text := 'SeedPass123!';
  v_hash   text;
begin
  foreach nm in array array['alice', 'bob', 'carol', 'dave', 'erin', 'frank'] loop
    v_email := 'seed.' || nm || '@example.test';
    v_name  := 'seed_' || nm;
    -- crypt/gen_salt live in the "extensions" schema on Supabase.
    v_hash  := extensions.crypt(v_pw, extensions.gen_salt('bf'));

    select u.id into v_id from auth.users u where lower(u.email) = v_email;

    if v_id is null then
      v_id := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token
      ) values (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
        v_email, v_hash,
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('username', v_name),
        now(), now(),
        '', '', '', '', '', '', '', ''
      );
      -- The on_auth_user_created trigger has now created the profile.
      raise notice 'created  % (%)', v_email, v_name;
    else
      update auth.users
      set encrypted_password = v_hash,
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
                               || jsonb_build_object('username', v_name),
          updated_at = now()
      where id = v_id;
      -- Profile normally exists already; create it only if missing.
      insert into public.profiles (user_id, username) values (v_id, v_name)
      on conflict (user_id) do nothing;
      raise notice 'exists   % (%)', v_email, v_name;
    end if;

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    )
    select gen_random_uuid(), v_id, v_id::text, 'email',
           jsonb_build_object('sub', v_id::text, 'email', v_email,
                              'email_verified', true, 'phone_verified', false),
           now(), now(), now()
    where not exists (
      select 1 from auth.identities i where i.user_id = v_id and i.provider = 'email'
    );
  end loop;
end $$;

-- Check: should list six rows, each with a profile username.
select u.email, p.username, u.email_confirmed_at is not null as confirmed
from auth.users u
left join public.profiles p on p.user_id = u.id
where lower(u.email) like 'seed.%@example.test'
order by u.email;
