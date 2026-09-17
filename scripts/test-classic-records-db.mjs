import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
await db.exec(`create role anon; create role authenticated; create role service_role;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;`);
await db.exec(fs.readFileSync(new URL('../drizzle/migrations/0000_alien_force_arena_core_schema.sql', import.meta.url), 'utf8'));
await db.exec(fs.readFileSync(new URL('../supabase/migrations/20260917175940_classic_run_history.sql', import.meta.url), 'utf8'));
await db.exec(fs.readFileSync(new URL('../supabase/migrations/20260917190000_profile_flags.sql', import.meta.url), 'utf8'));
await db.query('insert into profiles(id, display_name) values ($1,$2),($3,$4)', [alice, 'Alice', bob, 'Bob']);
async function as(id, callback) {
  await db.query("select set_config('test.uid', $1, false)", [id]);
  await db.exec('set role authenticated');
  try { return await callback(); } finally { await db.exec('reset role'); }
}
async function insert(player, overrides = {}) {
  const row = { id: crypto.randomUUID(), player_id: player, outcome: 'game_over', start_level: 1,
    level: 1, score: 90, duration_ms: 1000, shots: 1, hits: 1, crashes: 3,
    shot_deaths: 0, lives_remaining: 0, levels_cleared: 0, ...overrides };
  const keys = Object.keys(row);
  await db.query(`insert into classic_runs (${keys.join(',')}) values (${keys.map((_, i) => '$' + (i + 1)).join(',')}) on conflict (id) do nothing`, Object.values(row));
  return row;
}
try {
  const first = await as(alice, () => insert(alice));
  await as(alice, () => insert(alice, first));
  assert.equal((await db.query('select count(*)::int n from classic_runs')).rows[0].n, 1, 'retry must not duplicate run');
  await as(alice, () => insert(alice, { score: 800, shots: 99, hits: 9 }));
  let stats = (await db.query('select * from classic_player_stats where player_id=$1', [alice])).rows[0];
  assert.equal(Number(stats.accuracy), 10, 'aggregate accuracy must be weighted');
  assert.equal(Number(stats.runs), 2);
  await as(alice, () => insert(alice, { score: 9000, shots: 90, hits: 90, outcome: 'restarted', crashes: 1, lives_remaining: 2 }));
  await as(alice, () => insert(alice, { score: 9500, shots: 95, hits: 95, start_level: 50, level: 50 }));
  await as(bob, () => insert(bob, { score: 800, shots: 9, hits: 9, level: 2, levels_cleared: 1 }));
  const board = (await db.query('select * from classic_leaderboard order by rank')).rows;
  assert.equal(board.length, 2, 'one row per player');
  assert.equal(board[0].player_id, bob, 'level breaks score ties');
  assert.equal(board[1].score, 800, 'restarts and custom starts must not enter board');
  await as(alice, () => db.query('update profiles set flag_code=$1 where id=$2', ['us', alice]));
  assert.equal((await db.query('select flag_code from classic_leaderboard where player_id=$1', [alice])).rows[0].flag_code, 'us');
  assert.equal((await db.query('select flag_code from classic_player_stats where player_id=$1', [alice])).rows[0].flag_code, 'us');
  await as(bob, () => db.query('update profiles set flag_code=$1 where id=$2', ['gb', alice]));
  assert.equal((await db.query('select flag_code from profiles where id=$1', [alice])).rows[0].flag_code, 'us', 'another player cannot change a flag');
  await assert.rejects(as(alice, () => db.query('update profiles set flag_code=$1 where id=$2', ['invalid', alice])), /check constraint/);
  const flags = JSON.parse(fs.readFileSync(new URL('../node_modules/flag-icons/country.json', import.meta.url), 'utf8'));
  for (const flag of flags) await as(alice, () => db.query('update profiles set flag_code=$1 where id=$2', [flag.code, alice]));
  await as(alice, () => db.query('update profiles set flag_code=null where id=$1', [alice]));
  assert.equal((await db.query('select flag_code from classic_player_stats where player_id=$1', [alice])).rows[0].flag_code, null);
  assert.equal((await db.query('select * from classic_runs where player_id=$1', [alice])).rows.length, 4, 'history keeps all runs');
  await assert.rejects(as(alice, () => insert(bob)), /row-level security/);
  await assert.rejects(as(alice, () => insert(alice, { hits: 2 })), /check constraint/);
  await assert.rejects(as(alice, () => insert(alice, { score: 100000 })), /check constraint/);
  await assert.rejects(as(alice, () => insert(alice, { crashes: 2 })), /check constraint/);
  await assert.rejects(as(alice, () => insert(alice, { recorded_at: new Date().toISOString() })), /permission denied/);
  await assert.rejects(as(alice, () => db.query('update classic_runs set score=0')), /permission denied/);
  await assert.rejects(as(alice, () => db.query('delete from classic_runs')), /permission denied/);
  await db.exec('set role anon');
  assert.equal((await db.query('select * from classic_leaderboard')).rows.length, 2);
  assert.equal((await db.query('select * from classic_player_stats')).rows.length, 2);
  assert.equal((await db.query('select * from classic_runs')).rows.length, 5);
  await assert.rejects(insert(alice), /permission denied/);
  await db.exec('reset role');
  console.log('PASS: deduplication, weighted accuracy, best-run selection, custom/restart exclusion, public history, ownership, immutability, constraints, public read-only access; all flag values, flag ownership and removal, public flags.');
} finally { await db.close(); }
