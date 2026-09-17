-- Optional, self-selected representation. Includes all flag-icons 7.5.0 entries.
alter table public.profiles add column flag_code text;
alter table public.profiles add constraint profiles_flag_code_check
  check (flag_code is null or flag_code in ('af', 'ax', 'al', 'dz', 'as', 'ad', 'ao', 'ai', 'aq', 'ag', 'ar', 'am', 'aw', 'sh-ac', 'asean', 'au', 'at', 'az', 'bs', 'bh', 'bd', 'bb', 'es-pv', 'by', 'be', 'bz', 'bj', 'bm', 'bt', 'bo', 'bq', 'ba', 'bw', 'bv', 'br', 'io', 'bn', 'bg', 'bf', 'bi', 'cv', 'kh', 'cm', 'ca', 'ic', 'es-ct', 'ky', 'cf', 'cefta', 'td', 'cl', 'cn', 'cx', 'cp', 'cc', 'co', 'km', 'ck', 'cr', 'hr', 'cu', 'cw', 'cy', 'cz', 'ci', 'cd', 'dk', 'dg', 'dj', 'dm', 'do', 'eac', 'ec', 'eg', 'sv', 'gb-eng', 'gq', 'er', 'ee', 'sz', 'et', 'eu', 'fk', 'fo', 'fm', 'fj', 'fi', 'fr', 'gf', 'pf', 'tf', 'ga', 'es-ga', 'gm', 'ge', 'de', 'gh', 'gi', 'gr', 'gl', 'gd', 'gp', 'gu', 'gt', 'gg', 'gn', 'gw', 'gy', 'ht', 'hm', 'va', 'hn', 'hk', 'hu', 'is', 'in', 'id', 'ir', 'iq', 'ie', 'im', 'il', 'it', 'jm', 'jp', 'je', 'jo', 'kz', 'ke', 'ki', 'xk', 'kw', 'kg', 'la', 'lv', 'arab', 'lb', 'ls', 'lr', 'ly', 'li', 'lt', 'lu', 'mo', 'mg', 'mw', 'my', 'mv', 'ml', 'mt', 'mh', 'mq', 'mr', 'mu', 'yt', 'mx', 'md', 'mc', 'mn', 'me', 'ms', 'ma', 'mz', 'mm', 'na', 'nr', 'np', 'nl', 'nc', 'nz', 'ni', 'ne', 'ng', 'nu', 'nf', 'kp', 'mk', 'gb-nir', 'mp', 'no', 'om', 'pc', 'pk', 'pw', 'pa', 'pg', 'py', 'pe', 'ph', 'pn', 'pl', 'pt', 'pr', 'qa', 'cg', 'ro', 'ru', 'rw', 're', 'bl', 'sh-hl', 'sh', 'kn', 'lc', 'mf', 'pm', 'vc', 'ws', 'sm', 'st', 'sa', 'gb-sct', 'sn', 'rs', 'sc', 'sl', 'sg', 'sx', 'sk', 'si', 'sb', 'so', 'za', 'gs', 'kr', 'ss', 'es', 'lk', 'ps', 'sd', 'sr', 'sj', 'se', 'ch', 'sy', 'tw', 'tj', 'tz', 'th', 'tl', 'tg', 'tk', 'to', 'tt', 'sh-ta', 'tn', 'tm', 'tc', 'tv', 'tr', 'ug', 'ua', 'ae', 'gb', 'un', 'um', 'us', 'xx', 'uy', 'uz', 'vu', 've', 'vn', 'vg', 'vi', 'gb-wls', 'wf', 'eh', 'ye', 'zm', 'zw'));

create or replace view public.classic_leaderboard with (security_invoker = true) as
with best as (
  select distinct on (r.player_id) r.*
  from public.classic_runs r
  where r.outcome = 'game_over' and r.start_level = 1
  order by r.player_id, r.score desc, r.level desc, r.recorded_at, r.id
)
select row_number() over (order by b.score desc, b.level desc, b.recorded_at, b.id) as rank,
  b.player_id, p.display_name, b.id as run_id, b.score, b.level, b.shots, b.hits,
  b.crashes, b.duration_ms, b.recorded_at,
  round(100.0 * b.hits / nullif(b.shots, 0), 1) as accuracy, p.flag_code
from best b join public.profiles p on p.id = b.player_id;

create or replace view public.classic_player_stats with (security_invoker = true) as
select p.id as player_id, p.display_name, count(r.id) as runs,
  count(r.id) filter (where r.outcome = 'game_over') as completed_runs,
  max(r.score) filter (where r.outcome = 'game_over' and r.start_level = 1) as best_score,
  coalesce(sum(r.shots), 0) as shots, coalesce(sum(r.hits), 0) as hits,
  coalesce(sum(r.crashes), 0) as crashes,
  coalesce(sum(r.shot_deaths), 0) as shot_deaths,
  coalesce(sum(r.duration_ms), 0) as duration_ms,
  coalesce(sum(r.levels_cleared), 0) as levels_cleared,
  round(100.0 * sum(r.hits) / nullif(sum(r.shots), 0), 1) as accuracy, p.flag_code
from public.profiles p left join public.classic_runs r on r.player_id = p.id
group by p.id, p.display_name;
grant select on public.classic_leaderboard, public.classic_player_stats to anon, authenticated;
