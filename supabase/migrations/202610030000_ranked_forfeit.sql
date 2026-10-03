begin;
alter table public.ranked_matches add column forfeit_player_id uuid references public.profiles(id);
create function public.ranked_forfeit(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); m public.matches%rowtype; r public.ranked_matches%rowtype;
begin
  if uid is null then raise exception 'Sign in to forfeit'; end if;
  perform pg_catalog.pg_advisory_xact_lock(724619301);
  select * into m from public.matches where id = p_match_id for update;
  select * into r from public.ranked_matches where match_id = p_match_id;
  if r.match_id is null or not exists (
    select 1 from public.match_participants where match_id = p_match_id and player_id = uid
  ) then raise exception 'Not a participant in this Ranked match'; end if;
  if r.result is not null then return jsonb_build_object('status','completed'); end if;
  if m.status <> 'live' then raise exception 'Match is not live'; end if;
  update public.ranked_matches set forfeit_player_id = uid
    where match_id = p_match_id and forfeit_player_id is null;
  return jsonb_build_object('status','requested');
end;
$$;
revoke all on function public.ranked_forfeit(uuid) from public, anon, authenticated;
grant execute on function public.ranked_forfeit(uuid) to authenticated;
commit;
