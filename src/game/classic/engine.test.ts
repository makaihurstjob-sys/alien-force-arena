import { describe, expect, it } from "vitest";
import { createClassic, tickClassic, moveActor, classicDifficulty, CLASSIC, type Direction } from "./engine";
const idle = { direction: null, fire: false };
// Existing combat tests begin after the first movement input.
function playingClassic(level = 1) {
  const s = createClassic(level);
  tickClassic(s, { ...idle, direction: "left" }, 0);
  s.playerMoving = false;
  s.queuedDirection = null;
  return s;
}
describe("classic simulation", () => {
  it("buffers a perpendicular turn until an intersection", () => {
    const actor = { id: 0, x: 32, y: 12, direction: "right" as const };
    moveActor(actor, "down", 40);
    expect(actor.x).toBe(52);
    expect(actor.y).toBeGreaterThan(12);
  });
  it("keeps ships inside the outer lanes", () => {
    const s = playingClassic();
    moveActor(s.player, "right", 100);
    expect(s.player.x).toBe(412);
  });
  it("allows only one player shot and charges only successful shots", () => {
    const s = playingClassic();
    s.score = 100;
    for (let i = 0; i < 10; i++) tickClassic(s, { direction: null, fire: true }, 1 / 60, () => 1);
    expect(s.shots.filter((b) => b.owner === 0)).toHaveLength(1);
    expect(s.shotsFired).toBe(1);
    expect(s.score).toBe(90);
  });
  it("awards a hit once, clears the wave, and starts the next level", () => {
    const s = playingClassic();
    s.enemies = [{ id: 1, x: 372, y: 412, direction: "right" }];
    tickClassic(s, { direction: null, fire: true }, 1 / 60, () => 1);
    for (let i = 0; i < 20; i++) tickClassic(s, idle, 1 / 60, () => 1);
    expect(s.hits).toBe(1);
    expect(s.score).toBe(CLASSIC.killScore + CLASSIC.levelBonus);
    expect(s.phase).toBe("level_clear");
    for (let i = 0; i < 100; i++) tickClassic(s, idle, 1 / 60, () => 1);
    expect(s.level).toBe(2);
    expect(s.phase).toBe("waiting");
    expect(s.waitingReason).toBe("next_level");
  });
  it("loses one life on contact and protects the respawn", () => {
    const s = playingClassic();
    s.invulnerable = 0;
    s.enemies = [{ ...s.player, id: 1 }];
    tickClassic(s, idle, 1 / 60, () => 1);
    expect(s.lives).toBe(2);
    s.enemies = [{ ...s.player, id: 1 }];
    tickClassic(s, idle, 1 / 60, () => 1);
    expect(s.lives).toBe(2);
  });
  it("stops the simulation after the final life", () => {
    const s = playingClassic();
    s.invulnerable = 0;
    s.lives = 1;
    s.enemies = [{ ...s.player, id: 1 }];
    tickClassic(s, idle, 1 / 60, () => 1);
    expect(s.phase).toBe("game_over");
    const snapshot = JSON.stringify(s);
    tickClassic(s, { direction: "up", fire: true });
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

it("continues moving after release and reverses without stopping", () => {
  const s = playingClassic();
  tickClassic(s, { ...idle, direction: "left" }, 1 / 60, () => 1);
  const x = s.player.x;
  tickClassic(s, idle, 1 / 60, () => 1);
  expect(s.player.x).toBeLessThan(x);
  const beforeReverse = s.player.x;
  tickClassic(s, { ...idle, reverse: true }, 1 / 60, () => 1);
  expect(s.player.x).toBeGreaterThan(beforeReverse);
  const afterReverse = s.player.x;
  tickClassic(s, idle, 1 / 60, () => 1);
  expect(s.player.x).toBeGreaterThan(afterReverse);
});

describe("enemy progression", () => {
  it.each([
    [12.75, 52, "left"],
    [411.25, 52, "right"],
    [52, 12.75, "up"],
    [52, 411.25, "down"],
  ] as [number, number, Direction][])(
    "turns away from a wall approached at (%s, %s)",
    (x, y, direction) => {
      const s = playingClassic();
      s.invulnerable = Infinity;
      s.enemies = [{ id: 1, x, y, direction }];
      let maxDisplacement = 0;
      for (let frame = 0; frame < 120; frame++) {
        const before = { ...s.enemies[0]! };
        tickClassic(s, idle, 1 / 60, () => 0.9);
        const current = s.enemies[0]!;
        // A legal out-and-back route can finish at the starting point.
        expect(Math.hypot(current.x - before.x, current.y - before.y)).toBeGreaterThan(0.1);
        maxDisplacement = Math.max(maxDisplacement, Math.hypot(current.x - x, current.y - y));
        expect(current.x).toBeGreaterThanOrEqual(12);
        expect(current.x).toBeLessThanOrEqual(412);
        expect(current.y).toBeGreaterThanOrEqual(12);
        expect(current.y).toBeLessThanOrEqual(412);
      }
      const enemy = s.enemies[0]!;
      expect(maxDisplacement).toBeGreaterThan(10);
      expect(enemy.x).toBeGreaterThanOrEqual(12);
      expect(enemy.x).toBeLessThanOrEqual(412);
      expect(enemy.y).toBeGreaterThanOrEqual(12);
      expect(enemy.y).toBeLessThanOrEqual(412);
    },
  );
  it.each([1, 2, 6, 11, 20])("keeps moving on lanes through crossings at level %s", (level) => {
    const s = playingClassic();
    s.level = level;
    s.invulnerable = Infinity;
    let seed = 12345;
    const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
    const stationary = new Map<number, number>();
    let maxStationary = 0,
      minPosition = Infinity,
      maxPosition = -Infinity,
      maxLaneError = 0;
    for (let frame = 0; frame < 3600; frame++) {
      const before = s.enemies.map((e) => ({ ...e }));
      tickClassic(s, idle, 1 / 60, random);
      for (const enemy of s.enemies) {
        const previous = before.find((e) => e.id === enemy.id)!;
        const stopped = Math.hypot(enemy.x - previous.x, enemy.y - previous.y) < 1e-7;
        stationary.set(enemy.id, stopped ? (stationary.get(enemy.id) ?? 0) + 1 : 0);
        maxStationary = Math.max(maxStationary, stationary.get(enemy.id)!);
        minPosition = Math.min(minPosition, enemy.x, enemy.y);
        maxPosition = Math.max(maxPosition, enemy.x, enemy.y);
        const laneError = (value: number) =>
          Math.abs((value - 12) / 40 - Math.round((value - 12) / 40));
        maxLaneError = Math.max(maxLaneError, Math.min(laneError(enemy.x), laneError(enemy.y)));
      }
    }
    expect(maxStationary).toBeLessThan(2);
    expect(minPosition).toBeGreaterThanOrEqual(12);
    expect(maxPosition).toBeLessThanOrEqual(412);
    expect(maxLaneError).toBeLessThan(1e-7);
  });
  it("never fires enemy shots on level 1 even when the random roll favors firing", () => {
    const s = playingClassic();
    for (let frame = 0; frame < 120; frame++) tickClassic(s, idle, 1 / 60, () => 0);
    expect(s.shots.filter((shot) => shot.owner !== 0)).toHaveLength(0);
    expect(s.enemies.every((enemy) => !enemy.canFire)).toBe(true);
  });
  it("increases movement and shooting frequency from level 1 through 999", () => {
    const speeds = [1, 2, 10, 20, 999].map(level => classicDifficulty(level).enemySpeed);
    const pilotSpeeds = [1, 2, 10, 20, 999].map(level => classicDifficulty(level).playerSpeed);
    expect(speeds).toEqual([...speeds].sort((a, b) => a - b));
    expect(new Set(speeds).size).toBe(speeds.length);
    expect(pilotSpeeds).toEqual([...pilotSpeeds].sort((a, b) => a - b));
    expect(new Set(pilotSpeeds).size).toBe(pilotSpeeds.length);
    expect(speeds[0]).toBeLessThan(40);
    expect(pilotSpeeds[0]).toBeLessThan(110);
    expect(classicDifficulty(1).shooters).toBe(0);
    expect(classicDifficulty(2).shooters).toBe(1);
    expect(classicDifficulty(10).shooters).toBe(2);
    expect(classicDifficulty(999).shooters).toBe(10);
    expect(classicDifficulty(999).fireRate).toBeGreaterThan(classicDifficulty(20).fireRate);
    for (const level of [1, 2, 10, 20, 999]) {
      const s = createClassic(level, () => 0.5);
      expect(s.enemies).toHaveLength(10);
      expect(s.enemies.filter(e => e.canFire)).toHaveLength(classicDifficulty(level).shooters);
    }
  });
  it("adds armor to one random drone per ten levels, then cycles to a third hit", () => {
    const first = createClassic(10, () => 0);
    const other = createClassic(10, () => 0.99);
    expect(first.enemies.filter(e => e.health === 2)).toHaveLength(1);
    expect(first.enemies.find(e => e.health === 2)?.id).not.toBe(other.enemies.find(e => e.health === 2)?.id);
    expect(createClassic(20).enemies.filter(e => e.health === 2)).toHaveLength(2);
    expect(createClassic(90).enemies.filter(e => e.health === 2)).toHaveLength(9);
    expect(createClassic(100).enemies.every(e => e.health === 2)).toBe(true);
    expect(createClassic(110).enemies.filter(e => e.health === 3)).toHaveLength(1);
    expect(createClassic(999).enemies.filter(e => e.health === 11)).toHaveLength(9);
    expect(createClassic(999).enemies.filter(e => e.health === 10)).toHaveLength(1);
  });
  it("requires two hits for an armored drone and counts each hit", () => {
    const s = playingClassic(10);
    s.invulnerable = Infinity;
    s.enemies = [{ id: 1, x: 372, y: 412, direction: "right", health: 2, maxHealth: 2 }];
    for (let frame = 0; frame < 30 && s.hits < 1; frame++) tickClassic(s, { ...idle, fire: true }, 1 / 60, () => 1);
    expect(s.hits).toBe(1);
    expect(s.enemies).toHaveLength(1);
    expect(s.enemies[0]?.health).toBe(1);
    expect(s.score).toBe(CLASSIC.killScore);
    for (let frame = 0; frame < 60 && s.hits < 2; frame++) tickClassic(s, { ...idle, fire: true }, 1 / 60, () => 1);
    expect(s.hits).toBe(2);
    expect(s.phase).toBe("level_clear");
    expect(s.score).toBe(2 * CLASSIC.killScore - CLASSIC.shotCost + CLASSIC.levelBonus);
  });
  it("keeps level 999 at maximum difficulty after clearing a wave", () => {
    const high = playingClassic(999);
    high.enemies = [];
    tickClassic(high, idle);
    high.timer = 0;
    tickClassic(high, idle, 1 / 60, () => 0.5);
    expect(high.level).toBe(999);
    expect(high.enemies).toHaveLength(10);
    expect(high.enemies.every(e => e.health! >= 10 && e.canFire)).toBe(true);
  });
  it.each([0, -1, 1.5, NaN, Infinity, 1000])("rejects invalid selected level %s", (level) => {
    expect(() => createClassic(level)).toThrow(RangeError);
  });
  it("makes one decision while passing through an intersection", () => {
    const s = playingClassic();
    s.enemies = [{ id: 1, x: 212, y: 212, direction: "down" }];
    let calls = 0;
    const random = () => {
      calls++;
      return 0.9;
    };
    tickClassic(s, idle, 1 / 60, random);
    const firstCalls = calls;
    tickClassic(s, idle, 1 / 60, random);
    expect(calls).toBe(firstCalls);
    expect(s.enemies[0]!.x).toBeGreaterThan(212);
  });
});

it("remembers a quick turn tap until the next lane crossing", () => {
  const s = playingClassic();
  s.invulnerable = Infinity;
  for (let i = 0; i < 10; i++) tickClassic(s, { ...idle, direction: "left" }, 1 / 60, () => 1);
  tickClassic(s, { ...idle, direction: "up" }, 1 / 60, () => 1);
  for (let i = 0; i < 120; i++) tickClassic(s, idle, 1 / 60, () => 1);
  expect(s.player.direction).toBe("up");
  expect(s.player.y).toBeLessThan(412);
  expect(s.queuedDirection).toBe(null);
});


describe("original opening", () => {
  it("places ten enemies in the ten top lanes", () => {
    const s = playingClassic();
    expect(s.enemies).toHaveLength(10);
    expect(s.enemies.map(e => e.x)).toEqual(Array.from({ length: 10 }, (_, i) => CLASSIC.margin + i * CLASSIC.spacing));
    expect(s.enemies.every(e => e.y === CLASSIC.margin && e.direction === "down")).toBe(true);
  });
  it("waits for steering, even when firing or reversing", () => {
    const s = playingClassic();
    const start = { x: s.player.x, y: s.player.y };
    for (let i = 0; i < 60; i++) tickClassic(s, idle);
    tickClassic(s, { ...idle, fire: true });
    tickClassic(s, { ...idle, reverse: true });
    expect({ x: s.player.x, y: s.player.y }).toEqual(start);
    expect(s.playerMoving).toBe(false);
    tickClassic(s, { ...idle, direction: "up" });
    expect(s.player.y).toBeLessThan(start.y);
    const y = s.player.y;
    tickClassic(s, idle);
    expect(s.player.y).toBeLessThan(y);
  });
  it("waits for steering again after losing a life", () => {
    const s = playingClassic();
    s.playerMoving = true;
    s.invulnerable = 0;
    s.enemies = [{ ...s.player, id: 1 }];
    tickClassic(s, idle, 1 / 60, () => 1);
    expect(s.lives).toBe(2);
    expect(s.enemies).toHaveLength(1);
    expect(s.playerMoving).toBe(false);
    tickClassic(s, idle);
    expect(s.phase).toBe("waiting");
  });
});


describe("move to start and resume", () => {
  it("freezes indefinitely until a direction moves the pilot", () => {
    const s = createClassic();
    const enemies = structuredClone(s.enemies);
    tickClassic(s, idle, 120);
    tickClassic(s, { ...idle, fire: true, reverse: true }, 120);
    expect(s.phase).toBe("waiting");
    expect(s.elapsed).toBe(0);
    expect(s.enemies).toEqual(enemies);
    expect(s.shots).toHaveLength(0);
    tickClassic(s, { ...idle, direction: "up" }, 1 / 60, () => 1);
    expect(s.phase).toBe("playing");
    expect(s.player.y).toBeLessThan(412);
  });
  it("preserves damaged drones and pauses after death until movement", () => {
    const s = playingClassic(10);
    s.invulnerable = 0;
    s.enemies = [{ ...s.player, id: 1, health: 2, maxHealth: 2 }];
    tickClassic(s, idle, 1 / 60, () => 1);
    expect(s.lives).toBe(2);
    expect(s.phase).toBe("waiting");
    expect(s.waitingReason).toBe("respawn");
    expect(s.enemies).toHaveLength(1);
    expect(s.enemies[0]?.health).toBe(2);
    const enemies = structuredClone(s.enemies);
    const elapsed = s.elapsed;
    tickClassic(s, idle, 120);
    expect(s.enemies).toEqual(enemies);
    expect(s.elapsed).toBe(elapsed);
    tickClassic(s, { ...idle, direction: "up" }, 1 / 60, () => 1);
    expect(s.phase).toBe("playing");
    expect(s.enemies).toHaveLength(1);
  });
  it("requires a fresh movement input when a direction remains held across a wave", () => {
    const s = playingClassic();
    s.enemies = [];
    tickClassic(s, { ...idle, direction: "left" }, 1 / 60);
    tickClassic(s, { ...idle, direction: "left" }, 2);
    expect(s.phase).toBe("waiting");
    tickClassic(s, { ...idle, direction: "left" }, 10);
    expect(s.phase).toBe("waiting");
    tickClassic(s, idle);
    tickClassic(s, { ...idle, direction: "left" });
    expect(s.phase).toBe("playing");
  });
});
