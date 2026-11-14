-- Seed conversations, messages, notices and read markers for the chat feature.
-- Paste into the Supabase dashboard SQL Editor (runs as the postgres role) and run.
-- Port of scripts/seed-messages.mjs. NOT a migration: never applied automatically.
--
-- Requires: both migrations applied and 01_seed_users.sql already run.
--
-- >>> EDIT THE EMAIL ON THE LINE BELOW (your own account works; it must have a profile) <<<
drop table if exists pg_temp.seed_config;
create temp table seed_config as select 'you@example.com'::text as target_email;  -- <<< SET YOUR EMAIL HERE
-- >>> NOTHING ELSE NEEDS EDITING <<<
--
-- Result for the target: DM with 1 unread, group "Weekend Padel" with 5 (one member
-- left; joined/left notices), group "Match Day Crew" with 42 (a ~2000-char message and
-- a multi-line latest message), DM with 150 (shows the 99+ cap), a fully read DM, plus
-- a DM between seed_dave and seed_erin.
--
-- Re-runnable: first deletes only conversations created by a seed.*@example.test
-- user, then rebuilds. Conversations created by other users are never touched.
-- Everything runs inside one DO block (one transaction): on any error nothing is
-- changed, including the trigger toggle below.
--
-- Why the trigger is disabled: public.messages has a BEFORE INSERT trigger
-- (messages_set_created_at) that overwrites created_at with clock_timestamp(), so
-- back-dated messages are impossible while it is enabled. Only that one trigger is
-- disabled, for the inserts only, and re-enabled before the block ends. All
-- constraints and the other triggers (text checks, 2-participant DMs, group size)
-- still run.

----------------------------------------------------------------------
-- Helpers (temporary: live in pg_temp and vanish when the session ends)
----------------------------------------------------------------------

-- n strictly increasing epoch-millisecond values spread over [a, b].
create or replace function pg_temp.seed_spread(n int, a bigint, b bigint)
returns bigint[] language plpgsql as $fn$
declare
  step numeric := case when n > 1 then (b - a)::numeric / (n - 1) else 0 end;
  prev bigint := 0;
  res  bigint[] := '{}';
begin
  for i in 0 .. n - 1 loop
    prev := greatest(prev + 1, round(a + i * step)::bigint);
    res := res || prev;
  end loop;
  return res;
end $fn$;

-- Creates one conversation with participants, notices and messages.
-- Returns false when skipped (a DM between the same two users already exists).
create or replace function pg_temp.seed_conversation(
  p_kind text, p_name text, p_creator uuid, p_members uuid[], p_created timestamptz,
  p_leavers uuid[], p_left_at timestamptz,
  p_others uuid[], p_target uuid, p_read int, p_unread int,
  p_read_end timestamptz, p_unread_start timestamptz, p_now timestamptz,
  p_long_idx int, p_long_text text, p_last_text text, p_read_all boolean
) returns boolean language plpgsql as $fn$
declare
  chatter text[] := array[
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
    'Count me in.'];
  v_id     uuid := gen_random_uuid();
  v_key    text;
  v_total  int := p_read + p_unread;
  v_times  bigint[];
  v_ts     timestamptz;
  v_sender uuid;
  v_body   text;
  v_marker timestamptz;
  v_last   timestamptz;
  v_n      int := cardinality(p_others);
  v_m      uuid;
begin
  -- Same expression as get_or_create_personal_conversation.
  if p_kind = 'personal' then
    v_key := least(p_members[1]::text, p_members[2]::text) || ':'
          || greatest(p_members[1]::text, p_members[2]::text);
  end if;

  insert into public.conversations (id, kind, name, personal_key, created_by, created_at)
  values (v_id, p_kind, p_name, v_key, p_creator, p_created)
  on conflict (personal_key) do nothing;
  if not found then
    raise notice 'skipped: a personal conversation between these users already exists';
    return false;
  end if;

  -- Message times: read ones first, then unread ones.
  v_times := pg_temp.seed_spread(p_read,
               floor(extract(epoch from p_created + interval '5 minutes') * 1000)::bigint,
               floor(extract(epoch from p_read_end) * 1000)::bigint)
          || pg_temp.seed_spread(p_unread,
               floor(extract(epoch from p_unread_start) * 1000)::bigint,
               floor(extract(epoch from p_now - interval '2 minutes') * 1000)::bigint);

  -- Marker sits on the last read message, or at creation when none are read.
  v_marker := case when p_read > 0 then to_timestamp(v_times[p_read] / 1000.0) else p_created end;
  v_last   := case when v_total > 0 then to_timestamp(v_times[v_total] / 1000.0) else p_created end;

  -- Participants: everyone but leavers. The target gets the crafted marker.
  foreach v_m in array p_members loop
    continue when v_m = any (p_leavers);
    insert into public.conversation_participants (conversation_id, user_id, last_read_at, joined_at)
    values (v_id, v_m,
            case when v_m = p_target and not p_read_all then v_marker else v_last end,
            p_created);
  end loop;

  if p_kind = 'group' then
    insert into public.conversation_events (conversation_id, kind, user_id, created_at)
    select v_id, 'joined', u, p_created from unnest(p_members) as u;
  end if;
  foreach v_m in array p_leavers loop
    insert into public.conversation_events (conversation_id, kind, user_id, created_at)
    values (v_id, 'left', v_m, p_left_at);
  end loop;

  -- Messages, inserted in time order (seq follows insertion order).
  for k in 0 .. v_total - 1 loop
    v_ts := to_timestamp(v_times[k + 1] / 1000.0);
    if k < p_read then
      v_sender := case when k % 3 = 1 then p_target else p_others[(k % v_n) + 1] end;
      v_body := chatter[(k % 12) + 1] || ' (read #' || (k + 1) || ')';
    else
      v_sender := p_others[((k - p_read) % v_n) + 1];
      v_body := chatter[(k % 12) + 1] || ' (new #' || (k + 1) || ')';
    end if;
    if k = p_long_idx then v_body := p_long_text; end if;
    if k = v_total - 1 and p_last_text is not null then v_body := p_last_text; end if;
    insert into public.messages (id, conversation_id, sender_id, text, created_at)
    values (gen_random_uuid(), v_id, v_sender, v_body, v_ts);
  end loop;

  return true;
end $fn$;

----------------------------------------------------------------------
-- Main
----------------------------------------------------------------------

do $$
declare
  v_email    text := lower(btrim((select target_email from pg_temp.seed_config)));
  v_target   uuid;
  v_seed_ids uuid[] := '{}';
  v_partners uuid[];
  v_id       uuid;
  nm         text;
  p0 uuid; p1 uuid; p2 uuid; p3 uuid; p4 uuid;
  v_now      timestamptz := clock_timestamp();
  v_created  timestamptz;
  v_long     text;
  v_multi    text := E'Plan for Saturday:\n1. Meet at 9:30 for warm-up\n2. Singles from 10:00\n3. Doubles after lunch\n\nBring water and a spare shirt.';
  v_state    "char";
begin
  -- Target user must exist and have a profile.
  select u.id into v_target
  from auth.users u join public.profiles p on p.user_id = u.id
  where lower(u.email) = v_email;
  if v_target is null then
    raise exception 'No user with a profile found for email "%". Edit the email on the "create temp table seed_config" line at the top of this script (the account must exist and have signed up).', v_email;
  end if;

  -- Seed users must exist (and have profiles), in a stable order.
  foreach nm in array array['alice', 'bob', 'carol', 'dave', 'erin', 'frank'] loop
    select u.id into v_id
    from auth.users u join public.profiles p on p.user_id = u.id
    where lower(u.email) = 'seed.' || nm || '@example.test';
    if v_id is null then
      raise exception 'Seed user seed.%@example.test (or its profile) is missing. Run 01_seed_users.sql first.', nm;
    end if;
    v_seed_ids := v_seed_ids || v_id;
  end loop;

  select coalesce(array_agg(s order by o), '{}') into v_partners
  from unnest(v_seed_ids) with ordinality as t(s, o)
  where s <> v_target;
  p0 := v_partners[1]; p1 := v_partners[2]; p2 := v_partners[3]; p3 := v_partners[4]; p4 := v_partners[5];

  -- Remove previous seed conversations (cascades to participants/messages/events).
  delete from public.conversations
  where created_by in (select u.id from auth.users u where lower(u.email) like 'seed.%@example.test');

  -- ~2000 characters (the messages table allows at most 2000).
  select left(string_agg(
           'Section ' || i || ': the league committee has agreed that fixtures will be played on the published dates, '
           || 'that rescheduling needs at least 48 hours notice, and that both captains confirm the result by message.',
           ' ' order by i), 2000)
  into v_long from generate_series(1, 10) as i;

  alter table public.messages disable trigger messages_set_created_at;

  -- 1 unread: DM
  perform pg_temp.seed_conversation('personal', null, p0, array[p0, v_target], v_now - interval '9 days',
    '{}', null, array[p0], v_target, 10, 1, v_now - interval '2 days', v_now - interval '12 minutes', v_now,
    -1, null, null, false);

  -- 5 unread: group where one member joined and later left
  v_created := v_now - interval '6 days';
  perform pg_temp.seed_conversation('group', 'Weekend Padel', p1, array[p1, v_target, p2, p3], v_created,
    array[p3], v_created + interval '3 days', array[p1, p2, p3], v_target, 14, 5,
    v_now - interval '1 day', v_now - interval '2 hours', v_now, -1, null, null, false);

  -- 42 unread: group with a long and a multi-line message
  perform pg_temp.seed_conversation('group', 'Match Day Crew', p0, array[p0, v_target, p1, p2, p4],
    v_now - interval '12 days', '{}', null, array[p0, p1, p2, p4], v_target, 30, 42,
    v_now - interval '3 days', v_now - interval '20 hours', v_now, 40, v_long, v_multi, false);

  -- 150 unread (shows the 99+ cap): DM
  perform pg_temp.seed_conversation('personal', null, p1, array[p1, v_target], v_now - interval '20 days',
    '{}', null, array[p1], v_target, 20, 150, v_now - interval '10 days', v_now - interval '5 hours', v_now,
    -1, null, null, false);

  -- 0 unread: fully read DM
  perform pg_temp.seed_conversation('personal', null, p2, array[p2, v_target], v_now - interval '30 days',
    '{}', null, array[p2], v_target, 8, 0, v_now - interval '14 days', v_now, v_now,
    -1, null, null, false);

  -- Seed-only DM (dave <-> erin) so seed accounts can chat with each other.
  perform pg_temp.seed_conversation('personal', null, v_seed_ids[4], array[v_seed_ids[4], v_seed_ids[5]],
    v_now - interval '4 days', '{}', null, array[v_seed_ids[4], v_seed_ids[5]], v_seed_ids[5], 6, 0,
    v_now - interval '3 days', v_now, v_now, -1, null, null, true);

  alter table public.messages enable trigger messages_set_created_at;

  -- Fail now (not at commit) if any deferred DM participant check is violated.
  set constraints all immediate;

  -- The trigger must be back to "enabled" (O) for the success path.
  select tgenabled into v_state from pg_trigger
  where tgrelid = 'public.messages'::regclass and tgname = 'messages_set_created_at';
  if v_state is distinct from 'O' then
    raise exception 'messages_set_created_at is not enabled (state %). Rolling back.', v_state;
  end if;

  raise notice 'Seeded chat data for %.', v_email;
end $$;

----------------------------------------------------------------------
-- Check: expected unread for the target (1, 5, 42, 150, 0) and the trigger state.
----------------------------------------------------------------------
select coalesce(c.name, 'DM with ' || (
         select pr.username::text from public.conversation_participants op
         join public.profiles pr on pr.user_id = op.user_id
         where op.conversation_id = c.id and op.user_id <> me.user_id limit 1)) as conversation,
       (select count(*) from public.messages m where m.conversation_id = c.id) as messages,
       (select count(*) from public.messages m
        where m.conversation_id = c.id and m.sender_id <> me.user_id
          and m.created_at > me.last_read_at) as unread_for_target,
       (select tgenabled = 'O' from pg_trigger
        where tgrelid = 'public.messages'::regclass
          and tgname = 'messages_set_created_at') as created_at_trigger_enabled
from public.conversation_participants me
join public.conversations c on c.id = me.conversation_id
where me.user_id = (select u.id from auth.users u
                    where lower(u.email) = lower(btrim((select target_email from pg_temp.seed_config))))
  and c.created_by in (select u.id from auth.users u where lower(u.email) like 'seed.%@example.test')
order by 3 desc;
