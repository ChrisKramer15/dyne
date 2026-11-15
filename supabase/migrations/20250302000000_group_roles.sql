-- Group roles: every participant is an 'admin' or a 'member'. The person who
-- creates a group is made its admin automatically.

alter table public.conversation_participants
  add column role text not null default 'member'
  check (role in ('admin', 'member'));

-- Existing groups: the creator becomes admin.
update public.conversation_participants p
set role = 'admin'
from public.conversations c
where c.id = p.conversation_id
  and c.kind = 'group'
  and c.created_by = p.user_id;

-- New groups: whoever created the conversation gets admin when they are added.
-- A trigger keeps create_group_conversation() unchanged and cannot be skipped,
-- and clients cannot insert participants directly.
create function public.chat_set_creator_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.conversations c
    where c.id = new.conversation_id
      and c.kind = 'group'
      and c.created_by = new.user_id
  ) then
    new.role := 'admin';
  end if;
  return new;
end $$;

revoke all on function public.chat_set_creator_admin() from public, anon, authenticated;

create trigger conversation_participants_creator_admin
before insert on public.conversation_participants
for each row execute function public.chat_set_creator_admin();

-- Member lists now include each person's role. The return type changes, so the
-- function is dropped and recreated with the same access rules.
drop function public.conversation_members(uuid);

create function public.conversation_members(conv uuid)
returns table (user_id uuid, username text, role text)
language sql stable security definer set search_path = public as $$
  select p.user_id, pr.username::text, p.role
  from public.conversation_participants p
  join public.profiles pr on pr.user_id = p.user_id
  where p.conversation_id = conv
    and public.is_participant(conv)
  order by pr.username::text
$$;

revoke all on function public.conversation_members(uuid) from public, anon;
grant execute on function public.conversation_members(uuid) to authenticated;