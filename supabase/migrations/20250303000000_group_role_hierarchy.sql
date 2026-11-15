-- Group role hierarchy: admin > moderator > member.
--   admin      can change anyone's role and remove anyone (except via leave).
--   moderator  can remove members, but not admins or other moderators, and
--              cannot change roles.
--   member     can only see the member list.
-- When the last admin leaves, the most recent poster among the moderators
-- becomes admin; with no moderators left, the most recent poster among the
-- members does. All changes go through the functions below; clients still
-- cannot write to conversation_participants directly.

alter table public.conversation_participants
  drop constraint if exists conversation_participants_role_check;
alter table public.conversation_participants
  add constraint conversation_participants_role_check
  check (role in ('admin', 'moderator', 'member'));

-- A removed member gets a "removed" notice instead of "left".
alter table public.conversation_events
  drop constraint if exists conversation_events_kind_check;
alter table public.conversation_events
  add constraint conversation_events_kind_check
  check (kind in ('joined', 'left', 'removed'));

----------------------------------------------------------------------
-- Change a member's role (admins only)
----------------------------------------------------------------------
create function public.set_member_role(conv uuid, target uuid, new_role text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me          uuid := auth.uid();
  my_role     text;
  target_role text;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if new_role is null or new_role not in ('admin', 'moderator', 'member') then
    raise exception 'invalid_role';
  end if;

  select p.role into my_role
  from public.conversation_participants p
  join public.conversations c on c.id = p.conversation_id
  where p.conversation_id = conv and p.user_id = me and c.kind = 'group';
  if my_role is distinct from 'admin' then raise exception 'not_allowed'; end if;

  select p.role into target_role
  from public.conversation_participants p
  where p.conversation_id = conv and p.user_id = target;
  if target_role is null then raise exception 'not_a_member'; end if;

  -- A group must keep at least one admin.
  if target_role = 'admin' and new_role <> 'admin'
     and not exists (
       select 1 from public.conversation_participants p
       where p.conversation_id = conv and p.role = 'admin' and p.user_id <> target
     ) then
    raise exception 'last_admin';
  end if;

  update public.conversation_participants p
  set role = new_role
  where p.conversation_id = conv and p.user_id = target;
end $$;

----------------------------------------------------------------------
-- Remove a member (admins and moderators)
----------------------------------------------------------------------
create function public.remove_group_member(conv uuid, target uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me          uuid := auth.uid();
  my_role     text;
  target_role text;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if target = me then raise exception 'use_leave'; end if;

  select p.role into my_role
  from public.conversation_participants p
  join public.conversations c on c.id = p.conversation_id
  where p.conversation_id = conv and p.user_id = me and c.kind = 'group';
  if my_role is null or my_role = 'member' then raise exception 'not_allowed'; end if;

  select p.role into target_role
  from public.conversation_participants p
  where p.conversation_id = conv and p.user_id = target;
  if target_role is null then raise exception 'not_a_member'; end if;

  -- Moderators can only remove plain members.
  if my_role = 'moderator' and target_role <> 'member' then
    raise exception 'not_allowed';
  end if;

  delete from public.conversation_participants p
  where p.conversation_id = conv and p.user_id = target;

  insert into public.conversation_events (conversation_id, kind, user_id)
  values (conv, 'removed', target);
end $$;

----------------------------------------------------------------------
-- Succession: a group that loses its last admin promotes someone
----------------------------------------------------------------------
create function public.chat_promote_successor() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  successor uuid;
begin
  if not exists (
    select 1 from public.conversations c where c.id = old.conversation_id and c.kind = 'group'
  ) then
    return null;  -- personal chat, or the whole conversation is being deleted
  end if;

  if exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = old.conversation_id and p.role = 'admin'
  ) then
    return null;
  end if;

  -- Most recent poster among moderators; people who never posted come last
  -- (earliest joined first).
  select p.user_id into successor
  from public.conversation_participants p
  where p.conversation_id = old.conversation_id and p.role = 'moderator'
  order by (
    select max(m.created_at) from public.messages m
    where m.conversation_id = p.conversation_id and m.sender_id = p.user_id
  ) desc nulls last, p.joined_at asc
  limit 1;

  -- No moderators: most recent poster among the members.
  if successor is null then
    select p.user_id into successor
    from public.conversation_participants p
    where p.conversation_id = old.conversation_id and p.role = 'member'
    order by (
      select max(m.created_at) from public.messages m
      where m.conversation_id = p.conversation_id and m.sender_id = p.user_id
    ) desc nulls last, p.joined_at asc
    limit 1;
  end if;

  if successor is not null then
    update public.conversation_participants p
    set role = 'admin'
    where p.conversation_id = old.conversation_id and p.user_id = successor;
  end if;
  return null;
end $$;

create trigger conversation_participants_successor
after delete on public.conversation_participants
for each row execute function public.chat_promote_successor();

revoke all on function
  public.set_member_role(uuid, uuid, text),
  public.remove_group_member(uuid, uuid),
  public.chat_promote_successor()
from public, anon, authenticated;

grant execute on function
  public.set_member_role(uuid, uuid, text),
  public.remove_group_member(uuid, uuid)
to authenticated;