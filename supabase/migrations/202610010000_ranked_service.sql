-- Ranked preseason persistence. No browser can submit results or choose ratings.
begin;
create table public.ranked_players (
  player_id uuid primary key references public.profiles(id),
  rating integer not null default 0 check (rating >= 0),
  peak integer not null default 0 check (peak >= rating),
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  streak integer not null default 0,
  disconnect_count integer not null default 0,
  last_disconnect_at timestamptz,
  cooldown_until timestamptz,
  active_match_id uuid references public.matches(id),
  updated_at timestamptz not null default now()
);
alter table public.ranked_players enable row level security;
revoke all on public.ranked_players from public, anon, authenticated;
grant select on public.ranked_players to authenticated;
create policy ranked_player_self on public.ranked_players for select to authenticated using (player_id = auth.uid());

create table public.ranked_matches (
  match_id uuid primary key references public.matches(id),
  season text not null default 'preseason' check (season = 'preseason'),
  format text not null check (format in ('1a','1b')),
  result jsonb,
  assignment_expires_at timestamptz not null default (now() + interval '2 minutes')
);
alter table public.ranked_matches enable row level security;
revoke all on public.ranked_matches from public, anon, authenticated;
grant select on public.ranked_matches, public.ranked_players to service_role;

alter table public.matchmaking_queue add column ranked boolean not null default false,
  add column prefer_rounds boolean not null default false,
  add column heartbeat_at timestamptz not null default now(),
  add column match_id uuid references public.matches(id);
-- The old insert/update policies accepted client-provided ratings and timestamps.
revoke insert, update on public.matchmaking_queue from authenticated;

create function public.ranked_queue(p_action text, p_rounds boolean default false)
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
  if q.id is null and p_action = 'join' then
    insert into public.matchmaking_queue(player_id,mode,rating,region,latency_ms,ranked,prefer_rounds,enqueued_at,heartbeat_at)
      values(uid,'1v1',me.rating,'unassigned',0,true,coalesce(p_rounds,false),t,t) returning * into q;
  end if;
  if q.id is null then return jsonb_build_object('status','idle'); end if;
  -- Repeated joins preserve the original wait and preference.
  update public.matchmaking_queue set heartbeat_at = t where id = q.id;
  select c.* into opponent from public.matchmaking_queue c
    join public.ranked_players p on p.player_id = c.player_id
    where c.ranked and c.status = 'waiting' and c.player_id <> uid
      and p.active_match_id is null and (p.cooldown_until is null or p.cooldown_until <= t)
      and exists(select 1 from auth.identities i where i.user_id = c.player_id and i.provider = 'discord')
      and abs(c.rating::bigint - q.rating::bigint) <= 300
      and ((q.prefer_rounds and c.prefer_rounds) or
        ((not q.prefer_rounds or t >= q.enqueued_at + interval '10 seconds') and
         (not c.prefer_rounds or t >= c.enqueued_at + interval '10 seconds')))
    order by (q.prefer_rounds and c.prefer_rounds) desc,
      abs(c.rating::bigint - q.rating::bigint), c.enqueued_at, c.player_id limit 1;
  if opponent.id is null then return jsonb_build_object('status','waiting','queued_at',q.enqueued_at); end if;
  fmt := case when q.prefer_rounds and opponent.prefer_rounds then '1b'
    when q.prefer_rounds or opponent.prefer_rounds then '1a'
    when random() < 0.8 then '1a' else '1b' end;
  insert into public.matches(mode) values('1v1') returning id into mid;
  insert into public.ranked_matches(match_id,format,assignment_expires_at) values(mid,fmt,t + interval '2 minutes');
  insert into public.match_participants(match_id,player_id,team,rating_before)
    values(mid,uid,0,q.rating),(mid,opponent.player_id,1,opponent.rating);
  update public.ranked_players set active_match_id = mid where player_id in (uid,opponent.player_id);
  update public.matchmaking_queue set status = 'matched', matched_at = t, match_id = mid where id in (q.id,opponent.id);
  return jsonb_build_object('status','matched','match_id',mid);
end;
$$;

create function public.ranked_queue_join(p_rounds boolean default false) returns jsonb
language sql security definer set search_path = '' as $$ select public.ranked_queue('join',p_rounds) $$;
create function public.ranked_queue_poll() returns jsonb
language sql security definer set search_path = '' as $$ select public.ranked_queue('poll') $$;
create function public.ranked_queue_leave() returns jsonb
language sql security definer set search_path = '' as $$ select public.ranked_queue('leave') $$;

-- A trusted simulation claims an assignment before it can award any rating.
create function public.ranked_match_start(p_match_id uuid, p_server_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.matches%rowtype; r public.ranked_matches%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(724619301);
  select * into m from public.matches where id = p_match_id for update;
  select * into r from public.ranked_matches where match_id = p_match_id;
  if r.match_id is null or p_server_id is null or length(trim(p_server_id)) = 0 then raise exception 'Invalid ranked assignment'; end if;
  if m.status = 'live' and m.server_id = p_server_id then null;
  elsif m.status = 'pending' and r.assignment_expires_at > clock_timestamp() then
    update public.matches set status = 'live', server_id = p_server_id, started_at = clock_timestamp() where id = p_match_id;
  else raise exception 'Assignment is unavailable'; end if;
  return jsonb_build_object('match_id',p_match_id,'format',r.format,'participants',
    (select jsonb_agg(jsonb_build_object('player_id',player_id,'team',team) order by team) from public.match_participants where match_id = p_match_id));
end;
$$;

create function public.ranked_settle(p_match_id uuid, p_server_id text, p_winner smallint,
  p_loser_score integer, p_disconnect boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m public.matches%rowtype; r public.ranked_matches%rowtype; part record;
  t timestamptz; request jsonb; amount integer; wr integer; lr integer;
  next_rating integer; delta integer; floor_rating integer; dc integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(724619301);
  t := clock_timestamp();
  select * into m from public.matches where id = p_match_id for update;
  select * into r from public.ranked_matches where match_id = p_match_id;
  if r.match_id is null or p_server_id is null or m.server_id is distinct from p_server_id then raise exception 'Invalid ranked server assignment'; end if;
  if p_disconnect is null or p_loser_score is null or p_loser_score not between 0 and 3
    or (p_winner is not null and p_winner not in (0,1))
    or (p_winner is null and (r.format <> '1a' or p_disconnect or p_loser_score <> 0)) then raise exception 'Invalid ranked result'; end if;
  request := jsonb_build_object('winner',p_winner,'loser_score',p_loser_score,'disconnect',p_disconnect);
  if r.result is not null then
    if r.result = request then return r.result; end if;
    raise exception 'Conflicting ranked result';
  end if;
  if m.status <> 'live' then raise exception 'Match is not live'; end if;
  if (select count(*) from public.match_participants where match_id = p_match_id) <> 2
    or (select count(distinct team) from public.match_participants where match_id = p_match_id) <> 2 then raise exception 'Invalid ranked participants'; end if;
  select rating_before into wr from public.match_participants where match_id = p_match_id and team = p_winner;
  select rating_before into lr from public.match_participants where match_id = p_match_id and team <> p_winner;
  amount := round(greatest(21::numeric,least(39::numeric,30 + 4.5 * greatest(-1::numeric,least(1::numeric,(lr::numeric-wr)/300))
    + 4.5 * case when p_disconnect then 1 else 1 - 2 * p_loser_score::numeric/3 end)));
  for part in select mp.*, p.disconnect_count, p.last_disconnect_at, p.cooldown_until
    from public.match_participants mp join public.ranked_players p on p.player_id = mp.player_id
    where mp.match_id = p_match_id order by mp.player_id loop
    if not exists(select 1 from public.ranked_players where player_id = part.player_id
      and active_match_id = p_match_id and rating = part.rating_before) then raise exception 'Stale ranked participant'; end if;
    delta := case when p_winner is null then 0 when part.team = p_winner then amount else -amount end;
    floor_rating := (part.rating_before / 100) * 100;
    next_rating := greatest(0,case when delta < 0 and part.rating_before < 1500 and part.rating_before > floor_rating
      and part.rating_before + delta <= floor_rating then floor_rating else part.rating_before + delta end);
    dc := case when p_disconnect and part.team <> p_winner then
      case when part.last_disconnect_at >= t - interval '15 minutes' then part.disconnect_count + 1 else 1 end else 0 end;
    update public.ranked_players set rating = next_rating, peak = greatest(peak,next_rating),
      wins = wins + case when part.team = p_winner then 1 else 0 end,
      losses = losses + case when part.team <> p_winner then 1 else 0 end,
      draws = draws + case when p_winner is null then 1 else 0 end,
      streak = case when p_winner is null then 0 when part.team = p_winner then greatest(0,streak)+1 else least(0,streak)-1 end,
      disconnect_count = dc, last_disconnect_at = case when dc > 0 then t else null end,
      cooldown_until = case when dc >= 3 then t + case when dc = 3 then interval '5 minutes' when dc = 4 then interval '15 minutes' else interval '30 minutes' end else null end,
      active_match_id = null, updated_at = t where player_id = part.player_id;
    update public.match_participants set rating_after = next_rating,
      outcome = (case when p_winner is null then 'draw' when part.team = p_winner then 'win' when p_disconnect then 'disconnect' else 'loss' end)::public.participant_outcome
      where match_id = p_match_id and player_id = part.player_id;
  end loop;
  update public.ranked_matches set result = request where match_id = p_match_id;
  update public.matches set status = 'completed', winning_team = p_winner, is_draw = (p_winner is null), ended_at = t where id = p_match_id;
  return request;
end;
$$;
-- Completed draws have no winning team.
alter table public.matches add column is_draw boolean not null default false check (not is_draw or winning_team is null);
alter table public.matches drop constraint completed_has_result;
alter table public.matches add constraint completed_has_result check (status <> 'completed' or (ended_at is not null and (winning_team is not null or is_draw)));

-- Prevent the legacy Elo writer from settling a Ranked match by mistake.
create function public.guard_ranked_legacy_settlement() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'completed' and exists(select 1 from public.ranked_matches where match_id = new.id and result is null) then
    raise exception 'Use ranked_settle for Ranked results';
  end if;
  return new;
end;
$$;
create trigger ranked_settlement_guard before update on public.matches for each row execute function public.guard_ranked_legacy_settlement();

revoke all on function public.ranked_queue(text,boolean), public.ranked_queue_join(boolean), public.ranked_queue_poll(), public.ranked_queue_leave(),
  public.ranked_match_start(uuid,text), public.ranked_settle(uuid,text,smallint,integer,boolean), public.guard_ranked_legacy_settlement() from public, anon, authenticated;
grant execute on function public.ranked_queue_join(boolean), public.ranked_queue_poll(), public.ranked_queue_leave() to authenticated;
grant execute on function public.ranked_match_start(uuid,text), public.ranked_settle(uuid,text,smallint,integer,boolean) to service_role;
commit;
