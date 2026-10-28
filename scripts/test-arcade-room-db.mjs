import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
grant usage on schema public,auth to authenticated;
create table profiles(id uuid primary key,display_name text);
create table bullet_rooms(id uuid primary key default gen_random_uuid(),code text unique,host_id uuid,status text default 'open',phase text default 'lobby',mode text,match_id uuid,match_roster uuid[] default '{}',created_at timestamptz default now());
create table bullet_members(room_id uuid references bullet_rooms(id),player_id uuid,ready boolean default false,joined_at timestamptz default now(),primary key(room_id,player_id));`);
const migration = fs
  .readdirSync("supabase/migrations")
  .find((f) => f.endsWith("_arcade_four_pilot_teams.sql"));
await db.exec(fs.readFileSync(`supabase/migrations/${migration}`, "utf8"));
const ids = Array.from({ length: 5 }, (_, i) => `00000000-0000-0000-0000-00000000000${i + 1}`);
async function call(index, action, code = "", mode = "arcade") {
  await db.query("select set_config('test.uid',$1,false)", [ids[index]]);
  await db.exec("set role authenticated");
  try {
    return (await db.query("select game_lobby($1,$2,$3) result", [action, code, mode])).rows[0]
      .result;
  } finally {
    await db.exec("reset role");
  }
}
try {
  let room = await call(0, "create");
  for (let i = 1; i < 4; i++) room = await call(i, "join", room.code);
  assert.equal(room.members.length, 4);
  await assert.rejects(call(4, "join", room.code), /Room is full/);
  await assert.rejects(call(0, "mode", room.code, "duel"), /Too many pilots/);
  await assert.rejects(call(0, "launch", room.code), /Every pilot must be ready/);
  for (let i = 0; i < 4; i++) await call(i, "ready", room.code);
  room = await call(0, "launch", room.code);
  assert.equal(room.phase, "playing");
  assert.equal(room.match_roster.length, 4);
  assert.equal(new Set(room.match_roster).size, 4);
  await assert.rejects(call(4, "join", room.code), /Wait for the match/);
  room = await call(2, "return", room.code);
  assert.equal(room.phase, "lobby");
  assert.ok(room.members.every((m) => !m.ready));
  await call(3, "leave", room.code);
  await call(2, "leave", room.code);
  room = await call(0, "mode", room.code, "duel");
  await assert.rejects(call(2, "join", room.code, "duel"), /Room is full/);
  console.log(
    "Arcade room checks passed: capacity, readiness, launch, late join rejection, member return, mode capacity.",
  );
} finally {
  await db.close();
}
