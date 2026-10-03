import { describe, expect, it } from "vitest";
import {
  RANKED_DISCONNECT_LIMIT_MS,
  RankedHost,
  isRankedPacket,
  isRankedSnapshot,
  type RankedPacket,
} from "./ranked-online";
import { EMPTY_INPUT } from "./types";

const players = [
  { id: "host", name: "WHITE", team: 0 as const },
  { id: "guest", name: "ORANGE", team: 1 as const },
];
const packet = (
  playerId: string,
  sequence = 1,
  overrides: Partial<RankedPacket> = {},
): RankedPacket => ({
  playerId,
  instance: playerId,
  sequence,
  active: true,
  input: { ...EMPTY_INPUT },
  matchId: "match",
  ...overrides,
});
const connect = (
  host: RankedHost,
  now = 0,
  sequence = 1,
  overrides: Partial<RankedPacket> = {},
) => {
  players.forEach((p) => host.receive(packet(p.id, sequence, overrides), now));
};
const killGuest = (host: RankedHost, now: number) => {
  connect(host, now, now);
  host.match.game.phase = "playing";
  host.match.game.phaseTimerMs = 60000;
  host.match.game.ships[0]!.alive = true;
  host.match.game.ships[1]!.alive = false;
  host.advance(now);
};

describe("ranked host simulation", () => {
  it("waits for both peers before running, and only ends on an explicit result", () => {
    const host = new RankedHost("match", players, "1a");
    host.receive(packet("host"), 0);
    host.advance(0);
    expect(host.match.game.tick).toBe(0);
    connect(host);
    host.advance(10);
    expect(host.match.game.tick).toBe(1);
    expect(host.paused).toBe(false);
    expect(host.result).toBeNull();
    expect(isRankedSnapshot(host.snapshot(), ["host", "guest"])).toBe(true);
  });

  it("forfeits the specific player who goes stale for 30s, crediting the opponent", () => {
    const host = new RankedHost("match", players, "1a");
    host.match.game.score = [2, 0]; // guest is the one who will never connect, at loserScore 0
    let now = 0;
    // Guest never sends a packet at all, so its staleness clock starts at tick zero.
    for (; now <= RANKED_DISCONNECT_LIMIT_MS + 200; now += 100) {
      host.receive(packet("host", now), now);
      host.advance(now);
      if (host.result) break;
    }
    expect(host.result).toEqual({ winner: 0, loserScore: 0, disconnect: true });
    expect(host.ended).toContain("forfeited");
  });

  it("does not forfeit an explicit, mutual pause no matter how long it lasts", () => {
    const host = new RankedHost("match", players, "1a");
    connect(host, 0);
    host.advance(0);
    let now = 0;
    for (; now <= RANKED_DISCONNECT_LIMIT_MS + 1000; now += 200) {
      host.receive(packet("host", now, { paused: true }), now);
      host.receive(packet("guest", now, { paused: true }), now);
      host.advance(now);
    }
    expect(host.result).toBeNull();
    expect(host.paused).toBe(true);
    expect(host.ended).toBe("");
  });

  it("1A (stocks) respawns only the eliminated ship and settles at zero stocks", () => {
    const host = new RankedHost("match", players, "1a");
    let now = 0;
    for (let i = 0; i < 3; i++) {
      now += 20;
      killGuest(host, now);
    }
    expect(host.result).toBeNull();
    expect(host.match.stocks).toEqual([4, 1]);
    now += 20;
    killGuest(host, now);
    expect(host.result).toEqual({ winner: 0, loserScore: 0, disconnect: false });
    expect(host.ended).toBe("Match complete.");
  });

  it("1B (rounds) resets both pilots each round and settles on four wins", () => {
    const host = new RankedHost("match", players, "1b");
    let now = 0;
    for (let i = 0; i < 3; i++) {
      now += 20;
      killGuest(host, now);
    }
    expect(host.result).toBeNull();
    expect(host.match.game.score).toEqual([3, 0]);
    now += 20;
    killGuest(host, now);
    expect(host.result).toEqual({ winner: 0, loserScore: 0, disconnect: false });
  });

  it("settles simultaneous last-stock eliminations as a draw, never a win", () => {
    const host = new RankedHost("match", players, "1a");
    connect(host, 0);
    host.advance(0);
    host.match.stocks = [1, 1];
    host.match.game.phase = "playing";
    host.match.game.phaseTimerMs = 60000;
    host.match.game.ships.forEach((s) => {
      s.alive = false;
    });
    connect(host, 20, 20);
    host.advance(20);
    expect(host.result).toEqual({ winner: null, loserScore: 0, disconnect: false });
    expect(host.match.draw).toBe(true);
  });

  it("settles a trusted forfeit immediately, even while paused, and preserves the result", () => {
    const host = new RankedHost("match", players, "1b");
    host.match.game.score = [2, 3];
    host.requestForfeit("outsider");
    expect(host.result).toBeNull();
    host.requestForfeit("guest");
    expect(host.result).toEqual({ winner: 0, loserScore: 3, disconnect: true });
    host.requestForfeit("host");
    host.advance(100);
    expect(host.result?.winner).toBe(0);
  });

  it("rejects malformed wire data", () => {
    expect(isRankedPacket({ ...packet("guest"), input: { fire: "yes" } })).toBe(false);
    expect(isRankedPacket({ ...packet("guest"), sequence: NaN })).toBe(false);
    expect(isRankedPacket({ ...packet("guest"), matchId: 5 })).toBe(false);
    const host = new RankedHost("match", players, "1a");
    const value = host.snapshot();
    value.state.ships[0]!.x = Infinity;
    expect(isRankedSnapshot(value, ["host", "guest"])).toBe(false);
    expect(isRankedSnapshot({ state: {} }, ["host", "guest"])).toBe(false);
    const bad = host.snapshot();
    // @ts-expect-error deliberately invalid result shape for the guard test
    bad.result = { winner: 2, loserScore: 0, disconnect: false };
    expect(isRankedSnapshot(bad, ["host", "guest"])).toBe(false);
  });
});
