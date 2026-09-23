// Run with node --experimental-strip-types scripts/test-bullet-run.mjs
import assert from 'node:assert/strict';
import { createState, idleInput, obstacles, step, weapon, BULLET_RUN } from '../src/game/bullet-run.ts';
for (const [kills, stage, count] of [[0,'spread',1],[1,'spread',2],[4,'spread',5],[5,'spread',5],
  [6,'machine gun',1],[10,'machine gun',5],[11,'sniper',5]]) {
  assert.deepEqual([weapon(kills).stage, weapon(kills).count], [stage, count]);
}
const names = Array.from({length:24}, (_,i) => ({id:String(i),name:`Pilot ${i}`}));
const game = createState(names);
assert.equal(game.pilots.length, BULLET_RUN.maxPlayers);
assert.throws(() => createState([...names, {id:'25',name:'Too many'}]));
for (const p of game.pilots) assert(!obstacles.some(o => p.x + 14 > o.x && p.x - 14 < o.x + o.w && p.y + 14 > o.y && p.y - 14 < o.y + o.h));
const a = game.pilots[0], b = game.pilots[1];
a.x = 300; a.y = 100; b.x = 350; b.y = 100; b.shield = 0;
const fire = {...idleInput,fire:true};
step(game,{[a.id]:fire});
for (let i=0;i<5;i++) step(game,{});
assert.equal(a.kills,1); assert.equal(b.deaths,1); assert(b.respawn > 0);
for (let i=0;i<60;i++) step(game,{});
assert.equal(b.respawn,0); assert(b.shield > 0);
a.kills = 6; a.cooldown = 0;
step(game,{[a.id]:fire});
assert.equal(game.bullets.filter(x=>x.owner===a.id).length,1);
a.kills = 11; a.cooldown = 0; game.bullets=[];
step(game,{[a.id]:fire});
assert.equal(game.bullets.filter(x=>x.sniper).length,1);
assert.equal(game.bullets.filter(x=>!x.sniper).length,5);
a.cooldown = 0; game.bullets=[];
step(game,{[a.id]:fire});
assert.equal(game.bullets.filter(x=>x.sniper).length,0);
console.log('Bullet Run engine tests passed');
