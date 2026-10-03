import { createRankedMatch, stepRankedMatch, type RankedMatch } from "./classic/ranked-duel";
import type { PlayerSeed } from "./classic/duel";
import { EMPTY_INPUT, type GameState, type PlayerInput } from "./types";
import type { RankedFormat } from "../lib/ranked-rules";

/**
 * Authoritative ranked transport. Unlike online.ts's DuelHost (a browser peer
 * trusted only for unranked play), this host is meant to run inside the
 * trusted ranked-server process: it is the sole source of truth and the only
 * thing allowed to decide a ranked result.
 */

export const RANKED_PEER_TIMEOUT_MS = 1500;
export const RANKED_INPUT_TIMEOUT_MS = 350;
export const RANKED_DISCONNECT_LIMIT_MS = 30000;
export const RANKED_SNAPSHOT_INTERVAL_MS = 50;

export type RankedPacket = {
  playerId: string;
  instance: string;
  sequence: number;
  active: boolean;
  paused?: boolean;
  input: PlayerInput;
  matchId: string;
};

export type RankedResult = { winner: 0 | 1 | null; loserScore: number; disconnect: boolean };

export type RankedSnapshot = {
  matchId: string;
  sequence: number;
  state: GameState;
  paused: boolean;
  ended: string;
  result: RankedResult | null;
};

export function isRankedPacket(value: unknown): value is RankedPacket {
  if (!value || typeof value !== "object") return false;
  const p = value as RankedPacket;
  return (
    typeof p.playerId === "string" &&
    typeof p.instance === "string" &&
    Number.isSafeInteger(p.sequence) &&
    p.sequence >= 0 &&
    typeof p.active === "boolean" &&
    (p.paused === undefined || typeof p.paused === "boolean") &&
    typeof p.matchId === "string" &&
    !!p.input &&
    (p.input.turnaround === undefined || typeof p.input.turnaround === "boolean") &&
    Object.keys(EMPTY_INPUT).every((k) => typeof p.input[k as keyof PlayerInput] === "boolean")
  );
}

function isRankedResult(value: unknown): value is RankedResult | null {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const r = value as RankedResult;
  return (
    [0, 1, null].includes(r.winner) &&
    Number.isSafeInteger(r.loserScore) &&
    r.loserScore >= 0 &&
    r.loserScore <= 3 &&
    typeof r.disconnect === "boolean"
  );
}

export function isRankedSnapshot(value: unknown, players: string[]): value is RankedSnapshot {
  if (!value || typeof value !== "object") return false;
  const p = value as RankedSnapshot;
  const s = p.state;
  return (
    typeof p.matchId === "string" &&
    Number.isSafeInteger(p.sequence) &&
    p.sequence >= 0 &&
    typeof p.paused === "boolean" &&
    typeof p.ended === "string" &&
    isRankedResult(p.result) &&
    !!s &&
    Number.isSafeInteger(s.tick) &&
    Number.isSafeInteger(s.round) &&
    Number.isFinite(s.phaseTimerMs) &&
    ["countdown", "playing", "round_over"].includes(s.phase) &&
    [null, 0, 1].includes(s.matchWinner) &&
    [null, 0, 1].includes(s.lastRoundWinner) &&
    Array.isArray(s.score) &&
    s.score.length === 2 &&
    s.score.every((n) => Number.isSafeInteger(n) && n >= 0) &&
    Array.isArray(s.ships) &&
    s.ships.length === 2 &&
    s.ships.every((ship) => !!ship) &&
    new Set(s.ships.map((ship) => ship.id)).size === 2 &&
    s.ships.every(
      (ship) =>
        players.includes(ship.id) &&
        [0, 1].includes(ship.team) &&
        typeof ship.name === "string" &&
        typeof ship.alive === "boolean" &&
        typeof ship.canFire === "boolean" &&
        [ship.x, ship.y, ship.vx, ship.vy, ship.angle, ship.shots, ship.hits].every(
          Number.isFinite,
        ),
    ) &&
    Array.isArray(s.projectiles) &&
    s.projectiles.length <= 2 &&
    s.projectiles.every(
      (shot) =>
        !!shot &&
        players.includes(shot.ownerId) &&
        typeof shot.id === "string" &&
        [0, 1].includes(shot.team) &&
        [shot.x, shot.y, shot.vx, shot.vy, shot.ageMs].every(Number.isFinite),
    ) &&
    Array.isArray(s.events)
  );
}

/** The trusted server is the sole simulation owner. It decides the result; no client ever does. */
export class RankedHost {
  match: RankedMatch;
  paused = true;
  ended = "";
  result: RankedResult | null = null;
  private peers = new Map<string, { packet: RankedPacket; receivedAt: number }>();
  private missingSince = new Map<string, number>();
  private sequence = 0;

  constructor(
    readonly matchId: string,
    readonly players: PlayerSeed[],
    readonly format: RankedFormat,
  ) {
    this.match = createRankedMatch(players, format);
  }

  receive(packet: RankedPacket, now: number) {
    if (
      !isRankedPacket(packet) ||
      packet.matchId !== this.matchId ||
      !this.players.some((p) => p.id === packet.playerId)
    )
      return;
    const previous = this.peers.get(packet.playerId)?.packet;
    if (previous && previous.instance === packet.instance && previous.sequence >= packet.sequence)
      return;
    this.peers.set(packet.playerId, { packet: structuredClone(packet), receivedAt: now });
  }

  /** A specific player's score at forfeit time is always 0-3: reaching 4 already ends the match. */
  private forfeit(playerId: string) {
    const team = this.players.find((p) => p.id === playerId)!.team;
    const winner = (team === 0 ? 1 : 0) as 0 | 1;
    const loserScore = Math.max(0, Math.min(3, this.match.game.score[team] ?? 0));
    this.result = { winner, loserScore, disconnect: true };
    this.ended = "Connection lost. This match was forfeited.";
  }

  advance(now: number) {
    if (this.ended) return;
    const staleness = this.players.map((p) => {
      const peer = this.peers.get(p.id);
      const stale = !peer || !peer.packet.active || now - peer.receivedAt > RANKED_PEER_TIMEOUT_MS;
      return { id: p.id, stale };
    });
    for (const entry of staleness) {
      if (entry.stale) {
        if (!this.missingSince.has(entry.id)) this.missingSince.set(entry.id, now);
      } else this.missingSince.delete(entry.id);
    }
    const forfeited = staleness.find(
      (entry) =>
        entry.stale && now - this.missingSince.get(entry.id)! >= RANKED_DISCONNECT_LIMIT_MS,
    );
    if (forfeited) {
      this.forfeit(forfeited.id);
      return;
    }
    if (staleness.some((entry) => entry.stale)) {
      this.paused = true;
      return;
    }
    this.paused = this.players.some((p) => this.peers.get(p.id)?.packet.paused);
    if (this.paused) return;
    if (this.match.game.matchWinner !== null || this.match.draw) return;
    const inputs = Object.fromEntries(
      this.players.map((p) => {
        const peer = this.peers.get(p.id)!;
        return [
          p.id,
          now - peer.receivedAt <= RANKED_INPUT_TIMEOUT_MS ? peer.packet.input : EMPTY_INPUT,
        ];
      }),
    );
    stepRankedMatch(this.match, inputs);
    if (this.match.draw) {
      this.result = { winner: null, loserScore: 0, disconnect: false };
      this.ended = "Match complete.";
    } else if (this.match.game.matchWinner !== null) {
      const winner = this.match.game.matchWinner;
      const loserScore = Math.max(0, Math.min(3, this.match.game.score[winner === 0 ? 1 : 0] ?? 0));
      this.result = { winner, loserScore, disconnect: false };
      this.ended = "Match complete.";
    }
  }

  snapshot(): RankedSnapshot {
    return {
      matchId: this.matchId,
      sequence: ++this.sequence,
      state: structuredClone(this.match.game),
      paused: this.paused,
      ended: this.ended,
      result: this.result,
    };
  }
}
