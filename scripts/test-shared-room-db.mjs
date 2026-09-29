import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import http from 'node:http';

const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;`);
for (const file of ['drizzle/migrations/0000_alien_force_arena_core_schema.sql',
  'supabase/migrations/202609230000_bullet_run.sql', 'supabase/migrations/202609270000_bullet_readiness.sql',
  'supabase/migrations/202609290000_hangar_capacity.sql', 'supabase/migrations/202609300000_shared_game_rooms.sql']) {
  await db.exec(fs.readFileSync(file, 'utf8'));
}
async function call(uid, action, code = '', mode = 'bullet') {
  await db.query("select set_config('test.uid', $1, false)", [uid]);
  await db.exec('set role authenticated');
  try { return (await db.query('select game_lobby($1,$2,$3) result', [action, code, mode])).rows[0].result; }
  finally { await db.exec('reset role'); }
}

if (process.argv.includes('--serve')) {
  // Isolated, disposable test database. Only Playwright talks to this loopback server.
  let queue = Promise.resolve();
  http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      queue = queue.then(async () => {
        try {
          const { uid, args } = JSON.parse(body);
          const data = await call(uid ?? '', args.p_action, args.p_code, args.p_mode);
          res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 'P0001', message: error.message }));
        }
      });
    });
  }).listen(5201, '127.0.0.1', () => console.log('READY shared-room test PostgreSQL on loopback 5201'));
} else {
  try {
    const host = crypto.randomUUID(), guest = crypto.randomUUID(), third = crypto.randomUUID();
    const room = await call(host, 'create');
    await call(guest, 'join', room.code);
    await call(host, 'ready', room.code); await call(guest, 'ready', room.code);
    await assert.rejects(call(guest, 'mode', room.code, 'duel'), /Only the host/);
    await assert.rejects(call(third, 'mode', room.code, 'duel'), /not a member/);
    const duel = await call(host, 'mode', room.code, 'duel');
    assert.equal(duel.id, room.id); assert.equal(duel.code, room.code);
    assert.equal(duel.mode, 'duel'); assert.equal(duel.members.length, 2);
    assert.equal(duel.members[0].player_id, host);
    assert.ok(duel.members.every(member => !member.ready));
    await assert.rejects(call(third, 'join', room.code), /full/);
    await assert.rejects(call(host, 'mode', room.code, 'solo'), /Too many/);
    await assert.rejects(call(host, 'ready', room.code, 'bullet'), /changed games/);
    await call(host, 'ready', room.code, 'duel'); await call(guest, 'ready', room.code, 'duel');
    assert.ok((await call(host, 'mode', room.code, 'duel')).members.every(member => member.ready));
    const match = await call(host, 'launch', room.code, 'duel');
    assert.equal(match.phase, 'playing');
    await assert.rejects(call(host, 'mode', room.code, 'bullet'), /Return to the lobby/);
    await call(guest, 'return', room.code, 'duel');
    const bullet = await call(host, 'mode', room.code, 'bullet');
    assert.equal(bullet.code, room.code); assert.ok(bullet.members.every(member => !member.ready));
    await call(third, 'join', room.code);
    await assert.rejects(call(host, 'mode', room.code, 'duel'), /Too many/);
    await call(third, 'leave', room.code); await call(guest, 'leave', room.code);
    for (const mode of ['solo','practice']) {
      assert.equal((await call(host, 'mode', room.code, mode)).code, room.code);
      await call(host, 'ready', room.code, mode);
      assert.equal((await call(host, 'launch', room.code, mode)).phase, 'playing');
      await call(host, 'return', room.code, mode);
    }
    for (const mode of ['ranked','arcade']) {
      await call(host, 'mode', room.code, mode);
      await assert.rejects(call(host, 'launch', room.code, mode), /coming soon/);
    }
    await assert.rejects(call(host, 'mode', room.code, 'invalid'), /Unknown game mode/);
    await call(host, 'leave', room.code);
    await assert.rejects(call(guest, 'join', room.code), /closed/);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from public.bullet_rooms'), /permission denied/);
    await assert.rejects(db.query("select bullet_lobby_legacy('create','')"), /permission denied/);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query("select game_lobby('create','','bullet')"), /permission denied/);
    await db.exec('reset role');
    console.log('PASS shared-room PostgreSQL: same identity/code/roster, host authorization, reset, capacity, stale-mode rejection, launch/return, coming-soon and access rules');
  } finally { await db.close(); }
}
