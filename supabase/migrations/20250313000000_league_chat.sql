-- League chat: every league has one group chat for all its members, and
-- members can message each other privately inside the league.
--
-- League conversations are kept apart from the rest of chat:
--   * conversations.league_id marks them.
--   * A league DM has its own personal_key (prefixed with the league id), so the
--     same two people get a separate thread per league and never share one with
--     a DM created outside a league.
--   * Nobody edits the league group chat's membership by hand. It follows
--     league_members, so add/remove/leave on it is rejected.
-- Clients still cannot write to conversations or participants directly.

----------------------------------------------------------------------
-- Schema
----------------------------------------------------------------------

alter table public.conversations
  add column league_id uuid references public.leagues(id) on delete cascade;

-- One group chat per league.
create unique index conversations_league_chat_idx
  on public.conversations (league_id)
  where kind = 'group' and league_id is not null;

create index conversations_league_idx
  on public.conversations (league_id)
  where league_id is not null;

----------------------------------------------------------------------
-- A league DM's key carries the league id
----------------------------------------------------------------------

-- Replaces chat_check_personal_participants() from 20250201000000_chat_messaging.sql.
-- Same rules, except a league DM's expected key is <league id>:<low id>:<high id>.
create or replace function public.chat_check_personal_participants() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  conv        uuid;
  conv_kind   text;
  conv_key    text;
  conv_league uuid;
  n           int;
  expected    text;
begin
  if tg_op = 'DELETE' then conv := old.conversation_id; else conv := new.conversation_id; end if;

  select c.kind, c.personal_key, c.league_id into conv_kind, conv_key, conv_league
  from public.conversations c where c.id = conv;
  if not found or conv_kind <> 'personal' then
    return null;  -- conversation already deleted (cascade) or not personal
  end if;

  -- An account deletion removes the participant row; drop the whole conversation.
  if tg_op = 'DELETE'
     and not exists (select 1 from auth.users u where u.id = old.user_id) then
    delete from public.conversations where id = conv;
    return null;
  end if;

  select count(*),
         min(p.user_id::text) || ':' || max(p.user_id::text)
    into n, expected
  from public.conversation_participants p
  where p.conversation_id = conv;

  if conv_league is not null then
    expected := conv_league::text || ':' || expected;
  end if;

  if n <> 2 or expected is distinct from conv_key then
    raise exception 'personal_conversation_requires_two_participants';
  end if;
  return null;
end $$;

----------------------------------------------------------------------
-- The league group chat's membership is managed, not edited
----------------------------------------------------------------------

-- Only the league sync functions below (which set dyne.league_sync) may change
-- who is in a league group chat. This blocks add_group_member,
-- remove_group_member and leave_group_conversation for it. Deleting the whole
-- conversation (league or account deletion) is still allowed.
create function public.chat_guard_league_participants() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  conv uuid;
  uid  uuid;
  lg   uuid;
begin
  if tg_op = 'DELETE' then
    conv := old.conversation_id; uid := old.user_id;
  else
    conv := new.conversation_id; uid := new.user_id;
  end if;

  select c.league_id into lg
  from public.conversations c
  where c.id = conv and c.kind = 'group';

  if lg is not null
     and coalesce(current_setting('dyne.league_sync', true), '') <> 'on'
     and (tg_op <> 'DELETE' or exists (select 1 from auth.users u where u.id = uid)) then
    raise exception 'league_chat_managed';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

revoke all on function public.chat_guard_league_participants() from public, anon, authenticated;

create trigger conversation_participants_league_guard
  before insert or delete on public.conversation_participants
  for each row execute function public.chat_guard_league_participants();

----------------------------------------------------------------------
-- Keeping the league group chat in step with league_members
----------------------------------------------------------------------

-- Adds a user to a league's group chat (no-op when already in it).
-- Internal: not granted to any client role.
create function public.league_chat_add_participant(conv uuid, uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('dyne.league_sync', 'on', true);
  insert into public.conversation_participants (conversation_id, user_id)
  values (conv, uid)
  on conflict do nothing;
  if found then
    insert into public.conversation_events (conversation_id, kind, user_id)
    values (conv, 'joined', uid);
  end if;
  perform set_config('dyne.league_sync', 'off', true);
end $$;

-- Returns the league's group chat, creating it with every current member when
-- it does not exist yet. The owner creates it, so the owner is its admin.
-- Internal: not granted to any client role.
create function public.league_chat_ensure(lg uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  conv  uuid;
  owner_uid uuid;
  lname text;
  m     uuid;
begin
  select c.id into conv
  from public.conversations c
  where c.league_id = lg and c.kind = 'group';
  if conv is not null then return conv; end if;

  select l.owner_id, l.name into owner_uid, lname from public.leagues l where l.id = lg;
  if not found then raise exception 'league_not_found'; end if;

  insert into public.conversations (kind, name, created_by, league_id)
  values ('group', btrim(lname), owner_uid, lg)
  on conflict (league_id) where kind = 'group' and league_id is not null do nothing
  returning id into conv;

  if conv is null then
    -- Lost a race with a concurrent creator.
    select c.id into conv
    from public.conversations c
    where c.league_id = lg and c.kind = 'group';
    return conv;
  end if;

  -- Owner first so they hold the earliest join time.
  for m in
    select lm.user_id from public.league_members lm
    where lm.league_id = lg
    order by (lm.user_id = owner_uid) desc, lm.joined_at
  loop
    perform public.league_chat_add_participant(conv, m);
  end loop;
  return conv;
end $$;

revoke all on function
  public.league_chat_add_participant(uuid, uuid),
  public.league_chat_ensure(uuid)
from public, anon, authenticated;

-- A new league member joins the chat once it exists. Before that, the chat
-- picks them up when it is created.
create function public.league_members_sync_chat_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  conv uuid;
begin
  select c.id into conv
  from public.conversations c
  where c.league_id = new.league_id and c.kind = 'group';
  if conv is not null then
    perform public.league_chat_add_participant(conv, new.user_id);
  end if;
  return null;
end $$;

-- A member who leaves the league leaves its group chat.
create function public.league_members_sync_chat_delete() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  conv uuid;
begin
  select c.id into conv
  from public.conversations c
  where c.league_id = old.league_id and c.kind = 'group';
  if conv is not null
     and exists (
       select 1 from public.conversation_participants p
       where p.conversation_id = conv and p.user_id = old.user_id
     ) then
    perform set_config('dyne.league_sync', 'on', true);
    delete from public.conversation_participants p
    where p.conversation_id = conv and p.user_id = old.user_id;
    insert into public.conversation_events (conversation_id, kind, user_id)
    values (conv, 'left', old.user_id);
    perform set_config('dyne.league_sync', 'off', true);
  end if;
  return null;
end $$;

revoke all on function
  public.league_members_sync_chat_insert(),
  public.league_members_sync_chat_delete()
from public, anon, authenticated;

create trigger league_members_chat_insert
  after insert on public.league_members
  for each row execute function public.league_members_sync_chat_insert();

create trigger league_members_chat_delete
  after delete on public.league_members
  for each row execute function public.league_members_sync_chat_delete();

----------------------------------------------------------------------
-- RPCs (security definer, authenticated only)
----------------------------------------------------------------------

-- The league's group chat id. Members only.
create function public.get_or_create_league_chat(lg uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me   uuid := auth.uid();
  conv uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not exists (
    select 1 from public.league_members lm where lm.league_id = lg and lm.user_id = me
  ) then
    raise exception 'not_league_member';
  end if;

  conv := public.league_chat_ensure(lg);
  -- Self-heal if the caller is a member but was never added.
  perform public.league_chat_add_participant(conv, me);
  return conv;
end $$;

-- People in a league, with usernames (profiles are not readable directly). Members only.
create function public.league_member_list(lg uuid)
returns table (user_id uuid, username text)
language sql stable security definer set search_path = public as $$
  select lm.user_id, pr.username::text
  from public.league_members lm
  join public.profiles pr on pr.user_id = lm.user_id
  where lm.league_id = lg
    and public.is_league_member(lg)
  order by pr.username::text
$$;

-- A private message thread between two members of the same league. It is
-- separate from any DM the same two people have outside the league.
create function public.get_or_create_league_dm(lg uuid, other uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me   uuid := auth.uid();
  key  text;
  conv uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if other is null or other = me then raise exception 'self_conversation'; end if;
  if not exists (
       select 1 from public.league_members lm where lm.league_id = lg and lm.user_id = me
     )
     or not exists (
       select 1 from public.league_members lm where lm.league_id = lg and lm.user_id = other
     ) then
    raise exception 'not_league_member';
  end if;

  key := lg::text || ':' || least(me::text, other::text) || ':' || greatest(me::text, other::text);

  insert into public.conversations (kind, personal_key, created_by, league_id)
  values ('personal', key, me, lg)
  on conflict (personal_key) do nothing
  returning id into conv;

  if conv is null then
    select c.id into conv from public.conversations c where c.personal_key = key;
    return conv;
  end if;

  insert into public.conversation_participants (conversation_id, user_id)
  values (conv, me), (conv, other);
  return conv;
end $$;

-- list_conversations() now reports each conversation's league, so the client
-- can keep league conversations out of the global chat list and unread badge.
-- The return type changes, so the function is dropped and recreated.
drop function public.list_conversations();

create function public.list_conversations()
returns table (
  conversation_id     uuid,
  kind                text,
  name                text,
  created_at          timestamptz,
  other_user_name     text,
  latest_message_text text,
  latest_message_at   timestamptz,
  unread              bigint,
  last_read_at        timestamptz,
  league_id           uuid
)
language sql stable security definer set search_path = public as $$
  select c.id,
         c.kind,
         c.name,
         c.created_at,
         case when c.kind = 'personal' then (
           select pr.username::text
           from public.conversation_participants op
           join public.profiles pr on pr.user_id = op.user_id
           where op.conversation_id = c.id and op.user_id <> me.user_id
           limit 1
         ) end,
         lm.text,
         lm.created_at,
         (select count(*) from public.messages um
          where um.conversation_id = c.id
            and um.sender_id <> me.user_id
            and um.created_at > me.last_read_at),
         me.last_read_at,
         c.league_id
  from public.conversation_participants me
  join public.conversations c on c.id = me.conversation_id
  left join lateral (
    select m.text, m.created_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc, m.seq desc
    limit 1
  ) lm on true
  where me.user_id = auth.uid()
$$;

revoke all on function
  public.get_or_create_league_chat(uuid),
  public.league_member_list(uuid),
  public.get_or_create_league_dm(uuid, uuid),
  public.list_conversations()
from public, anon;

grant execute on function
  public.get_or_create_league_chat(uuid),
  public.league_member_list(uuid),
  public.get_or_create_league_dm(uuid, uuid),
  public.list_conversations()
to authenticated;
