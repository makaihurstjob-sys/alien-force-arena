import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;`);
  await db.exec(fs.readFileSync('drizzle/migrations/0000_alien_force_arena_core_schema.sql', 'utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/202609230000_bullet_run.sql', 'utf8'));
  const host = crypto.randomUUID(), guest = crypto.randomUUID(), stranger = crypto.randomUUID();
  async function call(id, action, code = '') {
    await db.query("select set_config('test.uid', $1, false)", [id]);
    await db.exec('set role authenticated');
    try { return (await db.query('select bullet_lobby($1,$2) result', [action, code])).rows[0].result; }
    finally { await db.exec('reset role'); }
  }
  const room = await call(host, 'create');
  assert.equal((await call(host, 'create')).id, room.id);
  assert.equal((await call(guest, 'join', room.code.toLowerCase())).members.length, 2);
  assert.equal((await call(guest, 'join', room.code)).members.length, 2);
  await assert.rejects(call(stranger, 'get', room.code), /not a member/);
  await assert.rejects(call('', 'create'), /Sign in/);
  for (let i = 0; i < 22; i++) await call(crypto.randomUUID(), 'join', room.code);
  assert.equal((await call(host, 'get', room.code)).members.length, 24);
  await assert.rejects(call(stranger, 'join', room.code), /full/);
  await call(guest, 'leave', room.code);
  assert.equal((await call(stranger, 'join', room.code)).members.length, 24);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from bullet_rooms'), /permission denied/);
  await db.exec('reset role; set role anon');
  await assert.rejects(db.query("select bullet_lobby('create','')"), /permission denied/);
  await db.exec('reset role');
  await call(host, 'leave', room.code);
  assert.equal((await call(stranger, 'get', room.code)).status, 'closed');
  await assert.rejects(call(guest, 'join', room.code), /closed/);
  console.log('PASS local Bullet Run migration: core schema compatibility, create/join/retry/leave, 24-player limit, closed rooms, access controls');
} finally { await db.close(); }
