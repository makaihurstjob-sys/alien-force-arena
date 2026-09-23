/** Bullet Run: host-simulated free-for-all. All dimensions are world pixels. */
export const BULLET_RUN = { width: 1100, height: 760, maxPlayers: 24, tickMs: 1000 / 30, respawnMs: 1800 } as const;
export type Input = { up: boolean; down: boolean; left: boolean; right: boolean; fire: boolean; aimX: number; aimY: number };
export const idleInput: Input = { up: false, down: false, left: false, right: false, fire: false, aimX: 1, aimY: 0 };
export type Obstacle = { x: number; y: number; w: number; h: number };
export const obstacles: Obstacle[] = [
  { x: 215, y: 135, w: 45, h: 160 }, { x: 840, y: 465, w: 45, h: 160 },
  { x: 840, y: 135, w: 45, h: 160 }, { x: 215, y: 465, w: 45, h: 160 },
  { x: 450, y: 90, w: 200, h: 34 }, { x: 450, y: 636, w: 200, h: 34 },
  { x: 430, y: 330, w: 80, h: 32 }, { x: 590, y: 398, w: 80, h: 32 },
  { x: 530, y: 265, w: 40, h: 72 }, { x: 530, y: 423, w: 40, h: 72 },
];
export type Pilot = { id: string; name: string; x: number; y: number; angle: number; kills: number; deaths: number; respawn: number; shield: number; cooldown: number; sniperCooldown: number };
export type Bullet = { id: number; owner: string; x: number; y: number; vx: number; vy: number; life: number; sniper: boolean };
export type State = { tick: number; pilots: Pilot[]; bullets: Bullet[]; nextBullet: number; lastKill: string };
export function weapon(kills: number) {
  // 0–5 kills: 1–5 simultaneous shots; 6–10: rapid fire, 1–5 shots;
  // 11+: keep rapid fire and unlock one piercing sniper shot every 10 seconds.
  if (kills >= 11) return { stage: 'sniper', count: Math.min(5, kills - 5), cooldown: 125, sniper: true } as const;
  if (kills >= 6) return { stage: 'machine gun', count: Math.min(5, kills - 5), cooldown: 125, sniper: false } as const;
  return { stage: 'spread', count: Math.min(5, kills + 1), cooldown: 480, sniper: false } as const;
}
function collides(x: number, y: number, radius = 14) {
  return obstacles.some(o => x + radius > o.x && x - radius < o.x + o.w && y + radius > o.y && y - radius < o.y + o.h);
}
function spawn(index: number) {
  // Twenty-four reserved places around the perimeter, clear of cover.
  const side = Math.floor(index / 6), slot = index % 6;
  const alongX = 115 + slot * 174, alongY = 92 + slot * 115;
  if (side === 0) return { x: alongX, y: 52 };
  if (side === 1) return { x: BULLET_RUN.width - 52, y: alongY };
  if (side === 2) return { x: alongX, y: BULLET_RUN.height - 52 };
  return { x: 52, y: alongY };
}
export function createState(players: { id: string; name: string }[]): State {
  if (players.length < 1 || players.length > BULLET_RUN.maxPlayers || new Set(players.map(p => p.id)).size !== players.length)
    throw new Error('Bullet Run supports 1–24 unique players.');
  return { tick: 0, nextBullet: 0, lastKill: '', bullets: [], pilots: players.map((p, i) => ({ ...p, ...spawn(i), angle: 0, kills: 0, deaths: 0, respawn: 0, shield: 2000, cooldown: 0, sniperCooldown: 0 })) };
}
export function step(state: State, inputs: Record<string, Input>, dt = BULLET_RUN.tickMs) {
  const seconds = Math.min(dt, 100) / 1000;
  state.tick++;
  for (const [index, p] of state.pilots.entries()) {
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.sniperCooldown = Math.max(0, p.sniperCooldown - dt);
    if (p.respawn > 0) {
      p.respawn = Math.max(0, p.respawn - dt);
      if (!p.respawn) { Object.assign(p, spawn(index)); p.shield = 2000; }
      continue;
    }
    p.shield = Math.max(0, p.shield - dt);
    const input = inputs[p.id] ?? idleInput;
    const mx = Number(input.right) - Number(input.left), my = Number(input.down) - Number(input.up);
    const magnitude = Math.hypot(mx, my) || 1;
    const dx = mx / magnitude * 175 * seconds, dy = my / magnitude * 175 * seconds;
    const nx = Math.max(15, Math.min(BULLET_RUN.width - 15, p.x + dx));
    if (!collides(nx, p.y)) p.x = nx;
    const ny = Math.max(15, Math.min(BULLET_RUN.height - 15, p.y + dy));
    if (!collides(p.x, ny)) p.y = ny;
    const ax = Number.isFinite(input.aimX) ? input.aimX : 1;
    const ay = Number.isFinite(input.aimY) ? input.aimY : 0;
    if (Math.hypot(ax, ay) > 0.01) p.angle = Math.atan2(ay, ax);
    if (!input.fire || p.cooldown > 0) continue;
    const level = weapon(p.kills);
    const fire = (angle: number, sniper: boolean) => {
      if (state.bullets.length >= 400) return;
      const speed = sniper ? 1150 : 480;
      state.bullets.push({ id: ++state.nextBullet, owner: p.id, x: p.x + Math.cos(angle) * 19, y: p.y + Math.sin(angle) * 19,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: sniper ? 950 : 1500, sniper });
    };
    for (let i = 0; i < level.count; i++) fire(p.angle + (i - (level.count - 1) / 2) * 0.15, false);
    if (level.sniper && p.sniperCooldown === 0) { fire(p.angle, true); p.sniperCooldown = 10000; }
    p.cooldown = level.cooldown;
  }
  const remaining: Bullet[] = [];
  for (const b of state.bullets) {
    b.life -= dt;
    if (b.life <= 0) continue;
    let consumed = false;
    const distance = Math.hypot(b.vx, b.vy) * seconds;
    const steps = Math.ceil(distance / 7);
    for (let i = 0; i < steps && !consumed; i++) {
      b.x += b.vx * seconds / steps; b.y += b.vy * seconds / steps;
      if (b.x < 0 || b.y < 0 || b.x > BULLET_RUN.width || b.y > BULLET_RUN.height || collides(b.x, b.y, 3)) { consumed = true; break; }
      const target = state.pilots.find(p => p.id !== b.owner && p.respawn === 0 && p.shield === 0 && Math.hypot(p.x - b.x, p.y - b.y) < 14);
      if (target) {
        target.deaths++; target.respawn = BULLET_RUN.respawnMs;
        const shooter = state.pilots.find(p => p.id === b.owner);
        if (shooter) { shooter.kills++; state.lastKill = `${shooter.name} eliminated ${target.name}`; }
        consumed = true;
      }
    }
    if (!consumed) remaining.push(b);
  }
  state.bullets = remaining;
}
