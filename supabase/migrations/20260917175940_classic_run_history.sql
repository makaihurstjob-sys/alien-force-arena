-- Community Classic records. Browser-reported telemetry is NOT verified competition.
create table public.classic_runs (
  id uuid primary key,
  player_id uuid not null references public.profiles(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  outcome text not null check (outcome in ('game_over', 'restarted', 'abandoned')),
  start_level integer not null check (start_level between 1 and 999),
  level integer not null check (level between start_level and 100000),
  score integer not null check (score between 0 and 100000000),
  duration_ms integer not null check (duration_ms between 1 and 604800000),
  shots integer not null check (shots between 0 and 1000000),
  hits integer not null check (hits between 0 and shots),
  crashes integer not null check (crashes between 0 and 3),
  shot_deaths integer not null check (shot_deaths between 0 and 3),
  lives_remaining integer not null check (lives_remaining between 0 and 3),
  levels_cleared integer not null check (levels_cleared between 0 and 100000),
  rules_version text not null default 'classic-v1' check (rules_version = 'classic-v1'),
  check (crashes + shot_deaths + lives_remaining = 3),
  check ((outcome = 'game_over') = (lives_remaining = 0)),
  check (levels_cleared between level - start_level and level - start_level + 1),
  check (hits >= levels_cleared * 9),
  check (score <= hits * 100 + levels_cleared * 500)
);
alter table public.classic_runs enable row level security;
revoke all on public.classic_runs from anon, authenticated;
grant select on public.classic_runs to anon, authenticated;
-- Server supplies timestamp/version; clients cannot rewrite or delete a saved run.
grant insert (id, player_id, outcome, start_level, level, score, duration_ms,
  shots, hits, crashes, shot_deaths, lives_remaining, levels_cleared)
  on public.classic_runs to authenticated;
grant all on public.classic_runs to service_role;
create policy "Classic runs are public" on public.classic_runs
  for select to anon, authenticated using (true);
create policy "Players submit their own Classic runs" on public.classic_runs
  for insert to authenticated with check ((select auth.uid()) = player_id);
create index classic_runs_player_history_idx on public.classic_runs (player_id, recorded_at desc, id);
create index classic_runs_best_idx on public.classic_runs (player_id, score desc, level desc, recorded_at, id)
  where outcome = 'game_over' and start_level = 1;

create view public.classic_leaderboard with (security_invoker = true) as
with best as (
  select distinct on (r.player_id) r.*
  from public.classic_runs r
  where r.outcome = 'game_over' and r.start_level = 1
  order by r.player_id, r.score desc, r.level desc, r.recorded_at, r.id
)
select row_number() over (order by b.score desc, b.level desc, b.recorded_at, b.id) as rank,
  b.player_id, p.display_name, b.id as run_id, b.score, b.level, b.shots, b.hits,
  b.crashes, b.duration_ms, b.recorded_at,
  round(100.0 * b.hits / nullif(b.shots, 0), 1) as accuracy
from best b join public.profiles p on p.id = b.player_id;

create view public.classic_player_stats with (security_invoker = true) as
select p.id as player_id, p.display_name, count(r.id) as runs,
  count(r.id) filter (where r.outcome = 'game_over') as completed_runs,
  max(r.score) filter (where r.outcome = 'game_over' and r.start_level = 1) as best_score,
  coalesce(sum(r.shots), 0) as shots, coalesce(sum(r.hits), 0) as hits,
  coalesce(sum(r.crashes), 0) as crashes,
  coalesce(sum(r.shot_deaths), 0) as shot_deaths,
  coalesce(sum(r.duration_ms), 0) as duration_ms,
  coalesce(sum(r.levels_cleared), 0) as levels_cleared,
  round(100.0 * sum(r.hits) / nullif(sum(r.shots), 0), 1) as accuracy
from public.profiles p left join public.classic_runs r on r.player_id = p.id
group by p.id, p.display_name;
grant select on public.classic_leaderboard, public.classic_player_stats to anon, authenticated;
