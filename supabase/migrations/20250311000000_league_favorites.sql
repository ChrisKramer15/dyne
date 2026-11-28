-- Top leagues: each member can star up to 3 of their leagues.
--
-- The flag lives on league_members, so it is per user and per league. Clients
-- still cannot write the table directly; set_league_favorite() is the only
-- way to change it and it enforces the limit.

alter table public.league_members
  add column if not exists is_favorite boolean not null default false;

create or replace function public.set_league_favorite(p_league_id uuid, p_favorite boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  max_favorites constant integer := 3;
begin
  if me is null then raise exception 'not_authenticated'; end if;

  -- Serialise concurrent calls from the same user so the limit cannot be raced.
  perform pg_advisory_xact_lock(hashtextextended(me::text, 0));

  if p_favorite and (
    select count(*) from public.league_members
    where user_id = me and is_favorite and league_id <> p_league_id
  ) >= max_favorites then
    raise exception 'too_many_favorites';
  end if;

  update public.league_members
     set is_favorite = p_favorite
   where league_id = p_league_id and user_id = me;

  if not found then raise exception 'not_a_member'; end if;
end $$;

revoke all on function public.set_league_favorite(uuid, boolean) from public, anon;
grant execute on function public.set_league_favorite(uuid, boolean) to authenticated;
