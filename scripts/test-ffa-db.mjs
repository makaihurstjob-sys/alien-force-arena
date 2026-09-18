import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
create schema auth; create function auth.uid() returns uuid language sql stable as $$
select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated;`);
for (const f of ['drizzle/migrations/0000_alien_force_arena_core_schema.sql',
'supabase/migrations/202609160001_classic_lobbies.sql',
'supabase/migrations/202609171653_ranked_seats_and_spectators.sql',
'supabase/migrations/20260917200000_ffa_mode.sql',
'supabase/migrations/20260917200100_ffa_rooms.sql']) await db.exec(fs.readFileSync(f, 'utf8'));
const ids = Array.from({length: 6}, () => crypto.randomUUID());
async function as(i, sql, args = []) {
 await db.query("select set_config('test.uid', $1, false)", [ids[i]]);
 await db.exec('set role authenticated');
 try { return await db.query(sql, args); } finally { await db.exec('reset role'); }
}
const call = async (i, action, code = '', mode) => (await as(i,
 mode ? 'select classic_lobby($1,$2,false,$3) room' : 'select classic_lobby($1,$2,false) room',
 mode ? [action, code, mode] : [action, code])).rows[0].room;
try {
 const room = await call(0, 'create', '', 'ffa');
 assert.equal(room.mode, 'ffa'); assert.equal(room.max_players, 4);
 assert.equal((await call(0, 'create', '', 'ffa')).id, room.id);
 await assert.rejects(call(0, 'create', '', '1v1'), /Leave your current room/);
 for (let i=1; i<4; i++) await call(i, 'join', room.code);
 const full = await call(0, 'get', room.code);
 assert.deepEqual(full.members.map(m=>m.team), [0,1,2,3]);
 await assert.rejects(call(4, 'join', room.code), /full/);
 await assert.rejects(call(4, 'get', room.code), /not part/);
 await assert.rejects(call(4, 'ready', room.code), /not part/);
 await call(2, 'leave', room.code); await call(4, 'join', room.code);
 assert.equal((await call(4, 'get', room.code)).members.find(m=>m.player_id===ids[4]).team, 2);
 await assert.rejects(as(4, 'update room_members set team=0'), /permission denied/);
 await call(0, 'leave', room.code);
 await assert.rejects(call(5, 'join', room.code), /closed/);
 const duel = await call(0, 'create'); assert.equal(duel.mode,'1v1'); assert.equal(duel.max_players,2);
 await assert.rejects(call(5, 'create', '', 'invalid'), /Unknown game mode/);
 console.log('FFA database checks passed: capacity, unique seats, retries, permissions, leave/rejoin, host closure, and legacy 1v1 RPC.');
} finally { await db.close(); }
