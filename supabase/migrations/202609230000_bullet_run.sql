-- Independent free-for-all rooms; Classic's two-seat rooms remain unchanged.
begin;
create table if not exists public.bullet_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  host_id uuid not null references public.profiles(id),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);
create table if not exists public.bullet_members (
  room_id uuid not null references public.bullet_rooms(id) on delete cascade,
  player_id uuid not null references public.profiles(id),
  joined_at timestamptz not null default now(),
  primary key(room_id, player_id)
);
revoke all on public.bullet_rooms, public.bullet_members from public, anon, authenticated;
alter table public.bullet_rooms enable row level security;
alter table public.bullet_members enable row level security;
create or replace function public.bullet_lobby(p_action text, p_code text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r public.bullet_rooms%rowtype;
  generated text;
begin
  if uid is null then raise exception 'Sign in to use Bullet Run'; end if;
  if p_action not in ('create','join','get','leave') or p_action is null then raise exception 'Unknown action'; end if;
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
    if p_action = 'leave' then
      if r.host_id = uid then update public.bullet_rooms set status = 'closed' where id = r.id; end if;
      delete from public.bullet_members where room_id = r.id and player_id = uid;
      return null;
    end if;
  end if;
  return jsonb_build_object('id',r.id,'code',r.code,'host_id',r.host_id,'status',r.status,
    'members',coalesce((select jsonb_agg(jsonb_build_object('player_id',bm.player_id,'display_name',p.display_name) order by bm.joined_at)
      from public.bullet_members bm join public.profiles p on p.id=bm.player_id where bm.room_id=r.id),'[]'::jsonb));
end;
$$;
revoke all on function public.bullet_lobby(text,text) from public, anon;
grant execute on function public.bullet_lobby(text,text) to authenticated;
commit;
