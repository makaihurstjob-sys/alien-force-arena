// Video-informed geometry; timing and combat values are provisional.
export const CLASSIC = {
  cells: 10,
  enemyCount: 10,
  spacing: 40,
  margin: 12,
  block: 20,
  size: 424,
  playerSpeed: 38,
  enemySpeed: 28,
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
export type Enemy = Actor & { canFire?: boolean; health?: number; maxHealth?: number; lastDecision?: string };
type Shot = Actor & { owner: number };
export type ClassicState = {
  player: Actor;
  playerMoving: boolean;
  queuedDirection?: Direction | null;
  enemies: Enemy[];
  shots: Shot[];
  score: number;
  lives: number;
  level: number;
  phase: "waiting" | "playing" | "level_clear" | "game_over";
  waitingReason: "start" | "next_level" | "respawn";
  awaitDirectionRelease: boolean;
  timer: number;
  invulnerable: number;
  elapsed: number;
  shotsFired: number;
  hits: number;
  startLevel: number;
  crashes: number;
  shotDeaths: number;
  levelsCleared: number;
};
export type ClassicInput = {
  direction: Direction | null;
  fire: boolean;
  reverse?: boolean;
};
const lane = (n: number) => CLASSIC.margin + n * CLASSIC.spacing;
const nearest = (v: number) => lane(Math.round((v - CLASSIC.margin) / CLASSIC.spacing));
/** Each level raises speed and fire rate. Every tenth level adds one armor hit
 * to a randomly chosen drone, cycling through all ten before adding a third. */
export function classicDifficulty(level: number) {
  return {
    playerSpeed: CLASSIC.playerSpeed + 7 * Math.log2(level),
    enemySpeed: CLASSIC.enemySpeed + 6 * Math.log2(level),
    shooters: level === 1 ? 0 : Math.min(CLASSIC.enemyCount, 1 + Math.floor(level / 10)),
    fireRate: level === 1 ? 0 : 0.1 + 0.025 * Math.sqrt(level - 1),
    armorHits: Math.floor(level / 10),
  };
}
function shuffledIds(random: () => number) {
  const ids = Array.from({ length: CLASSIC.enemyCount }, (_, i) => i + 1);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  }
  return ids;
}
function wave(level: number, random: () => number): Enemy[] {
  const { shooters, armorHits } = classicDifficulty(level);
  const shooterIds = shooters ? new Set(shuffledIds(random).slice(0, shooters)) : new Set<number>();
  const armorIds = armorHits ? shuffledIds(random) : [];
  const health = new Map<number, number>(armorIds.map((id, index): [number, number] =>
    [id, 1 + Math.floor(armorHits / CLASSIC.enemyCount) + Number(index < armorHits % CLASSIC.enemyCount)]));
  return Array.from({ length: CLASSIC.enemyCount }, (_, i) => ({
    id: i + 1,
    x: lane(i),
    y: lane(0),
    direction: "down",
    canFire: shooterIds.has(i + 1),
    health: health.get(i + 1) ?? 1,
    maxHealth: health.get(i + 1) ?? 1,
  }));
}
export function createClassic(level = 1, random: () => number = Math.random): ClassicState {
  if (!Number.isInteger(level) || level < 1 || level > 999)
    throw new RangeError("Level must be between 1 and 999");
  return {
    player: { id: 0, x: lane(10), y: lane(10), direction: "left" },
    playerMoving: false,
    queuedDirection: null,
    enemies: wave(level, random),
    shots: [],
    score: 0,
    lives: CLASSIC.lives,
    level,
    phase: "waiting",
    waitingReason: "start",
    awaitDirectionRelease: false,
    timer: 0,
    invulnerable: CLASSIC.invulnerability,
    elapsed: 0,
    shotsFired: 0,
    hits: 0,
    startLevel: level,
    crashes: 0,
    shotDeaths: 0,
    levelsCleared: 0,
  };
}
// Turns are accepted only at lane intersections; held input is buffered until then.
export function moveActor(a: Actor, wanted: Direction | null, distance: number) {
  let turned = false;
  for (let remaining = distance; remaining > 0; remaining -= 1) {
    if (wanted) {
      const [wx] = vectors[wanted];
      const perpendicular = wx ? a.y : a.x;
      if (Math.abs(perpendicular - nearest(perpendicular)) < 0.6) {
        if (wx) a.y = nearest(a.y);
        else a.x = nearest(a.x);
        a.direction = wanted;
        turned = true;
      }
    }
    const [dx, dy] = vectors[a.direction];
    const step = Math.min(1, remaining);
    a.x = Math.max(lane(0), Math.min(lane(10), a.x + dx * step));
    a.y = Math.max(lane(0), Math.min(lane(10), a.y + dy * step));
  }
  return turned;
}
function fire(s: ClassicState, actor: Actor) {
  if (s.shots.some((b) => b.owner === actor.id)) return;
  s.shots.push({ ...actor, owner: actor.id });
  if (actor.id === 0) {
    s.shotsFired++;
    s.score = Math.max(0, s.score - CLASSIC.shotCost);
  }
}
function loseLife(s: ClassicState, cause: "crash" | "shot", directionHeld: boolean) {
  if (s.invulnerable > 0) return;
  if (cause === "crash") s.crashes++;
  else s.shotDeaths++;
  s.lives--;
  s.shots = [];
  if (s.lives === 0) {
    s.phase = "game_over";
    return;
  }
  // Choose the closest clear crossing to the center. The damaged drones stay
  // exactly where they were; brief invulnerability protects the resumed run.
  const crossings = Array.from({ length: 121 }, (_, i) => ({ x: lane(i % 11), y: lane(Math.floor(i / 11)) }));
  const safe = crossings.filter(({ x, y }) => s.enemies.every(e => Math.hypot(e.x - x, e.y - y) >= 28));
  const spawn = (safe.length ? safe : crossings).sort((a, b) =>
    Math.hypot(a.x - lane(5), a.y - lane(5)) - Math.hypot(b.x - lane(5), b.y - lane(5)))[0]!;
  s.player = { id: 0, ...spawn, direction: "left" };
  s.playerMoving = false;
  s.queuedDirection = null;
  s.phase = "waiting";
  s.waitingReason = "respawn";
  s.awaitDirectionRelease = directionHeld;
  s.timer = 0;
  s.invulnerable = CLASSIC.invulnerability;
}
export function tickClassic(
  s: ClassicState,
  input: ClassicInput,
  dt = 1 / 60,
  random: () => number = Math.random,
) {
  if (s.phase === "game_over") return;
  if (s.phase === "waiting") {
    if (s.awaitDirectionRelease) {
      if (!input.direction) s.awaitDirectionRelease = false;
      return;
    }
    if (!input.direction) return;
    s.phase = "playing";
  }
  if (s.phase === "level_clear") {
    s.timer -= dt;
    if (s.timer <= 0) {
      s.level = Math.min(999, s.level + 1);
      s.enemies = wave(s.level, random);
      s.shots = [];
      s.phase = "waiting";
      s.waitingReason = "next_level";
      s.awaitDirectionRelease = Boolean(input.direction);
      s.playerMoving = false;
      s.queuedDirection = null;
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
  if (input.direction) {
    s.playerMoving = true;
    s.queuedDirection = input.direction;
  }
  const difficulty = classicDifficulty(s.level);
  if (s.playerMoving && moveActor(s.player, input.reverse ? null : s.queuedDirection ?? null, difficulty.playerSpeed * dt))
    s.queuedDirection = null;
  if (input.fire) fire(s, s.player);
  for (const enemy of s.enemies) {
    // Stop exactly at each crossing before choosing a turn. A proximity check
    // can consume a decision before moveActor is close enough to accept it.
    let remaining = difficulty.enemySpeed * dt;
    while (remaining > 1e-7) {
      const atCrossing =
        Math.abs(enemy.x - nearest(enemy.x)) < 1e-7 && Math.abs(enemy.y - nearest(enemy.y)) < 1e-7;
      let turn: Direction | null = null;
      if (atCrossing) {
        enemy.x = nearest(enemy.x);
        enemy.y = nearest(enemy.y);
        const crossing = `${nearest(enemy.x)},${nearest(enemy.y)}`;
        const [headingX, headingY] = vectors[enemy.direction];
        const blocked =
          enemy.x + headingX < lane(0) ||
          enemy.x + headingX > lane(CLASSIC.cells) ||
          enemy.y + headingY < lane(0) ||
          enemy.y + headingY > lane(CLASSIC.cells);
        if (enemy.lastDecision !== crossing || blocked) {
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
          const pursuit = Math.min(0.45, 0.1 + 0.035 * Math.log2(s.level));
          const chasing = legal.filter((direction) => {
            const [dx, dy] = vectors[direction];
            return dx * (s.player.x - enemy.x) + dy * (s.player.y - enemy.y) > 0;
          });
          const choices = random() < pursuit && chasing.length ? chasing : legal;
          turn =
            choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))] ?? null;
        }
      } else {
        delete enemy.lastDecision;
      }
      if (turn) enemy.direction = turn;
      const [dx, dy] = vectors[enemy.direction];
      const position = dx ? enemy.x : enemy.y;
      const sign = dx || dy;
      const index = (position - CLASSIC.margin) / CLASSIC.spacing;
      const nextIndex = sign > 0 ? Math.floor(index + 1e-7) + 1 : Math.ceil(index - 1e-7) - 1;
      const distance = Math.min(remaining, Math.abs(lane(nextIndex) - position));
      enemy.x += dx * distance;
      enemy.y += dy * distance;
      remaining -= distance;
      if (distance > 1e-7) delete enemy.lastDecision;
    }
    if (enemy.canFire && random() < dt * difficulty.fireRate) fire(s, enemy);
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
          target.health = (target.health ?? 1) - 1;
          s.score += CLASSIC.killScore;
          if (target.health <= 0) {
            s.enemies = s.enemies.filter((e) => e.id !== target.id);
          }
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
    loseLife(s, playerHit ? "shot" : "crash", Boolean(input.direction));
  if (s.phase === "playing" && s.enemies.length === 0) {
    s.score += CLASSIC.levelBonus;
    s.levelsCleared++;
    s.phase = "level_clear";
    s.timer = CLASSIC.transition;
    s.shots = [];
  }
}
