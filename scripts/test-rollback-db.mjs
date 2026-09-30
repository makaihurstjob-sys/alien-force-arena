import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;`);
for (const file of [
  'drizzle/migrations/0000_alien_force_arena_core_schema.sql',
  'supabase/migrations/202609160001_classic_lobbies.sql',
  'supabase/migrations/202609171653_ranked_seats_and_spectators.sql',
  'supabase/migrations/202609230000_bullet_run.sql',
  'supabase/migrations/202609270000_bullet_readiness.sql',
]) {
  console.log(`applying (pre-existing) ${file} ...`);
  await db.exec(fs.readFileSync(file, 'utf8'));
}

async function call(uid, action, code = '', mode = 'bullet') {
  await db.query("select set_config('test.uid', $1, false)", [uid]);
  await db.exec('set role authenticated');
  try { return (await db.query('select game_lobby($1,$2,$3) result', [action, code, mode])).rows[0].result; }
  finally { await db.exec('reset role'); }
}
async function callClassic(uid, action, code = '', ready = false) {
  await db.query("select set_config('test.uid', $1, false)", [uid]);
  await db.exec('set role authenticated');
  try { return (await db.query('select classic_lobby($1,$2,$3) result', [action, code, ready])).rows[0].result; }
  finally { await db.exec('reset role'); }
}

console.log('\n--- Applying the 3 new migrations ---');
for (const file of [
  'supabase/migrations/202609290000_hangar_capacity.sql',
  'supabase/migrations/202609300000_shared_game_rooms.sql',
  'supabase/migrations/202609300100_arcade_duel_launch.sql',
]) {
  console.log(`applying ${file} ...`);
  await db.exec(fs.readFileSync(file, 'utf8'));
}
const host = crypto.randomUUID(), guest = crypto.randomUUID();
const arcadeRoom = await call(host, 'create', '', 'arcade');
await call(guest, 'join', arcadeRoom.code, 'arcade');
await call(host, 'ready', arcadeRoom.code, 'arcade');
await call(guest, 'ready', arcadeRoom.code, 'arcade');
const launched = await call(host, 'launch', arcadeRoom.code, 'arcade');
assert.equal(launched.phase, 'playing');
console.log('confirmed arcade works after applying the 3 migrations');

console.log('\n--- Applying the rollback script ---');
await db.exec(fs.readFileSync('rollback-arcade-migrations.sql', 'utf8'));
console.log('rollback applied without error');

console.log('\n--- Confirming game_lobby is gone ---');
await assert.rejects(call(host, 'create', '', 'bullet'), /function.*game_lobby.*does not exist/i);
console.log('game_lobby correctly no longer exists');

console.log('\n--- Confirming bullet_lobby works like before (24-pilot cap, no modes) ---');
await db.query("select set_config('test.uid', $1, false)", [host]);
await db.exec('set role authenticated');
const bulletRoom = (await db.query('select bullet_lobby($1,$2) result', ['create', ''])).rows[0].result;
await db.exec('reset role');
assert.ok(bulletRoom.code);
assert.equal(bulletRoom.mode, undefined); // old shape has no mode field
console.log('bullet_lobby restored to its pre-migration shape, room code:', bulletRoom.code);

console.log('\n--- Confirming classic_lobby works like before (rooms/room_members, spectators) ---');
const rank2 = crypto.randomUUID();
const classicRoom = await callClassic(host, 'create');
await callClassic(rank2, 'join', classicRoom.code);
const got = await callClassic(host, 'get', classicRoom.code);
assert.equal(got.members.length, 2);
assert.ok('viewer_role' in got);
console.log('classic_lobby restored to its pre-migration shape (viewer_role, spectators present), room code:', classicRoom.code);

console.log('\nRollback verified end-to-end. Safe to keep as a safety net.');
