import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import assert from "node:assert/strict";

// Fully isolated, throwaway database. Nothing here touches the real project.
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
  create schema auth; create table auth.identities(user_id uuid, provider text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;`);
for (const file of [
  "drizzle/migrations/0000_alien_force_arena_core_schema.sql",
  "supabase/migrations/202609230000_bullet_run.sql",
  "supabase/migrations/202609270000_bullet_readiness.sql",
  "supabase/migrations/202609290000_hangar_capacity.sql",
  "supabase/migrations/202609300000_shared_game_rooms.sql",
  "supabase/migrations/202609300100_arcade_duel_launch.sql",
  "supabase/migrations/202610010000_ranked_service.sql",
  "supabase/migrations/20261003214055_lobby_room_switch.sql",
]) {
  console.log(`applying ${file} ...`);
  await db.exec(fs.readFileSync(file, "utf8"));
  console.log("  ok");
}

async function call(uid, action, code = "", mode = "bullet") {
  await db.query("select set_config('test.uid', $1, false)", [uid]);
  await db.exec("set role authenticated");
  try {
    return (await db.query("select game_lobby($1,$2,$3) result", [action, code, mode])).rows[0]
      .result;
  } finally {
    await db.exec("reset role");
  }
}

const host = crypto.randomUUID(),
  guest = crypto.randomUUID(),
  third = crypto.randomUUID();

console.log("\n--- Arcade room lifecycle ---");
const room = await call(host, "create", "", "arcade");
assert.equal(room.mode, "arcade");
console.log("created arcade room", room.code);

await call(guest, "join", room.code, "arcade");
console.log("guest joined");

await assert.rejects(call(third, "join", room.code, "arcade"), /full/);
console.log("third player correctly blocked: room is full at 2");

await assert.rejects(call(host, "launch", room.code, "arcade"), /must be ready/);
console.log("launch correctly blocked before both players are ready");

await call(host, "ready", room.code, "arcade");
await call(guest, "ready", room.code, "arcade");
console.log("both players ready");

const launched = await call(host, "launch", room.code, "arcade");
assert.equal(launched.phase, "playing");
assert.ok(launched.match_id);
assert.equal(launched.members.length, 2);
console.log("launch succeeded! phase =", launched.phase, " match_id =", launched.match_id);

console.log("\n--- Ranked should still be blocked ---");
const rankedHost = crypto.randomUUID(),
  rankedGuest = crypto.randomUUID();
const rankedRoom = await call(rankedHost, "create", "", "ranked");
await call(rankedGuest, "join", rankedRoom.code, "ranked");
await call(rankedHost, "ready", rankedRoom.code, "ranked");
await call(rankedGuest, "ready", rankedRoom.code, "ranked");
await assert.rejects(call(rankedHost, "launch", rankedRoom.code, "ranked"), /coming soon/);
console.log("ranked launch correctly still blocked");

// Room switches roll back the old membership and host closure on failure.
async function switchRoom(uid, code) {
  await db.query("select set_config('test.uid', $1, false)", [uid]);
  await db.exec("set role authenticated");
  try {
    return (await db.query("select game_lobby_join_room($1) result", [code])).rows[0].result;
  } finally {
    await db.exec("reset role");
  }
}
const mover = crypto.randomUUID(),
  targetHost = crypto.randomUUID();
const old = await call(mover, "create", "", "solo");
await assert.rejects(switchRoom(mover, "XXXXXX"), /not found/);
assert.equal((await call(mover, "get", old.code)).status, "open");
await assert.rejects(switchRoom(mover, rankedRoom.code), /full/);
assert.equal((await call(mover, "get", old.code)).status, "open");
const target = await call(targetHost, "create", "", "duel");
const switched = await switchRoom(mover, target.code);
assert.equal(switched.code, target.code);
assert.equal(switched.members.length, 2);
assert.equal(
  (await db.query("select status from bullet_rooms where id=$1", [old.id])).rows[0].status,
  "closed",
);
assert.equal(
  (await db.query("select count(*)::int n from bullet_members where player_id=$1", [mover])).rows[0]
    .n,
  1,
);
assert.equal((await switchRoom(mover, target.code)).members.length, 2);
console.log("Atomic room-switch rollback, membership, and repeat-join checks passed");

console.log("\nAll checks passed. Nothing here touched the real project.");
