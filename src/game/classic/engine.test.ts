import { describe, expect, it } from "vitest";
import { createClassic, tickClassic, moveActor, CLASSIC } from "./engine";
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
  it("never fires enemy shots on level 1 even when the random roll favors firing", () => {
    const s = createClassic();
    for (let frame = 0; frame < 120; frame++) tickClassic(s, idle, 1 / 60, () => 0);
    expect(s.shots.filter((shot) => shot.owner !== 0)).toHaveLength(0);
    expect(s.enemies.every((enemy) => !enemy.canFire)).toBe(true);
  });
  it("introduces a mix of shooters and non-shooters on level 2", () => {
    const s = createClassic();
    s.phase = "level_clear";
    s.timer = 0;
    tickClassic(s, idle);
    expect(s.level).toBe(2);
    expect(s.enemies.some((enemy) => enemy.canFire)).toBe(true);
    expect(s.enemies.some((enemy) => !enemy.canFire)).toBe(true);
    tickClassic(s, idle, 1 / 60, () => 0);
    expect(s.shots.some((shot) => shot.owner !== 0)).toBe(true);
    expect(
      s.shots.every((shot) => s.enemies.find((enemy) => enemy.id === shot.owner)?.canFire),
    ).toBe(true);
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
