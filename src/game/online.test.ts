import { describe, expect, it } from "vitest";
import {
  DuelHost,
  interpolateDuel,
  isDuelSnapshot,
  isPilotPacket,
  type PilotPacket,
} from "./online";
import { EMPTY_INPUT } from "./types";

const players = [
  { id: "host", name: "GREEN", team: 0 as const },
  { id: "guest", name: "RED", team: 1 as const },
];
const packet = (
  playerId: string,
  sequence = 1,
  overrides: Partial<PilotPacket> = {},
): PilotPacket => ({
  playerId,
  instance: playerId,
  sequence,
  active: true,
  input: { ...EMPTY_INPUT },
  matchId: "match",
  rematch: false,
  returnFrom: null,
  ...overrides,
});
const connect = (host: DuelHost, now = 0, sequence = 1) => {
  players.forEach((p) => host.receive(packet(p.id, sequence), now));
};

describe("online host simulation", () => {
  it("waits for both peers, then runs one shared countdown", () => {
    const host = new DuelHost("match", players);
    host.receive(packet("host"), 0);
    host.advance(0, true);
    expect(host.state.tick).toBe(0);
    connect(host);
    host.advance(10, true);
    expect(host.state.tick).toBe(1);
    expect(host.paused).toBe(false);
    expect(isDuelSnapshot(host.snapshot(), ["host", "guest"])).toBe(true);
  });

  it("applies guest controls and rejects outsider, stale and wrong-match inputs", () => {
    const host = new DuelHost("match", players);
    host.state.phase = "playing";
    connect(host);
    host.receive(packet("guest", 3, { input: { ...EMPTY_INPUT, fire: true } }), 0);
    host.receive(packet("guest", 2), 10);
    host.receive(packet("guest", 4, { matchId: "old" }), 10);
    host.receive(packet("outsider", 1), 10);
    host.advance(20, true);
    expect(host.state.projectiles).toHaveLength(1);
    expect(host.state.projectiles[0]?.ownerId).toBe("guest");
  });

  it("clears stale firing before declaring the peer disconnected", () => {
    const host = new DuelHost("match", players);
    host.state.phase = "playing";
    connect(host);
    host.receive(packet("guest", 2, { input: { ...EMPTY_INPUT, fire: true } }), 0);
    host.advance(400, true);
    expect(host.state.projectiles).toHaveLength(0);
    expect(host.paused).toBe(false);
  });

  it("pauses on hidden peer or lost transport, resumes without catch-up, and expires", () => {
    const host = new DuelHost("match", players);
    connect(host);
    host.advance(0, true);
    const tick = host.state.tick;
    host.receive(packet("guest", 2, { active: false }), 20);
    host.advance(20, true);
    expect(host.state.tick).toBe(tick);
    connect(host, 500, 3);
    host.advance(500, true);
    expect(host.state.tick).toBe(tick + 1);
    host.advance(501, false);
    host.advance(30502, false);
    expect(host.ended).toContain("Connection lost");
    expect(host.state.score).toEqual([0, 0]);
  });

  it("awards shared hits and finishes first-to-three without mutating sent snapshots", () => {
    const host = new DuelHost("match", players);
    let time = 0;
    let sequence = 0;
    for (let round = 0; round < 3; round++) {
      host.state.phase = "playing";
      host.state.ships[0]!.x = 90;
      host.state.ships[1]!.x = 180;
      for (let i = 0; i < 30 && host.state.phase === "playing"; i++) {
        time += 17;
        sequence++;
        host.receive(packet("host", sequence, { input: { ...EMPTY_INPUT, fire: true } }), time);
        host.receive(packet("guest", sequence), time);
        host.advance(time, true);
      }
      expect(host.state.score[0]).toBe(round + 1);
      const sent = host.snapshot();
      if (round < 2) {
        host.state.phaseTimerMs = 0;
        host.advance(time, true);
        expect(host.state.phase).toBe("countdown");
        expect(sent.state.phase).toBe("round_over");
      }
    }
    expect(host.state.matchWinner).toBe(0);
    expect(host.state.ships[0]!.hits).toBe(3);
    host.receive(packet("host", ++sequence, { rematch: true }), time);
    expect(host.rematchVotes).toEqual(["host"]);
    host.receive(packet("guest", ++sequence, { rematch: true }), time);
    expect(host.rematchVotes).toHaveLength(2);
  });

  it("pauses both pilots on START without treating an intentional pause as a disconnect", () => {
    const host = new DuelHost("match", players);
    connect(host);
    host.advance(0, true);
    const tick = host.state.tick;
    for (let time = 100; time <= 40100; time += 100) {
      host.receive(packet("host", time), time);
      host.receive(packet("guest", time, { paused: true }), time);
      host.advance(time, true);
    }
    expect(host.paused).toBe(true);
    expect(host.state.tick).toBe(tick);
    expect(host.ended).toBe("");
    connect(host, 40200, 40200);
    host.advance(40200, true);
    expect(host.paused).toBe(false);
    expect(host.state.tick).toBe(tick + 1);
  });

  it("rejects malformed wire data", () => {
    expect(isPilotPacket({ ...packet("guest"), input: { fire: "yes" } })).toBe(false);
    expect(isPilotPacket({ ...packet("guest"), sequence: NaN })).toBe(false);
    const host = new DuelHost("match", players);
    const value = host.snapshot();
    value.state.ships[0]!.x = Infinity;
    expect(isDuelSnapshot(value, ["host", "guest"])).toBe(false);
    expect(isDuelSnapshot({ state: {} }, ["host", "guest"])).toBe(false);
  });

  it("keeps Classic turns cardinal and never revives a hit ship", () => {
    const host = new DuelHost("match", players);
    const before = structuredClone(host.state);
    const after = structuredClone(before);
    before.ships[0]!.angle = Math.PI - 0.1;
    after.ships[0]!.angle = -Math.PI + 0.1;
    after.ships[0]!.x += 20;
    after.ships[1]!.alive = false;
    const shown = interpolateDuel(before, after, 0.5);
    expect(shown.ships[0]!.x).toBe(after.ships[0]!.x);
    expect(shown.ships[0]!.angle).toBe(after.ships[0]!.angle);
    expect(shown.ships[1]!.alive).toBe(false);
  });
});
