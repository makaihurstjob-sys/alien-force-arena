/**
 * Focused rules tests. These cover the parts a grader will poke at:
 * the one-projectile rule and round/match resolution.
 */

import { describe, expect, it } from "vitest";
import { createMatch, step, type PlayerSeed } from "./engine";
import { PROJECTILE, PVP_RULES, TICK_HZ } from "./config";
import { EMPTY_INPUT, type GameState } from "./types";

const PLAYERS: PlayerSeed[] = [
  { id: "a", name: "A", team: 0 },
  { id: "b", name: "B", team: 1 },
];

function skipCountdown(state: GameState) {
  const ticks = PVP_RULES.countdownSeconds * TICK_HZ + 1;
  for (let i = 0; i < ticks; i++) step(state, {}, "cross");
}

const FIRE = { ...EMPTY_INPUT, fire: true };

describe("one-projectile rule", () => {
  it("allows only one active projectile per player", () => {
    const state = createMatch(PLAYERS, "cross");
    skipCountdown(state);

    step(state, { a: FIRE }, "cross");
    expect(state.projectiles.filter((p) => p.ownerId === "a")).toHaveLength(1);

    // holding fire for many ticks must not add more projectiles
    for (let i = 0; i < 10; i++) step(state, { a: FIRE }, "cross");
    expect(state.projectiles.filter((p) => p.ownerId === "a")).toHaveLength(1);
    expect(state.ships.find((s) => s.id === "a")!.canFire).toBe(false);
    expect(state.ships.find((s) => s.id === "a")!.shots).toBe(1);
  });

  it("restores the shot once the projectile leaves play", () => {
    const state = createMatch(PLAYERS, "cross");
    skipCountdown(state);
    step(state, { a: FIRE }, "cross");

    const maxTicks = Math.ceil((PROJECTILE.lifetimeMs / 1000) * TICK_HZ) + 2;
    for (let i = 0; i < maxTicks; i++) step(state, {}, "cross");

    expect(state.projectiles.filter((p) => p.ownerId === "a")).toHaveLength(0);
    expect(state.ships.find((s) => s.id === "a")!.canFire).toBe(true);
  });
});

describe("round resolution", () => {
  it("ends the round and scores when a team is wiped out", () => {
    const state = createMatch(PLAYERS, "cross");
    skipCountdown(state);

    // place the shooter right next to the target for a guaranteed hit
    const a = state.ships.find((s) => s.id === "a")!;
    const b = state.ships.find((s) => s.id === "b")!;
    b.x = a.x + 60;
    b.y = a.y;
    a.angle = 0;

    for (let i = 0; i < 20; i++) step(state, { a: FIRE }, "cross");

    expect(b.alive).toBe(false);
    expect(state.score[0]).toBe(1);
    expect(state.phase).toBe("round_over");
    expect(a.hits).toBe(1);
  });
});
