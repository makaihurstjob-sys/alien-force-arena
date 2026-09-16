import { describe, expect, it } from "vitest";
import { createClassic, tickClassic, moveActor, CLASSIC, type Direction } from "./engine";
const idle = { direction: null, fire: false };
describe("classic simulation", () => {
  it("buffers a perpendicular turn until an intersection", () => {
    const actor = { id: 0, x: 32, y: 12, direction: "right" as const };
    moveActor(actor, "down", 40);
    expect(actor.x).toBe(52);
    expect(actor.y).toBeGreaterThan(12);
  });
  it("keeps ships inside the outer lanes", () => {
    const s = createClassic();
    moveActor(s.player, "right", 100);
    expect(s.player.x).toBe(412);
  });
  it("allows only one player shot and charges only successful shots", () => {
    const s = createClassic();
    s.score = 100;
    for (let i = 0; i < 10; i++) tickClassic(s, { direction: null, fire: true }, 1 / 60, () => 1);
    expect(s.shots.filter((b) => b.owner === 0)).toHaveLength(1);
    expect(s.shotsFired).toBe(1);
    expect(s.score).toBe(90);
  });
  it("awards a hit once, clears the wave, and starts the next level", () => {
    const s = createClassic();
    s.enemies = [{ id: 1, x: 372, y: 412, direction: "right" }];
    tickClassic(s, { direction: null, fire: true }, 1 / 60, () => 1);
    for (let i = 0; i < 20; i++) tickClassic(s, idle, 1 / 60, () => 1);
    expect(s.hits).toBe(1);
    expect(s.score).toBe(CLASSIC.killScore + CLASSIC.levelBonus);
    expect(s.phase).toBe("level_clear");
    for (let i = 0; i < 100; i++) tickClassic(s, idle, 1 / 60, () => 1);
    expect(s.level).toBe(2);
    expect(s.phase).toBe("playing");
  });
  it("loses one life on contact and protects the respawn", () => {
    const s = createClassic();
    s.invulnerable = 0;
    s.enemies = [{ ...s.player, id: 1 }];
    tickClassic(s, idle, 1 / 60, () => 1);
    expect(s.lives).toBe(2);
    s.enemies = [{ ...s.player, id: 1 }];
    tickClassic(s, idle, 1 / 60, () => 1);
    expect(s.lives).toBe(2);
  });
  it("stops the simulation after the final life", () => {
    const s = createClassic();
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
  const s = createClassic();
  tickClassic(s, idle, 1 / 60, () => 1);
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
      const s = createClassic();
      s.invulnerable = Infinity;
      s.enemies = [{ id: 1, x, y, direction }];
      for (let frame = 0; frame < 120; frame++) tickClassic(s, idle, 1 / 60, () => 0.9);
      const enemy = s.enemies[0]!;
      expect(Math.hypot(enemy.x - x, enemy.y - y)).toBeGreaterThan(10);
      expect(enemy.x).toBeGreaterThanOrEqual(12);
      expect(enemy.x).toBeLessThanOrEqual(412);
      expect(enemy.y).toBeGreaterThanOrEqual(12);
      expect(enemy.y).toBeLessThanOrEqual(412);
    },
  );
  it.each([1, 2, 6, 11, 20])("keeps moving on lanes through crossings at level %s", (level) => {
    const s = createClassic();
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
    const s = createClassic();
    for (let frame = 0; frame < 120; frame++) tickClassic(s, idle, 1 / 60, () => 0);
    expect(s.shots.filter((shot) => shot.owner !== 0)).toHaveLength(0);
    expect(s.enemies.every((enemy) => !enemy.canFire)).toBe(true);
  });
  it("keeps enemy count, movement and firing identical across levels", () => {
    const low = createClassic(1),
      high = createClassic(20);
    low.invulnerable = high.invulnerable = Infinity;
    for (let frame = 0; frame < 600; frame++) {
      tickClassic(low, idle, 1 / 60, () => 0.25);
      tickClassic(high, idle, 1 / 60, () => 0.25);
    }
    expect(high.enemies).toEqual(low.enemies);
    expect(high.shots).toEqual(low.shots);
    high.phase = "level_clear";
    high.timer = 0;
    tickClassic(high, idle);
    expect(high.level).toBe(21);
    expect(high.enemies).toEqual(createClassic().enemies);
  });
  it.each([0, -1, 1.5, NaN, Infinity, 1000])("rejects invalid selected level %s", (level) => {
    expect(() => createClassic(level)).toThrow(RangeError);
  });
  it("makes one decision while passing through an intersection", () => {
    const s = createClassic();
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
