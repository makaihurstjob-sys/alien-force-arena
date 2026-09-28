-- Shared readiness: only the signed-in member can change their own flag.
begin;
alter table public.bullet_members add column if not exists ready boolean not null default false;
alter table public.bullet_rooms add column if not exists phase text not null default 'lobby' check (phase in ('lobby','playing'));
alter table public.bullet_rooms add column if not exists match_id uuid;
alter table public.bullet_rooms add column if not exists match_roster uuid[] not null default '{}';
create or replace function public.bullet_lobby(p_action text, p_code text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r public.bullet_rooms%rowtype;
  generated text;
begin
  if uid is null then raise exception 'Sign in to use Bullet Run'; end if;
  if p_action not in ('create','join','get','leave','ready','unready','launch','return') or p_action is null then raise exception 'Unknown action'; end if;
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
          insert into public.bullet_rooms(code, host_id) values(generated, uid) returning * into r;
          exit;
        exception when unique_violation then null;
        end;
      end loop;
      insert into public.bullet_members(room_id,player_id) values(r.id,uid);
    end if;
  else
    select * into r from public.bullet_rooms where code = upper(trim(p_code)) for update;
    if r.id is null then raise exception 'Room not found'; end if;
    if p_action = 'join' then
      if r.status <> 'open' then raise exception 'Room is closed'; end if;
      if exists(select 1 from public.bullet_members bm join public.bullet_rooms br on br.id = bm.room_id
        where bm.player_id = uid and br.status = 'open' and br.id <> r.id) then
        raise exception 'Leave your current Bullet Run room first';
      end if;
      if not exists(select 1 from public.bullet_members where room_id = r.id and player_id = uid) then
        if (select count(*) from public.bullet_members where room_id = r.id) >= 24 then raise exception 'Room is full'; end if;
        insert into public.bullet_members(room_id,player_id) values(r.id,uid);
      end if;
    elsif not exists(select 1 from public.bullet_members where room_id = r.id and player_id = uid) then
      raise exception 'You are not a member of this room';
    end if;
    if p_action = 'launch' then
      if r.status <> 'open' then raise exception 'Room is closed'; end if;
      if r.host_id <> uid then raise exception 'Only the host can launch'; end if;
      if r.phase <> 'lobby' then raise exception 'Match already running'; end if;
      if (select count(*) from public.bullet_members where room_id = r.id) < 2 then
        raise exception 'At least two pilots are required';
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
      if r.host_id <> uid then raise exception 'Only the host can return the room'; end if;
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
  return jsonb_build_object('id',r.id,'code',r.code,'host_id',r.host_id,'status',r.status,'phase',r.phase,'match_id',r.match_id,'match_roster',to_jsonb(r.match_roster),
    'members',coalesce((select jsonb_agg(jsonb_build_object('player_id',bm.player_id,'display_name',p.display_name,'ready',bm.ready) order by bm.joined_at)
      from public.bullet_members bm join public.profiles p on p.id=bm.player_id where bm.room_id=r.id),'[]'::jsonb));
end;
$$;
revoke all on function public.bullet_lobby(text,text) from public, anon;
grant execute on function public.bullet_lobby(text,text) to authenticated;
commit;
