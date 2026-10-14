-- Region queues do not provision physical hosts. Old clients/workers default to US East.
alter table public.ranked_matches add column region text not null default 'us-east'
  check (region in ('us-east','us-west'));
-- Existing global waiting entries stay in the legacy default pool.
update public.matchmaking_queue set region='us-east' where ranked and region='unassigned';
create index ranked_waiting_region_idx on public.matchmaking_queue(region, rating, enqueued_at)
  where ranked and status='waiting';
create function public.ranked_queue_region(p_action text, p_rounds boolean, p_region text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  t timestamptz;
  me public.ranked_players%rowtype;
  q public.matchmaking_queue%rowtype;
  opponent public.matchmaking_queue%rowtype;
  mid uuid;
  fmt text;
begin
  if uid is null then raise exception 'Sign in with Discord'; end if;
  if p_region is null or p_region not in ('us-east','us-west') then raise exception 'Invalid ranked region'; end if;
  if p_action is null or p_action not in ('join','poll','leave') then raise exception 'Unknown queue action'; end if;
  if not exists(select 1 from auth.identities where user_id = uid and provider = 'discord') then
    raise exception 'Ranked requires a linked Discord identity';
  end if;
  -- One short transaction at a time: join/poll/leave/settlement use the same lock.
  perform pg_catalog.pg_advisory_xact_lock(724619301);
  t := clock_timestamp();
  -- Expire unclaimed assignments; live games require trusted server settlement.
  update public.matches m set status = 'abandoned', ended_at = t
    from public.ranked_matches r where r.match_id = m.id and m.status = 'pending'
    and r.assignment_expires_at <= t;
  update public.ranked_players p set active_match_id = null
    from public.matches m where m.id = p.active_match_id and m.status in ('abandoned','completed');
  update public.matchmaking_queue set status = 'cancelled'
    where ranked and status = 'waiting' and heartbeat_at <= t - interval '30 seconds';
  insert into public.profiles(id, display_name) values(uid, 'Pilot-' || substr(replace(uid::text,'-',''),1,18)) on conflict do nothing;
  insert into public.ranked_players(player_id) values(uid) on conflict do nothing;
  select * into me from public.ranked_players where player_id = uid;
  if me.active_match_id is not null then
    return jsonb_build_object('status','matched','match_id',me.active_match_id);
  end if;
  if p_action = 'leave' then
    update public.matchmaking_queue set status = 'cancelled' where player_id = uid and ranked and status = 'waiting';
    return jsonb_build_object('status','idle');
  end if;
  if me.cooldown_until > t then raise exception 'Ranked disconnect cooldown is active'; end if;
  select * into q from public.matchmaking_queue where player_id = uid and ranked and status = 'waiting';
  if q.id is not null and p_action = 'join' and q.region <> p_region then raise exception 'Leave the current queue before changing region'; end if;
  if q.id is null and p_action = 'join' then
    insert into public.matchmaking_queue(player_id,mode,rating,region,latency_ms,ranked,prefer_rounds,enqueued_at,heartbeat_at)
      values(uid,'1v1',me.rating,p_region,0,true,coalesce(p_rounds,false),t,t) returning * into q;
  end if;
  if q.id is null then return jsonb_build_object('status','idle'); end if;
  -- Repeated joins preserve the original wait and preference.
  update public.matchmaking_queue set heartbeat_at = t where id = q.id;
  select c.* into opponent from public.matchmaking_queue c
    join public.ranked_players p on p.player_id = c.player_id
    where c.region = q.region and c.ranked and c.status = 'waiting' and c.player_id <> uid
      and p.active_match_id is null and (p.cooldown_until is null or p.cooldown_until <= t)
      and exists(select 1 from auth.identities i where i.user_id = c.player_id and i.provider = 'discord')
      and abs(c.rating::bigint - q.rating::bigint) <= 300
      and ((q.prefer_rounds and c.prefer_rounds) or
        ((not q.prefer_rounds or t >= q.enqueued_at + interval '10 seconds') and
         (not c.prefer_rounds or t >= c.enqueued_at + interval '10 seconds')))
    order by (q.prefer_rounds and c.prefer_rounds) desc,
      abs(c.rating::bigint - q.rating::bigint), c.enqueued_at, c.player_id limit 1;
  if opponent.id is null then return jsonb_build_object('status','waiting','queued_at',q.enqueued_at,'region',q.region); end if;
  fmt := case when q.prefer_rounds and opponent.prefer_rounds then '1b'
    when q.prefer_rounds or opponent.prefer_rounds then '1a'
    when random() < 0.8 then '1a' else '1b' end;
  insert into public.matches(mode) values('1v1') returning id into mid;
  insert into public.ranked_matches(match_id,format,region,assignment_expires_at) values(mid,fmt,q.region,t + interval '2 minutes');
  insert into public.match_participants(match_id,player_id,team,rating_before)
    values(mid,uid,0,q.rating),(mid,opponent.player_id,1,opponent.rating);
  update public.ranked_players set active_match_id = mid where player_id in (uid,opponent.player_id);
  update public.matchmaking_queue set status = 'matched', matched_at = t, match_id = mid where id in (q.id,opponent.id);
  return jsonb_build_object('status','matched','match_id',mid);
end;
$$;

create function public.ranked_match_start_region(p_match_id uuid, p_server_id text, p_region text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.matches%rowtype; r public.ranked_matches%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(724619301);
  select * into m from public.matches where id = p_match_id for update;
  select * into r from public.ranked_matches where match_id = p_match_id;
  if p_region is null or r.region is distinct from p_region then raise exception 'Ranked region does not match this server'; end if;
  if r.match_id is null or p_server_id is null or length(trim(p_server_id)) = 0 then raise exception 'Invalid ranked assignment'; end if;
  if m.status = 'live' and m.server_id = p_server_id then null;
  elsif m.status = 'pending' and r.assignment_expires_at > clock_timestamp() then
    update public.matches set status = 'live', server_id = p_server_id, started_at = clock_timestamp() where id = p_match_id;
  else raise exception 'Assignment is unavailable'; end if;
  return jsonb_build_object('match_id',p_match_id,'format',r.format,'participants',
    (select jsonb_agg(jsonb_build_object('player_id',player_id,'team',team) order by team) from public.match_participants where match_id = p_match_id));
end;
$$;


create or replace function public.ranked_queue(p_action text, p_rounds boolean default false) returns jsonb
language sql security definer set search_path = '' as $$ select public.ranked_queue_region(p_action,p_rounds,'us-east') $$;
create function public.ranked_queue_join_region(p_region text, p_rounds boolean default false) returns jsonb
language sql security definer set search_path = '' as $$ select public.ranked_queue_region('join',p_rounds,p_region) $$;
create or replace function public.ranked_match_start(p_match_id uuid, p_server_id text) returns jsonb
language sql security definer set search_path = '' as $$ select public.ranked_match_start_region(p_match_id,p_server_id,'us-east') $$;
revoke all on function public.ranked_queue_region(text,boolean,text), public.ranked_queue_join_region(text,boolean),
  public.ranked_match_start_region(uuid,text,text) from public,anon,authenticated;
grant execute on function public.ranked_queue_join_region(text,boolean) to authenticated;
grant execute on function public.ranked_match_start_region(uuid,text,text) to service_role;
