-- ROLLBACK for the 3 migrations (hangar_capacity, shared_game_rooms,
-- arcade_duel_launch). Restores bullet_lobby and classic_lobby to their
-- exact pre-migration definitions, removes game_lobby and the mode column.
--
-- NOT undone by this script: the one-time copy of any Classic 1v1 rooms
-- that were OPEN at the moment shared_game_rooms.sql ran (it copied them
-- into bullet_rooms/bullet_members so old invite links kept working).
-- Those copied rows are harmless leftovers if you roll back -- nothing
-- reads them once game_lobby is gone -- but this script does not delete
-- them, since safely telling "copied by the migration" apart from "a real
-- bullet_rooms row created normally afterward" isn't reliable to automate.
begin;

drop function if exists public.bullet_lobby(text,text);
alter function public.bullet_lobby_legacy(text,text) rename to bullet_lobby;
revoke all on function public.bullet_lobby(text,text) from public, anon, authenticated;
revoke all on function public.bullet_lobby(text,text) from public, anon;
grant execute on function public.bullet_lobby(text,text) to authenticated;

drop function if exists public.game_lobby(text,text,text);

create or replace function public.classic_lobby(
  p_action text, p_code text default '', p_ready boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r public.rooms%rowtype;
  room_code text;
  seat smallint;
  is_member boolean;
  is_spectator boolean;
begin
  if uid is null then raise exception 'Sign in to use online rooms'; end if;
  if p_action not in ('create', 'join', 'get', 'ready', 'leave') or p_action is null then
    raise exception 'Unknown room action';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  if p_action in ('create', 'join') then
    insert into public.profiles(id, display_name)
    values(uid, 'Pilot-' || substr(replace(uid::text, '-', ''), 1, 18))
    on conflict (id) do nothing;
  end if;
  if p_action = 'create' then
    select rooms.* into r from public.rooms rooms
      join public.room_members members on members.room_id = rooms.id
      where members.player_id = uid and rooms.status = 'open'
      order by rooms.created_at desc limit 1;
    if r.id is null then
      loop
        room_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
        begin
          insert into public.rooms(code, host_id, mode, max_players)
          values(room_code, uid, '1v1', 2) returning * into r;
          exit;
        exception when unique_violation then null;
        end;
      end loop;
      insert into public.room_members(room_id, player_id, team) values(r.id, uid, 0);
    end if;
  else
    select * into r from public.rooms where code = upper(trim(p_code)) for update;
    if r.id is null then raise exception 'Room not found. Check the code.'; end if;
    if p_action = 'join' then
      if r.status <> 'open' then raise exception 'This room is closed.'; end if;
      if r.mode <> '1v1' then raise exception 'Only private 1v1 rooms are supported yet.'; end if;
      if exists(select 1 from public.room_members m join public.rooms other on other.id = m.room_id
        where m.player_id = uid and other.status = 'open' and other.id <> r.id) then
        raise exception 'Leave your current room before joining another.';
      end if;
      is_member := exists(select 1 from public.room_members where room_id = r.id and player_id = uid);
      if not is_member then
        seat := null;
        if r.is_ranked then
          select team into seat from public.room_reserved_seats where room_id = r.id and player_id = uid;
        elsif (select count(*) from public.room_members where room_id = r.id) < 2 then
          select case when exists(select 1 from public.room_members where room_id = r.id and team = 0)
            then 1 else 0 end into seat;
        end if;
        if seat is not null then
          insert into public.room_members(room_id, player_id, team) values(r.id, uid, seat);
          delete from public.room_spectators where room_id = r.id and player_id = uid;
        else
          insert into public.room_spectators(room_id, player_id) values(r.id, uid)
            on conflict (room_id, player_id) do nothing;
        end if;
      end if;
    else
      is_member := exists(select 1 from public.room_members where room_id = r.id and player_id = uid);
      is_spectator := exists(select 1 from public.room_spectators where room_id = r.id and player_id = uid);
      if not is_member and not is_spectator then
        raise exception 'You are not part of this room.';
      end if;
      if p_action = 'ready' and not is_member then
        raise exception 'Spectators cannot ready up.';
      end if;
    end if;
    if p_action = 'ready' then
      if r.status <> 'open' then raise exception 'This room is closed.'; end if;
      update public.room_members set is_ready = coalesce(p_ready, false) where room_id = r.id and player_id = uid;
    elsif p_action = 'leave' then
      if r.host_id = uid then
        update public.rooms set status = 'closed', closed_at = now() where id = r.id;
      end if;
      delete from public.room_members where room_id = r.id and player_id = uid;
      delete from public.room_spectators where room_id = r.id and player_id = uid;
      return null;
    end if;
  end if;
  return jsonb_build_object(
    'id', r.id, 'code', r.code, 'host_id', r.host_id, 'status', r.status, 'is_ranked', r.is_ranked,
    'viewer_role', case
      when exists(select 1 from public.room_members where room_id = r.id and player_id = uid) then 'player'
      when exists(select 1 from public.room_spectators where room_id = r.id and player_id = uid) then 'spectator'
      else 'none' end,
    'members', coalesce((select jsonb_agg(jsonb_build_object(
      'player_id', m.player_id, 'display_name', p.display_name, 'team', m.team, 'is_ready', m.is_ready
    ) order by m.team) from public.room_members m join public.profiles p on p.id = m.player_id
      where m.room_id = r.id), '[]'::jsonb),
    'spectators', coalesce((select jsonb_agg(jsonb_build_object(
      'player_id', s.player_id, 'display_name', p.display_name
    ) order by s.joined_at) from public.room_spectators s join public.profiles p on p.id = s.player_id
      where s.room_id = r.id), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.classic_lobby(text, text, boolean) from public, anon;
grant execute on function public.classic_lobby(text, text, boolean) to authenticated;

alter table public.bullet_rooms drop column if exists mode;

commit;
