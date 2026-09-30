import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';

// Fully isolated, throwaway database. Nothing here touches the real project.
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;`);
for (const file of [
  'drizzle/migrations/0000_alien_force_arena_core_schema.sql',
  'supabase/migrations/202609230000_bullet_run.sql',
  'supabase/migrations/202609270000_bullet_readiness.sql',
  'supabase/migrations/202609290000_hangar_capacity.sql',
  'supabase/migrations/202609300000_shared_game_rooms.sql',
  'supabase/migrations/202609300100_arcade_duel_launch.sql',
]) {
  console.log(`applying ${file} ...`);
  await db.exec(fs.readFileSync(file, 'utf8'));
  console.log('  ok');
}

async function call(uid, action, code = '', mode = 'bullet') {
  await db.query("select set_config('test.uid', $1, false)", [uid]);
  await db.exec('set role authenticated');
  try { return (await db.query('select game_lobby($1,$2,$3) result', [action, code, mode])).rows[0].result; }
  finally { await db.exec('reset role'); }
}

const host = crypto.randomUUID(), guest = crypto.randomUUID(), third = crypto.randomUUID();

console.log('\n--- Arcade room lifecycle ---');
const room = await call(host, 'create', '', 'arcade');
assert.equal(room.mode, 'arcade');
console.log('created arcade room', room.code);

await call(guest, 'join', room.code, 'arcade');
console.log('guest joined');

await assert.rejects(call(third, 'join', room.code, 'arcade'), /full/);
console.log('third player correctly blocked: room is full at 2');

await assert.rejects(call(host, 'launch', room.code, 'arcade'), /must be ready/);
console.log('launch correctly blocked before both players are ready');

await call(host, 'ready', room.code, 'arcade');
await call(guest, 'ready', room.code, 'arcade');
console.log('both players ready');

const launched = await call(host, 'launch', room.code, 'arcade');
assert.equal(launched.phase, 'playing');
assert.ok(launched.match_id);
assert.equal(launched.members.length, 2);
console.log('launch succeeded! phase =', launched.phase, ' match_id =', launched.match_id);

console.log('\n--- Ranked should still be blocked ---');
const rankedHost = crypto.randomUUID(), rankedGuest = crypto.randomUUID();
const rankedRoom = await call(rankedHost, 'create', '', 'ranked');
await call(rankedGuest, 'join', rankedRoom.code, 'ranked');
await call(rankedHost, 'ready', rankedRoom.code, 'ranked');
await call(rankedGuest, 'ready', rankedRoom.code, 'ranked');
await assert.rejects(call(rankedHost, 'launch', rankedRoom.code, 'ranked'), /coming soon/);
console.log('ranked launch correctly still blocked');

console.log('\nAll checks passed. Nothing here touched the real project.');
