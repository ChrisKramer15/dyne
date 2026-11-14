-- Chat messaging: conversations, participants, messages, system events,
-- row-level security, integrity triggers, RPCs and Realtime publication.
--
-- Clients read through RLS-protected selects and insert messages directly.
-- Every other write goes through security definer RPCs.

----------------------------------------------------------------------
-- Helpers
----------------------------------------------------------------------

-- True when the text is empty or only whitespace (mirrors JS String.trim()).
create function public.chat_is_blank(t text) returns boolean
language sql immutable as
$$ select t ~ '^[\s\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*$' $$;

----------------------------------------------------------------------
-- Tables
----------------------------------------------------------------------

create table public.conversations (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('personal', 'group')),
  name         text,
  personal_key text unique,  -- least(a,b) || ':' || greatest(a,b); null for groups
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  constraint conversation_kind_rules check (
    (kind = 'group'
      and name is not null
      and not public.chat_is_blank(name)
      and char_length(name) <= 60
      and personal_key is null)
    or
    (kind = 'personal' and name is null and personal_key is not null)
  )
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  last_read_at    timestamptz not null default now(),  -- the Read_Marker
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_participants_user_idx
  on public.conversation_participants (user_id);

create table public.messages (
  id              uuid primary key,  -- client-generated, makes retries idempotent
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  text            text not null,
  created_at      timestamptz not null default clock_timestamp(),
  seq             bigint generated always as identity,
  constraint message_text_not_blank check (not public.chat_is_blank(text)),
  constraint message_text_length    check (char_length(text) <= 2000)
);
create index messages_conversation_order_idx
  on public.messages (conversation_id, created_at desc, seq desc);

create table public.conversation_events (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  kind            text not null check (kind in ('joined', 'left')),
  user_id         uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default clock_timestamp()
);
create index conversation_events_conversation_idx
  on public.conversation_events (conversation_id, created_at);

----------------------------------------------------------------------
-- Row-level security
----------------------------------------------------------------------

alter table public.conversations             enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages                  enable row level security;
alter table public.conversation_events       enable row level security;

-- Defence in depth: no anonymous access, and no client writes except message inserts.
revoke all on public.conversations, public.conversation_participants,
              public.messages, public.conversation_events from anon;
revoke insert, update, delete, truncate on public.conversations, public.conversation_participants,
              public.conversation_events from authenticated;
revoke update, delete, truncate on public.messages from authenticated;

-- security definer avoids policy recursion on conversation_participants.
create function public.is_participant(conv uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.conversation_participants
     where conversation_id = conv and user_id = auth.uid()
   ) $$;

revoke all on function public.is_participant(uuid) from public, anon;
grant execute on function public.is_participant(uuid) to authenticated;

create policy conversations_select on public.conversations
  for select to authenticated
  using (public.is_participant(id));

-- Own row only: other participants' Read_Markers are never exposed.
-- Member lists come from conversation_members().
create policy participants_select_own on public.conversation_participants
  for select to authenticated
  using (user_id = auth.uid());

create policy messages_select on public.messages
  for select to authenticated
  using (public.is_participant(conversation_id));

create policy messages_insert on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_participant(conversation_id));

create policy conversation_events_select on public.conversation_events
  for select to authenticated
  using (public.is_participant(conversation_id));

----------------------------------------------------------------------
-- Integrity triggers
----------------------------------------------------------------------

-- A personal conversation has exactly two participants, matching its personal_key.
-- Deferred so the RPC can insert both rows before the check runs at commit.
create function public.chat_check_personal_participants() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  conv     uuid;
  conv_kind text;
  conv_key  text;
  n        int;
  expected text;
begin
  if tg_op = 'DELETE' then conv := old.conversation_id; else conv := new.conversation_id; end if;

  select c.kind, c.personal_key into conv_kind, conv_key
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

  if n <> 2 or expected is distinct from conv_key then
    raise exception 'personal_conversation_requires_two_participants';
  end if;
  return null;
end $$;

revoke all on function public.chat_check_personal_participants() from public, anon, authenticated;

create constraint trigger conversation_participants_personal_count
  after insert or delete on public.conversation_participants
  deferrable initially deferred
  for each row execute function public.chat_check_personal_participants();

-- A group never has more than 50 participants.
create function public.chat_check_group_size() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.conversations c
             where c.id = new.conversation_id and c.kind = 'group')
     and (select count(*) from public.conversation_participants p
          where p.conversation_id = new.conversation_id) >= 50 then
    raise exception 'too_many_members';
  end if;
  return new;
end $$;

revoke all on function public.chat_check_group_size() from public, anon, authenticated;

create trigger conversation_participants_group_size
  before insert on public.conversation_participants
  for each row execute function public.chat_check_group_size();

-- Clients cannot choose the timestamp: ordering and unread rely on server time.
create function public.chat_messages_before_insert() returns trigger
language plpgsql as $$
begin
  new.created_at := clock_timestamp();
  return new;
end $$;

create trigger messages_set_created_at
  before insert on public.messages
  for each row execute function public.chat_messages_before_insert();

-- Re-check text rules on update (covers privileged roles) and keep identity fields fixed.
create function public.chat_messages_before_update() returns trigger
language plpgsql as $$
begin
  if public.chat_is_blank(new.text) then
    raise exception 'message_blank';
  end if;
  if char_length(new.text) > 2000 then
    raise exception 'message_too_long';
  end if;
  if new.id <> old.id
     or new.conversation_id <> old.conversation_id
     or new.sender_id <> old.sender_id
     or new.created_at <> old.created_at then
    raise exception 'message_immutable_fields';
  end if;
  return new;
end $$;

create trigger messages_recheck_on_update
  before update on public.messages
  for each row execute function public.chat_messages_before_update();

----------------------------------------------------------------------
-- RPCs (security definer, authenticated only)
----------------------------------------------------------------------

create function public.search_users(q text)
returns table (user_id uuid, username text)
language plpgsql stable security definer set search_path = public as $$
declare
  term    text := btrim(coalesce(q, ''));
  pattern text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if char_length(term) < 1 or char_length(term) > 50 then
    return;
  end if;
  pattern := '%' || replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query
    select p.user_id, p.username::text
    from public.profiles p
    where p.username::text ilike pattern
    order by p.username::text
    limit 20;
end $$;

create function public.get_or_create_personal_conversation(other uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me   uuid := auth.uid();
  key  text;
  conv uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if other is null or other = me then raise exception 'self_conversation'; end if;
  if not exists (select 1 from public.profiles p where p.user_id = other) then
    raise exception 'unknown_user';
  end if;

  key := least(me::text, other::text) || ':' || greatest(me::text, other::text);

  insert into public.conversations (kind, personal_key, created_by)
  values ('personal', key, me)
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

create function public.create_group_conversation(name text, members uuid[])
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me     uuid := auth.uid();
  others uuid[];
  conv   uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if name is null or public.chat_is_blank(name) then raise exception 'name_required'; end if;
  if char_length(name) > 60 then raise exception 'name_too_long'; end if;

  select coalesce(array_agg(distinct m), '{}') into others
  from unnest(coalesce(members, '{}')) as m
  where m is not null and m <> me;

  if cardinality(others) < 2 then raise exception 'too_few_members'; end if;
  if cardinality(others) + 1 > 50 then raise exception 'too_many_members'; end if;

  if (select count(*) from public.profiles p where p.user_id = any (others))
     <> cardinality(others) then
    raise exception 'unknown_member';
  end if;

  insert into public.conversations (kind, name, created_by)
  values ('group', btrim(name), me)
  returning id into conv;

  -- Every initial participant's Read_Marker is the creation time (default now()).
  insert into public.conversation_participants (conversation_id, user_id)
  select conv, u from unnest(array_append(others, me)) as u;

  -- One "joined" notice per initial participant, including the creator.
  insert into public.conversation_events (conversation_id, kind, user_id)
  select conv, 'joined', u from unnest(array_append(others, me)) as u;

  return conv;
end $$;

create function public.leave_group_conversation(conv uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me        uuid := auth.uid();
  conv_kind text;
begin
  if me is null then raise exception 'not_authenticated'; end if;

  select c.kind into conv_kind from public.conversations c where c.id = conv;
  if conv_kind is null
     or not exists (select 1 from public.conversation_participants p
                    where p.conversation_id = conv and p.user_id = me) then
    raise exception 'not_participant';
  end if;
  if conv_kind <> 'group' then raise exception 'not_group'; end if;

  delete from public.conversation_participants p
  where p.conversation_id = conv and p.user_id = me;

  insert into public.conversation_events (conversation_id, kind, user_id)
  values (conv, 'left', me);
end $$;

create function public.mark_conversation_read(conv uuid, up_to timestamptz)
returns table (last_read_at timestamptz, unread bigint)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  me     uuid := auth.uid();
  marker timestamptz;
begin
  if me is null then raise exception 'not_authenticated'; end if;

  -- greatest() keeps the marker monotonic and the call idempotent.
  update public.conversation_participants cp
  set last_read_at = greatest(cp.last_read_at, up_to)
  where cp.conversation_id = conv and cp.user_id = me
  returning cp.last_read_at into marker;

  if not found then raise exception 'not_participant'; end if;

  return query
    select marker,
           (select count(*) from public.messages m
            where m.conversation_id = conv
              and m.sender_id <> me
              and m.created_at > marker);
end $$;

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
  last_read_at        timestamptz
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
         me.last_read_at
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

create function public.conversation_members(conv uuid)
returns table (user_id uuid, username text)
language sql stable security definer set search_path = public as $$
  select p.user_id, pr.username::text
  from public.conversation_participants p
  join public.profiles pr on pr.user_id = p.user_id
  where p.conversation_id = conv
    and public.is_participant(conv)
  order by pr.username::text
$$;

revoke all on function
  public.search_users(text),
  public.get_or_create_personal_conversation(uuid),
  public.create_group_conversation(text, uuid[]),
  public.leave_group_conversation(uuid),
  public.mark_conversation_read(uuid, timestamptz),
  public.list_conversations(),
  public.conversation_members(uuid)
from public, anon;

grant execute on function
  public.search_users(text),
  public.get_or_create_personal_conversation(uuid),
  public.create_group_conversation(text, uuid[]),
  public.leave_group_conversation(uuid),
  public.mark_conversation_read(uuid, timestamptz),
  public.list_conversations(),
  public.conversation_members(uuid)
to authenticated;

----------------------------------------------------------------------
-- Realtime
----------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.messages, public.conversation_events, public.conversation_participants;
  end if;
end $$;
