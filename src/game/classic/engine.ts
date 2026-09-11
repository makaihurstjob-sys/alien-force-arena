// Video-informed geometry; timing and combat values are provisional.
export const CLASSIC = {
  cells: 10,
  spacing: 40,
  margin: 12,
  block: 20,
  size: 424,
  playerSpeed: 110,
  enemySpeed: 55,
  bulletSpeed: 250,
  killScore: 100,
  levelBonus: 500,
  shotCost: 10,
  lives: 3,
  invulnerability: 2,
  transition: 1.5,
};
export type Direction = "up" | "down" | "left" | "right";
export const vectors: Record<Direction, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};
export type Actor = { id: number; x: number; y: number; direction: Direction };
export type Enemy = Actor & { canFire?: boolean; lastDecision?: string };
type Shot = Actor & { owner: number };
export type ClassicState = {
  player: Actor;
  enemies: Enemy[];
  shots: Shot[];
  score: number;
  lives: number;
  level: number;
  phase: "playing" | "level_clear" | "game_over";
  timer: number;
  invulnerable: number;
  elapsed: number;
  shotsFired: number;
  hits: number;
};
export type ClassicInput = {
  direction: Direction | null;
  fire: boolean;
  reverse?: boolean;
};
const lane = (n: number) => CLASSIC.margin + n * CLASSIC.spacing;
const nearest = (v: number) => lane(Math.round((v - CLASSIC.margin) / CLASSIC.spacing));
function wave(level: number): Enemy[] {
  return Array.from({ length: Math.min(10, 5 + level) }, (_, i) => ({
    id: i + 1,
    x: lane(i),
    y: lane(0),
    direction: "down",
    // Firing begins after level 1; the exact original shooter mix is unverified.
    canFire: i < Math.min(10, Math.max(0, level - 1)),
  }));
}
export function createClassic(): ClassicState {
  return {
    player: { id: 0, x: lane(10), y: lane(10), direction: "left" },
    enemies: wave(1),
    shots: [],
    score: 0,
    lives: CLASSIC.lives,
    level: 1,
    phase: "playing",
    timer: 0,
    invulnerable: CLASSIC.invulnerability,
    elapsed: 0,
    shotsFired: 0,
    hits: 0,
  };
}
// Turns are accepted only at lane intersections; held input is buffered until then.
export function moveActor(a: Actor, wanted: Direction | null, distance: number) {
  for (let remaining = distance; remaining > 0; remaining -= 1) {
    if (wanted) {
      const [wx] = vectors[wanted];
      const perpendicular = wx ? a.y : a.x;
      if (Math.abs(perpendicular - nearest(perpendicular)) < 0.6) {
        if (wx) a.y = nearest(a.y);
        else a.x = nearest(a.x);
        a.direction = wanted;
      }
    }
    const [dx, dy] = vectors[a.direction];
    const step = Math.min(1, remaining);
    a.x = Math.max(lane(0), Math.min(lane(10), a.x + dx * step));
    a.y = Math.max(lane(0), Math.min(lane(10), a.y + dy * step));
  }
}
function fire(s: ClassicState, actor: Actor) {
  if (s.shots.some((b) => b.owner === actor.id)) return;
  s.shots.push({ ...actor, owner: actor.id });
  if (actor.id === 0) {
    s.shotsFired++;
    s.score = Math.max(0, s.score - CLASSIC.shotCost);
  }
}
function loseLife(s: ClassicState) {
  if (s.invulnerable > 0) return;
  s.lives--;
  s.shots = [];
  if (s.lives === 0) {
    s.phase = "game_over";
    return;
  }
  s.player = { id: 0, x: lane(10), y: lane(10), direction: "left" };
  s.enemies = wave(s.level);
  s.invulnerable = CLASSIC.invulnerability;
}
export function tickClassic(
  s: ClassicState,
  input: ClassicInput,
  dt = 1 / 60,
  random: () => number = Math.random,
) {
  if (s.phase === "game_over") return;
  if (s.phase === "level_clear") {
    s.timer -= dt;
    if (s.timer <= 0) {
      s.level++;
      s.enemies = wave(s.level);
      s.shots = [];
      s.phase = "playing";
      s.invulnerable = CLASSIC.invulnerability;
    }
    return;
  }
  s.elapsed += dt;
  s.invulnerable = Math.max(0, s.invulnerable - dt);
  if (input.reverse) {
    const opposite: Record<Direction, Direction> = {
      up: "down",
      down: "up",
      left: "right",
      right: "left",
    };
    s.player.direction = opposite[s.player.direction];
  }
  moveActor(s.player, input.reverse ? null : input.direction, CLASSIC.playerSpeed * dt);
  if (input.fire) fire(s, s.player);
  for (const enemy of s.enemies) {
    const atCrossing =
      Math.abs(enemy.x - nearest(enemy.x)) < 1 && Math.abs(enemy.y - nearest(enemy.y)) < 1;
    let turn: Direction | null = null;
    if (atCrossing) {
      const crossing = `${nearest(enemy.x)},${nearest(enemy.y)}`;
      if (enemy.lastDecision !== crossing) {
        enemy.lastDecision = crossing;
        const legal = (Object.keys(vectors) as Direction[]).filter((direction) => {
          const [dx, dy] = vectors[direction];
          return (
            enemy.x + dx >= lane(0) &&
            enemy.x + dx <= lane(CLASSIC.cells) &&
            enemy.y + dy >= lane(0) &&
            enemy.y + dy <= lane(CLASSIC.cells)
          );
        });
        // Progressive pursuit is an approximation; original probabilities are unverified.
        const pursuit = Math.min(0.8, 0.1 + (s.level - 1) * 0.07);
        const chasing = legal.filter((direction) => {
          const [dx, dy] = vectors[direction];
          return dx * (s.player.x - enemy.x) + dy * (s.player.y - enemy.y) > 0;
        });
        const choices = random() < pursuit && chasing.length ? chasing : legal;
        turn = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))] ?? null;
      }
    } else {
      delete enemy.lastDecision;
    }
    moveActor(enemy, turn, (CLASSIC.enemySpeed + Math.min(s.level - 1, 10) * 4) * dt);
    if (s.level > 1 && enemy.canFire && random() < dt * 0.35) fire(s, enemy);
  }
  // Substeps keep fast shots from skipping a ship between simulation ticks.
  const survivors: Shot[] = [];
  let playerHit = false;
  for (const b of s.shots) {
    let consumed = false;
    const [dx, dy] = vectors[b.direction];
    for (let remaining = CLASSIC.bulletSpeed * dt; remaining > 0 && !consumed; remaining -= 2) {
      b.x += dx * Math.min(2, remaining);
      b.y += dy * Math.min(2, remaining);
      consumed = b.x < 0 || b.y < 0 || b.x > CLASSIC.size || b.y > CLASSIC.size;
      if (consumed) break;
      if (b.owner === 0) {
        const target = s.enemies.find((e) => Math.hypot(e.x - b.x, e.y - b.y) < 9);
        if (target) {
          s.enemies = s.enemies.filter((e) => e.id !== target.id);
          s.score += CLASSIC.killScore;
          s.hits++;
          consumed = true;
        }
      } else if (Math.hypot(s.player.x - b.x, s.player.y - b.y) < 9) {
        playerHit = true;
        consumed = true;
      }
    }
    if (!consumed) survivors.push(b);
  }
  s.shots = survivors;
  if (playerHit || s.enemies.some((e) => Math.hypot(e.x - s.player.x, e.y - s.player.y) < 12))
    loseLife(s);
  if (s.phase === "playing" && s.enemies.length === 0) {
    s.score += CLASSIC.levelBonus * s.level;
    s.phase = "level_clear";
    s.timer = CLASSIC.transition;
    s.shots = [];
  }
}
