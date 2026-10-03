import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const db = new PGlite();
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
await db.exec(`create role anon; create role authenticated; create role service_role;
 create schema auth; create table auth.identities(user_id uuid, provider text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated,service_role;`);
for (const file of ['drizzle/migrations/0000_alien_force_arena_core_schema.sql',
 'drizzle/migrations/0001_ratings_functions_and_demo_seed.sql',
 'supabase/migrations/202610010000_ranked_service.sql']) await db.exec(fs.readFileSync(file,'utf8'));
async function call(uid, sql, params = [], role = 'authenticated') {
 await db.query("select set_config('test.uid',$1,false)",[uid ?? '']);
 await db.exec(`set role ${role}`);
 try { return (await db.query(sql,params)).rows[0]?.result; }
 finally { await db.exec('reset role'); }
}
const join = (uid, rounds = false) => call(uid,'select ranked_queue_join($1) result',[rounds]);
const poll = uid => call(uid,'select ranked_queue_poll() result');
const leave = uid => call(uid,'select ranked_queue_leave() result');
const start = mid => call(null,'select ranked_match_start($1,$2) result',[mid,'test-server'],'service_role');
const settle = (mid,winner=0,score=0,disconnect=false) => call(null,'select ranked_settle($1,$2,$3::smallint,$4,$5) result',[mid,'test-server',winner,score,disconnect],'service_role');
async function player(rating=0) {
 const id=crypto.randomUUID();
 await db.query("insert into auth.identities values($1,'discord')",[id]);
 await join(id); await leave(id);
 await db.query('update ranked_players set rating=$2,peak=$2 where player_id=$1',[id,rating]);
 return id;
}
async function clear() {
 await db.exec("update matchmaking_queue set status='cancelled' where status='waiting'; update matches set status='abandoned' where status in ('pending','live'); update ranked_players set active_match_id=null");
}
async function pair(a,b,rounds=true) { await join(a,rounds); return (await join(b,rounds)).match_id; }
try {
 await assert.rejects(join(null),/Sign in/);
 await assert.rejects(join(crypto.randomUUID()),/Discord/);
 const a=await player(),b=await player(),c=await player(301);
 check((await join(a,true)).status,'waiting');
 check((await join(b)).status,'waiting');
 check((await poll(a)).status,'waiting');
 await db.query("update matchmaking_queue set enqueued_at=clock_timestamp()-interval '9 seconds' where player_id=$1 and status='waiting'",[a]);
 check((await poll(b)).status,'waiting');
 await db.query("update matchmaking_queue set enqueued_at=clock_timestamp()-interval '10 seconds' where player_id=$1 and status='waiting'",[a]);
 const fallback=await poll(b); check(fallback.status,'matched');
 check((await start(fallback.match_id)).format,'1a');
 check((await poll(a)).match_id,fallback.match_id);
 check((await leave(a)).status,'matched');
 await assert.rejects(call(a,'select ranked_settle($1,$2,0::smallint,0,false)',[fallback.match_id,'test-server']),/permission denied/);
 await assert.rejects(call(a,'select ranked_match_start($1,$2)',[fallback.match_id,'fake']),/permission denied/);
 await assert.rejects(call(a,'select * from ranked_matches'),/permission denied/);
 await assert.rejects(call(a,'update ranked_players set rating=9999'),/permission denied/);
 await assert.rejects(call(a,'update matchmaking_queue set rating=9999'),/permission denied/);
 await assert.rejects(call(a,'select ranked_queue($1,false)',['join']),/permission denied/);
 await assert.rejects(call(null,'select ranked_queue_poll()',[],'anon'),/permission denied/);
 const result=await settle(fallback.match_id);
 check(await settle(fallback.match_id),result);
 await assert.rejects(settle(fallback.match_id,1),/Conflicting/);
 const rows=(await db.query('select rating,wins,losses from ranked_players where player_id in ($1,$2) order by rating',[a,b])).rows;
 check(rows,[{rating:0,wins:0,losses:1},{rating:35,wins:1,losses:0}]);
 await clear();
 await join(a,true); check((await join(c,true)).status,'waiting');
 const opted=await join(b,true); check(opted.status,'matched'); check((await start(opted.match_id)).format,'1b');
 await assert.rejects(settle(opted.match_id,null),/Invalid ranked result/);
 await assert.rejects(settle(opted.match_id,0,4),/Invalid ranked result/);
 await assert.rejects(db.query("update matches set status='completed',winning_team=0,ended_at=clock_timestamp() where id=$1",[opted.match_id]),/Use ranked_settle/);
 await assert.rejects(call(null,'select complete_match($1,0::smallint)',[opted.match_id],'service_role'),/Use ranked_settle|rating_range/);
 await settle(opted.match_id,0,3);
 await clear();
 // Nearest eligible skill wins, and preferred rounds outrank stocks fallback.
 const d=await player(100),e=await player(200),f=await player(110);
 await join(d); await join(e,true);
 await db.query("update matchmaking_queue set enqueued_at=clock_timestamp()-interval '11 seconds' where player_id=$1 and status='waiting'",[e]);
 const preferred=await join(f,true);
 check((await db.query('select player_id from match_participants where match_id=$1 order by player_id',[preferred.match_id])).rows.map(x=>x.player_id).sort(),[e,f].sort());
 await clear();
 await join(d,true); await join(e,false);
 await db.query("update matchmaking_queue set heartbeat_at=clock_timestamp()-interval '31 seconds' where player_id=$1 and status='waiting'",[d]);
 check((await poll(e)).status,'waiting'); check((await poll(d)).status,'idle');
 await clear();
 const pending=await pair(d,e); check((await poll(d)).match_id,pending);
 await assert.rejects(settle(pending),/Invalid ranked server/);
 await db.query("update ranked_matches set assignment_expires_at=clock_timestamp()-interval '1 second' where match_id=$1",[pending]);
 check((await poll(d)).status,'idle'); await assert.rejects(start(pending),/unavailable/);
 // Compare SQL settlement to the approved formula across boundaries and scores.
 for (const [winnerRating,loserRating,score] of [[0,0,0],[100,105,0],[100,100,0],[1490,1505,0],[1600,1500,3],[0,300,0],[300,0,3],[110,110,2]]) {
  await clear(); const w=await player(winnerRating),l=await player(loserRating);
  const mid=await pair(l,w); await start(mid); await settle(mid,0,score);
  const amount=Math.round(Math.max(21,Math.min(39,30+4.5*Math.max(-1,Math.min(1,(loserRating-winnerRating)/300))+4.5*(1-2*score/3))));
  const floor=Math.floor(loserRating/100)*100;
  const after=Math.max(0,loserRating<1500 && loserRating>floor && loserRating-amount<=floor ? floor : loserRating-amount);
  check((await db.query('select rating from ranked_players where player_id=$1',[w])).rows[0].rating,winnerRating+amount);
  check((await db.query('select rating from ranked_players where player_id=$1',[l])).rows[0].rating,after);
 }
 await clear(); const w=await player(),l=await player();
 for (let n=1;n<=5;n++) {
  const mid=await pair(l,w); await start(mid); await settle(mid,0,0,true);
  const p=(await db.query('select disconnect_count,extract(epoch from (cooldown_until-last_disconnect_at))::integer seconds from ranked_players where player_id=$1',[l])).rows[0];
  check(p.disconnect_count,n); check(p.seconds,n<3?null:[300,900,1800][n-3]);
  if(n>=3) { await assert.rejects(join(l),/cooldown/); await db.query('update ranked_players set cooldown_until=null where player_id=$1',[l]); }
 }
 const normal=await pair(l,w); await start(normal); await settle(normal,0,3);
 check((await db.query('select disconnect_count from ranked_players where player_id=$1',[l])).rows[0].disconnect_count,0);
 // Stocks draw and repeated joins.
 await clear(); await join(a,true);
 const before=(await db.query("select enqueued_at,prefer_rounds from matchmaking_queue where player_id=$1 and status='waiting'",[a])).rows[0];
 await join(a,false);
 check((await db.query("select enqueued_at,prefer_rounds from matchmaking_queue where player_id=$1 and status='waiting'",[a])).rows[0],before);
 await clear(); const mid=await pair(a,b); await db.query("update ranked_matches set format='1a' where match_id=$1",[mid]); await start(mid);
 await settle(mid,null); check((await db.query('select count(*)::int n from match_participants where match_id=$1 and outcome=\'draw\' and rating_after=rating_before',[mid])).rows[0].n,2);
 // Seed PostgreSQL's random source and verify both sides of the 80/20 boundary.
 const formats=new Set();
 for(const seed of [-0.9,-0.5,0,0.1,0.4,0.7,0.9]) {
  await clear(); await db.query('select setseed($1)',[seed]);
  const roll=(await db.query('select random() roll')).rows[0].roll;
  await db.query('select setseed($1)',[seed]);
  const randomMatch=await pair(a,b,false);
  const format=(await start(randomMatch)).format;
  formats.add(format); check(format,roll<0.8?'1a':'1b');
 }
 check([...formats].sort(),['1a','1b']);
 console.log(`PASS Ranked PostgreSQL: ${checks} assertions plus authorization and invalid-result rejection checks`);
} finally { await db.close(); }
