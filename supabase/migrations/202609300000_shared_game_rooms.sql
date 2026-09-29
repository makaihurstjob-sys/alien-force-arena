-- Persistent room identity across game modes. Existing Bullet Run rooms retain their codes.
begin;
alter table public.bullet_rooms add column if not exists mode text not null default 'bullet' check (mode in ('solo','practice','duel','bullet','ranked','arcade'));
-- Preserve existing private Classic room codes and rosters during the transition.
-- Stop on a cross-service code collision instead of silently assigning a new code.
do $$ begin
  if exists(select 1 from public.rooms r join public.bullet_rooms b on b.code = r.code
    where r.status = 'open' and r.mode = '1v1' and r.id <> b.id) then
    raise exception 'Existing Classic and Bullet Run room codes collide; resolve before migrating';
  end if;
end $$;
insert into public.bullet_rooms(id,code,host_id,status,created_at,mode)
  select id,code,host_id,'open',created_at,'duel' from public.rooms where status = 'open' and mode = '1v1'
  on conflict(id) do nothing;
insert into public.bullet_members(room_id,player_id,ready)
  select m.room_id,m.player_id,false from public.room_members m
  join public.rooms r on r.id = m.room_id where r.status = 'open' and r.mode = '1v1'
  on conflict(room_id,player_id) do nothing;
create or replace function public.game_lobby(p_action text, p_code text default '', p_mode text default 'bullet') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r public.bullet_rooms%rowtype;
  generated text;
  capacity integer;
  minimum integer;
begin
  if p_mode is null or p_mode not in ('solo','practice','duel','bullet','ranked','arcade') then raise exception 'Unknown game mode'; end if;
  if uid is null then raise exception 'Sign in to use rooms'; end if;
  if p_action not in ('create','join','get','leave','ready','unready','launch','return','mode') or p_action is null then raise exception 'Unknown action'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  if p_action in ('create','join') then
    insert into public.profiles(id, display_name)
    values(uid, 'Pilot-' || substr(replace(uid::text, '-', ''), 1, 18)) on conflict(id) do nothing;
  end if;
  if p_action = 'create' then
    select br.* into r from public.bullet_rooms br join public.bullet_members bm on bm.room_id = br.id
      where bm.player_id = uid and br.status = 'open' order by br.created_at desc limit 1;
    if r.id is null then
      loop
        generated := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
        begin
          insert into public.bullet_rooms(code, host_id, mode) values(generated, uid, p_mode) returning * into r;
          exit;
        exception when unique_violation then null;
        end;
      end loop;
      insert into public.bullet_members(room_id,player_id) values(r.id,uid);
    end if;
  else
    select * into r from public.bullet_rooms where code = upper(trim(p_code)) for update;
    if r.id is null then raise exception 'Room not found'; end if;
    capacity := case r.mode when 'solo' then 1 when 'practice' then 1 when 'duel' then 2 when 'ranked' then 2 when 'arcade' then 4 else 6 end;
    minimum := case when r.mode in ('solo','practice','arcade') then 1 else 2 end;
    if p_action = 'join' then
      if r.status <> 'open' then raise exception 'Room is closed'; end if;
      if exists(select 1 from public.bullet_members bm join public.bullet_rooms br on br.id = bm.room_id
        where bm.player_id = uid and br.status = 'open' and br.id <> r.id) then
        raise exception 'Leave your current room first';
      end if;
      if not exists(select 1 from public.bullet_members where room_id = r.id and player_id = uid) then
        if (select count(*) from public.bullet_members where room_id = r.id) >= capacity then raise exception 'Room is full'; end if;
        insert into public.bullet_members(room_id,player_id) values(r.id,uid);
      end if;
    elsif not exists(select 1 from public.bullet_members where room_id = r.id and player_id = uid) then
      raise exception 'You are not a member of this room';
    end if;
    if p_action in ('ready','unready','launch','return') and p_mode <> r.mode then raise exception 'The room changed games. Try again.'; end if;
    if p_action = 'mode' then
      if r.status <> 'open' then raise exception 'Room is closed'; end if;
      if r.host_id <> uid then raise exception 'Only the host can change games'; end if;
      if r.phase <> 'lobby' then raise exception 'Return to the lobby before changing games'; end if;
      capacity := case p_mode when 'solo' then 1 when 'practice' then 1 when 'duel' then 2 when 'ranked' then 2 when 'arcade' then 4 else 6 end;
      if (select count(*) from public.bullet_members where room_id = r.id) > capacity then raise exception 'Too many pilots for this game'; end if;
      if r.mode <> p_mode then
        update public.bullet_rooms set mode = p_mode, match_id = null, match_roster = '{}' where id = r.id returning * into r;
        update public.bullet_members set ready = false where room_id = r.id;
      end if;
    end if;
    if p_action = 'launch' then
      if r.mode in ('ranked','arcade') then raise exception 'This game is coming soon'; end if;
      if (select count(*) from public.bullet_members where room_id = r.id) > capacity then raise exception 'Too many pilots for this game'; end if;
      if r.status <> 'open' then raise exception 'Room is closed'; end if;
      if r.host_id <> uid then raise exception 'Only the host can launch'; end if;
      if r.phase <> 'lobby' then raise exception 'Match already running'; end if;
      if (select count(*) from public.bullet_members where room_id = r.id) < minimum then
        raise exception 'Not enough pilots to start';
      end if;
      if exists(select 1 from public.bullet_members where room_id = r.id and not ready) then
        raise exception 'Every pilot must be ready';
      end if;
    end if;
    if p_action = 'launch' then
      update public.bullet_rooms set phase = 'playing', match_id = gen_random_uuid(),
        match_roster = array(select player_id from public.bullet_members where room_id = r.id)
        where id = r.id returning * into r;
      update public.bullet_members set ready = false where room_id = r.id;
    end if;
    if p_action = 'return' then
      if r.status <> 'open' then raise exception 'Room is closed'; end if;
      if r.host_id <> uid and r.mode <> 'duel' then raise exception 'Only the host can return the room'; end if;
      if r.phase = 'playing' then
        update public.bullet_rooms set phase = 'lobby', match_id = null, match_roster = '{}'
          where id = r.id returning * into r;
        update public.bullet_members set ready = false where room_id = r.id;
      end if;
    end if;
    if p_action in ('ready','unready') then
      if r.phase <> 'lobby' then raise exception 'Wait for the next round'; end if;
      if r.status <> 'open' then raise exception 'Room is closed'; end if;
      update public.bullet_members set ready = (p_action = 'ready')
        where room_id = r.id and player_id = uid;
    end if;
    if p_action = 'leave' then
      if r.host_id = uid then update public.bullet_rooms set status = 'closed' where id = r.id; end if;
      delete from public.bullet_members where room_id = r.id and player_id = uid;
      return null;
    end if;
  end if;
  return jsonb_build_object('mode',r.mode,'id',r.id,'code',r.code,'host_id',r.host_id,'status',r.status,'phase',r.phase,'match_id',r.match_id,'match_roster',to_jsonb(r.match_roster),
    'members',coalesce((select jsonb_agg(jsonb_build_object('player_id',bm.player_id,'display_name',p.display_name,'ready',bm.ready) order by (bm.player_id = r.host_id) desc, bm.joined_at, bm.player_id)
      from public.bullet_members bm join public.profiles p on p.id=bm.player_id where bm.room_id=r.id),'[]'::jsonb));
end;
$$;
revoke all on function public.game_lobby(text,text,text) from public, anon;
grant execute on function public.game_lobby(text,text,text) to authenticated;
alter function public.bullet_lobby(text,text) rename to bullet_lobby_legacy;
revoke all on function public.bullet_lobby_legacy(text,text) from public, anon, authenticated;
create or replace function public.bullet_lobby(p_action text, p_code text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  result := public.game_lobby(p_action, p_code, 'bullet');
  if result is not null and result->>'mode' <> 'bullet' then
    raise exception 'This room changed games. Open its invite from the updated home screen.';
  end if;
  return result;
end;
$$;
revoke all on function public.bullet_lobby(text,text) from public, anon;
grant execute on function public.bullet_lobby(text,text) to authenticated;
-- Old Classic invite links and clients resolve to the same persistent room.
create or replace function public.classic_lobby(p_action text, p_code text default '', p_ready boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_action not in ('create','join','get','ready','leave') or p_action is null then raise exception 'Unknown room action'; end if;
  result := public.game_lobby(case when p_action = 'ready' and not coalesce(p_ready,false) then 'unready' else p_action end, p_code, 'duel');
  if result is null then return null; end if;
  if result->>'mode' <> 'duel' then raise exception 'This room changed games. Open its invite from the updated home screen.'; end if;
  return result || jsonb_build_object('members', coalesce((select jsonb_agg(member || jsonb_build_object('is_ready',member->'ready','team',ordinality-1))
    from jsonb_array_elements(result->'members') with ordinality as members(member,ordinality)), '[]'::jsonb));
end;
$$;
revoke all on function public.classic_lobby(text,text,boolean) from public, anon;
grant execute on function public.classic_lobby(text,text,boolean) to authenticated;
commit;
