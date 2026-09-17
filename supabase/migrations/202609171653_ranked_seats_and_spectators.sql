-- Applied live to project jtshieblptpxtkociseo on 2026-09-17. Adds the
-- schema needed for ranked seat reservation and code-based spectating on
-- top of the private-1v1 lobby from 202609160001_classic_lobbies.sql.
begin;

-- Ranked rooms are a subset of rooms whose player seats are pre-assigned
-- (by a future matchmaking flow) rather than first-come-first-served.
alter table public.rooms
  add column if not exists is_ranked boolean not null default false;

-- The two seats a ranked match is allowed to have. Populated by whatever
-- creates the ranked room (matchmaking); nobody else can ever occupy them,
-- even if a seat is vacated mid-match.
create table if not exists public.room_reserved_seats (
  room_id   uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  team      smallint not null check (team in (0, 1)),
  primary key (room_id, player_id)
);
alter table public.room_reserved_seats enable row level security;

create policy "Reserved seats are readable by signed-in players"
  on public.room_reserved_seats for select
  to authenticated
  using (true);

-- Anyone who enters a valid room code but isn't eligible for a player seat
-- (room full, or a ranked room they weren't matched into) watches instead.
create table if not exists public.room_spectators (
  room_id    uuid not null references public.rooms(id) on delete cascade,
  player_id  uuid not null references public.profiles(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (room_id, player_id)
);
alter table public.room_spectators enable row level security;

create policy "Spectators are readable by signed-in players"
  on public.room_spectators for select
  to authenticated
  using (true);

create policy "Players can start spectating themselves"
  on public.room_spectators for insert
  to authenticated
  with check (auth.uid() = player_id);

create policy "Players can stop spectating themselves"
  on public.room_spectators for delete
  to authenticated
  using (auth.uid() = player_id);

-- Defense in depth: even a direct insert (bypassing classic_lobby) can never
-- claim a player seat in a ranked room unless it is that player's reserved seat.
drop policy if exists "Players join rooms as themselves" on public.room_members;
create policy "Players join rooms as themselves"
  on public.room_members
  for insert
  to authenticated
  with check (
    auth.uid() = player_id
    and (
      not exists (select 1 from public.rooms r where r.id = room_members.room_id and r.is_ranked)
      or exists (
        select 1 from public.room_reserved_seats s
        where s.room_id = room_members.room_id
          and s.player_id = room_members.player_id
          and s.team = room_members.team
      )
    )
  );

-- classic_lobby: joining a code you're not eligible to play in (room full,
-- or a ranked room you weren't matched into) now seats you as a spectator
-- instead of raising "room full". Also reports viewer_role and the
-- spectator roster so the client can render "Spectating".
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
  -- Serialize simultaneous requests from one player, then lock the room for seat changes.
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

commit;
