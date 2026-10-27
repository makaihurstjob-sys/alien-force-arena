import { describe, it, expect } from "vitest";
import { createPowerDuelMatch, stepPowerDuel } from "./powerup-duel";
import { PowerDuelHost, isPowerDuelSnapshot } from "./powerup-online";
import { EMPTY_INPUT } from "../types";
import type { PlayerSeed } from "./duel";

const pilots: PlayerSeed[] = [
  { id: "a", name: "Alice", team: 0 },
  { id: "b", name: "Bob", team: 1 },
  { id: "c", name: "Carol", team: 0 },
  { id: "d", name: "Dan", team: 1 },
];
function match() {
  const m = createPowerDuelMatch(pilots);
  m.game.phase = "playing";
  m.game.phaseTimerMs = 10000;
  return m;
}
describe("four-pilot Arcade teams", () => {
  it("spawns four distinct corners and keeps the round alive after one elimination", () => {
    const m = match();
    expect(new Set(m.game.ships.map((s) => `${s.x},${s.y}`)).size).toBe(4);
    m.game.ships[1]!.alive = false;
    stepPowerDuel(m, {});
    expect(m.game.phase).toBe("playing");
    m.game.ships[3]!.alive = false;
    stepPowerDuel(m, {});
    expect(m.game.lastRoundWinner).toBe(0);
    expect(m.game.score).toEqual([1, 0]);
  });
  it("resolves enemy collisions beyond the first two seats, but ignores teammate collisions", () => {
    const m = match();
    m.game.ships[2]!.x = m.game.ships[3]!.x = 200;
    m.game.ships[2]!.y = m.game.ships[3]!.y = 200;
    stepPowerDuel(m, {});
    expect(m.game.ships[2]!.alive).toBe(false);
    expect(m.game.ships[3]!.alive).toBe(false);
    const n = match();
    n.game.ships[2]!.x = n.game.ships[0]!.x;
    n.game.ships[2]!.y = n.game.ships[0]!.y;
    stepPowerDuel(n, {});
    expect(n.game.ships[0]!.alive && n.game.ships[2]!.alive).toBe(true);
  });
  it("does not hit teammates, and freeze hits any opponent without global protection", () => {
    const m = match();
    m.game.ships.forEach((s, i) => {
      s.x = 40 + i * 100;
      s.y = 40;
    });
    const target = m.game.ships[3]!;
    const shot = (ownerId: string, y: number) => ({
      id: ownerId,
      ownerId,
      team: 0 as const,
      x: target.x - 4,
      y,
      vx: 250,
      vy: 0,
      ageMs: 0,
    });
    m.freezeInFlight.add("a");
    m.game.projectiles = [shot("a", 200), shot("c", target.y)];
    stepPowerDuel(m, {});
    expect(target.alive).toBe(false); // A freeze shot elsewhere cannot shield this target.
    const n = match();
    n.game.ships.forEach((s, i) => {
      s.x = 40 + i * 100;
      s.y = 40;
    });
    n.freezeInFlight.add("a");
    n.game.projectiles = [shot("a", 40)];
    stepPowerDuel(n, {});
    expect(n.game.ships[3]!.alive).toBe(true);
    expect(n.frozenUntil.has("d")).toBe(true);
    expect(n.game.ships[0]!.hits).toBe(1);
    const p = match();
    const teammate = p.game.ships[2]!;
    p.game.projectiles = [{ ...shot("a", teammate.y), x: teammate.x }];
    stepPowerDuel(p, {});
    expect(teammate.alive).toBe(true);
  });
  it("waits for all four inputs, accepts four-ship snapshots and pauses for a missing pilot", () => {
    const host = new PowerDuelHost("match", pilots);
    const packet = (playerId: string, sequence = 1) => ({
      playerId,
      instance: playerId,
      sequence,
      active: true,
      paused: false,
      input: { ...EMPTY_INPUT },
      matchId: "match",
      rematch: false,
      returnFrom: null,
    });
    pilots.slice(0, 3).forEach((p) => host.receive(packet(p.id), 100));
    host.advance(100, true);
    expect(host.paused).toBe(true);
    host.receive(packet("d"), 100);
    host.advance(100, true);
    expect(host.paused).toBe(false);
    const snapshot = host.snapshot();
    expect(
      isPowerDuelSnapshot(
        snapshot,
        pilots.map((p) => p.id),
      ),
    ).toBe(true);
    expect(isPowerDuelSnapshot(snapshot, ["a", "b"])).toBe(false);
    expect(
      isPowerDuelSnapshot(
        {
          ...snapshot,
          game: {
            ...snapshot.game,
            ships: [...snapshot.game.ships.slice(0, 3), snapshot.game.ships[0]],
          },
        },
        pilots.map((p) => p.id),
      ),
    ).toBe(false);
    host.advance(2000, true);
    expect(host.paused).toBe(true);
  });
});
