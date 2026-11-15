-- Any participant of a group can add another registered user to it.
-- The new person joins as a plain member, with their Read_Marker at the join
-- time (so nothing counts as unread), and the 50-participant limit still applies
-- through the existing group-size trigger.

create function public.add_group_member(conv uuid, target uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;

  if not exists (
    select 1
    from public.conversation_participants p
    join public.conversations c on c.id = p.conversation_id
    where p.conversation_id = conv and p.user_id = me and c.kind = 'group'
  ) then
    raise exception 'not_allowed';
  end if;

  if not exists (select 1 from public.profiles pr where pr.user_id = target) then
    raise exception 'unknown_user';
  end if;

  if exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = conv and p.user_id = target
  ) then
    raise exception 'already_member';
  end if;

  insert into public.conversation_participants (conversation_id, user_id)
  values (conv, target);

  insert into public.conversation_events (conversation_id, kind, user_id)
  values (conv, 'joined', target);
end $$;

revoke all on function public.add_group_member(uuid, uuid) from public, anon;
grant execute on function public.add_group_member(uuid, uuid) to authenticated;