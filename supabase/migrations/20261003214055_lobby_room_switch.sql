begin;
create function public.game_lobby_join_room(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); old_room record; target public.bullet_rooms%rowtype;
begin
  if uid is null then raise exception 'Sign in to join a room'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  if exists(select 1 from public.ranked_players where player_id = uid and active_match_id is not null)
    or exists(select 1 from public.matchmaking_queue where player_id = uid and ranked and status = 'waiting') then
    raise exception 'Finish your Ranked match or cancel matchmaking before joining another room';
  end if;
  select * into target from public.bullet_rooms where code = upper(trim(p_code)) for update;
  if target.id is null then raise exception 'Room not found'; end if;
  if target.status <> 'open' then raise exception 'Room is closed'; end if;
  if target.phase <> 'lobby' then raise exception 'Wait for the match to finish before joining'; end if;
  for old_room in select br.* from public.bullet_rooms br join public.bullet_members bm on bm.room_id = br.id
    where bm.player_id = uid and br.status = 'open' and br.id <> target.id
  loop
    if old_room.phase <> 'lobby' then raise exception 'Return to your lobby before joining another room'; end if;
    perform public.game_lobby('leave',old_room.code,old_room.mode);
  end loop;
  return public.game_lobby('join',target.code,target.mode);
end;
$$;
revoke all on function public.game_lobby_join_room(text) from public, anon;
grant execute on function public.game_lobby_join_room(text) to authenticated;
commit;
