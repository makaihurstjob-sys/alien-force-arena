begin;
alter table public.rooms drop constraint capacity_matches_mode;
alter table public.rooms add constraint capacity_matches_mode check (
 (mode = '1v1' and max_players = 2) or (mode = '2v2' and max_players = 4)
 or (mode = 'ffa' and max_players = 4));
alter table public.room_members drop constraint team_is_0_or_1;
alter table public.room_members add constraint valid_player_seat check (team between 0 and 3);
create or replace function public.enforce_room_capacity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r public.rooms%rowtype; taken integer;
begin
 select * into r from public.rooms where id = new.room_id for update;
 if r.id is null or r.status <> 'open' then raise exception 'Room is not open'; end if;
 if new.team < 0 or new.team >= (case when r.mode::text = 'ffa' then r.max_players else 2 end) then
   raise exception 'Invalid player seat';
 end if;
 select count(*) into taken from public.room_members where room_id = new.room_id;
 if taken >= r.max_players then raise exception 'Room is full'; end if;
 select count(*) into taken from public.room_members where room_id = new.room_id and team = new.team;
 if taken >= (case when r.mode::text = 'ffa' then 1 else r.max_players / 2 end) then
   raise exception 'Seat is already taken';
 end if;
 return new;
end;
$$;
create or replace function public.classic_lobby(
  p_action text, p_code text, p_ready boolean, p_mode text
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
  -- Serialize simultaneous requests from one player, then lock the room for seat changes.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  if p_action in ('create', 'join') then
    insert into public.profiles(id, display_name)
    values(uid, 'Pilot-' || substr(replace(uid::text, '-', ''), 1, 18))
    on conflict (id) do nothing;
  end if;
  if p_action = 'create' then
    if p_mode is null or p_mode not in ('1v1', 'ffa') then raise exception 'Unknown game mode'; end if;
    select rooms.* into r from public.rooms rooms
      join public.room_members members on members.room_id = rooms.id
      where members.player_id = uid and rooms.status = 'open'
      order by rooms.created_at desc limit 1;
    if r.id is not null and r.mode::text <> p_mode then
      raise exception 'Leave your current room before creating a different mode.';
    end if;
    if r.id is null then
      loop
        room_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
        begin
          insert into public.rooms(code, host_id, mode, max_players)
          values(room_code, uid, p_mode::public.game_mode, case when p_mode = 'ffa' then 4 else 2 end) returning * into r;
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
      if r.mode::text not in ('1v1', 'ffa') then raise exception 'Unsupported room mode.'; end if;
      if exists(select 1 from public.room_members m join public.rooms other on other.id = m.room_id
        where m.player_id = uid and other.status = 'open' and other.id <> r.id) then
        raise exception 'Leave your current room before joining another.';
      end if;
      is_member := exists(select 1 from public.room_members where room_id = r.id and player_id = uid);
      if not is_member then
        seat := null;
        if r.is_ranked then
          select team into seat from public.room_reserved_seats where room_id = r.id and player_id = uid;
        elsif (select count(*) from public.room_members where room_id = r.id) < r.max_players then
          select n::smallint into seat from generate_series(0, r.max_players - 1) n
          where not exists(select 1 from public.room_members m where m.room_id = r.id and m.team = n)
          order by n limit 1;
        end if;
        if seat is not null then
          insert into public.room_members(room_id, player_id, team) values(r.id, uid, seat);
          delete from public.room_spectators where room_id = r.id and player_id = uid;
        elsif r.mode::text = 'ffa' then
          raise exception 'This FFA room is full.';
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
    'mode', r.mode, 'max_players', r.max_players,
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

revoke all on function public.classic_lobby(text, text, boolean, text) from public, anon;
grant execute on function public.classic_lobby(text, text, boolean, text) to authenticated;

-- Preserve existing clients and the original three-argument RPC.
create or replace function public.classic_lobby(
  p_action text, p_code text default '', p_ready boolean default false
) returns jsonb language sql security definer set search_path = '' as $$
  select public.classic_lobby(p_action, p_code, p_ready, '1v1');
$$;
revoke all on function public.classic_lobby(text, text, boolean) from public, anon;
grant execute on function public.classic_lobby(text, text, boolean) to authenticated;
commit;
