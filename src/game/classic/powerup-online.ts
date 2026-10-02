/**
 * Online transport for Arcade, mirroring src/game/online.ts's DuelHost
 * pattern exactly (host-simulated, peer-trusted, Realtime Broadcast) but
 * driving the powerup-duel wrapper instead of plain Classic duel physics.
 *
 * Maps (buffs, teleportCharges, frozenUntil) don't survive JSON over the
 * wire, so the snapshot represents them as plain objects and PowerDuelHost
 * converts back to a real PowerDuelMatch for rendering on receipt.
 */

import { EMPTY_INPUT, type GameState } from "../types";
import { isPilotPacket, interpolateDuel, type PilotPacket } from "../online";
import type { PlayerSeed } from "./duel";
import {
  createPowerDuelMatch,
  startPowerDuelRound,
  stepPowerDuel,
  type Pickup,
  type PowerDuelMatch,
  type PowerUpKind,
} from "./powerup-duel";

export { type PilotPacket, isPilotPacket };
export const PEER_TIMEOUT_MS = 1500;
export const INPUT_TIMEOUT_MS = 350;
export const DISCONNECT_LIMIT_MS = 30000;

type BuffKind = Exclude<PowerUpKind, "teleport">;

export type PowerDuelSnapshot = {
  matchId: string;
  sequence: number;
  game: GameState;
  pickup: Pickup | null;
  buffs: Record<string, { kind: BuffKind; untilTick: number }>;
  teleportCharges: Record<string, number>;
  frozenUntil: Record<string, number>;
  paused: boolean;
  ended: string;
  rematch: string[];
};

/** Reconstructs a renderable PowerDuelMatch (with real Maps) from a wire snapshot. */
export function matchFromSnapshot(snapshot: PowerDuelSnapshot, players: PlayerSeed[]): PowerDuelMatch {
  return {
    game: snapshot.game,
    players,
    pickup: snapshot.pickup,
    nextSpawnAtTick: 0,
    buffs: new Map(Object.entries(snapshot.buffs)),
    teleportCharges: new Map(Object.entries(snapshot.teleportCharges)),
    freezeInFlight: new Set(),
    frozenUntil: new Map(Object.entries(snapshot.frozenUntil)),
  };
}

export function isPowerDuelSnapshot(value: unknown, players: string[]): value is PowerDuelSnapshot {
  if (!value || typeof value !== "object") return false;
  const p = value as PowerDuelSnapshot;
  const s = p.game;
  return (
    typeof p.matchId === "string" &&
    Number.isSafeInteger(p.sequence) &&
    p.sequence >= 0 &&
    typeof p.paused === "boolean" &&
    typeof p.ended === "string" &&
    Array.isArray(p.rematch) &&
    p.rematch.every((id) => players.includes(id)) &&
    !!p.buffs &&
    typeof p.buffs === "object" &&
    !!p.teleportCharges &&
    typeof p.teleportCharges === "object" &&
    !!p.frozenUntil &&
    typeof p.frozenUntil === "object" &&
    (p.pickup === null ||
      (!!p.pickup && typeof p.pickup.x === "number" && typeof p.pickup.y === "number")) &&
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
    // Rapid Fire can hold several own shots at once, unlike the plain duel's cap of one each.
    s.projectiles.length <= 200 &&
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

/** The room host is the sole simulation owner for this unranked prototype. */
export class PowerDuelHost {
  match: PowerDuelMatch;
  paused = true;
  ended = "";
  private missingSince: number | null = null;
  private peers = new Map<string, { packet: PilotPacket; receivedAt: number }>();
  private sequence = 0;

  constructor(
    readonly matchId: string,
    readonly players: PlayerSeed[],
  ) {
    this.match = createPowerDuelMatch(players);
  }

  receive(packet: PilotPacket, now: number) {
    if (
      !isPilotPacket(packet) ||
      packet.matchId !== this.matchId ||
      !this.players.some((p) => p.id === packet.playerId)
    )
      return;
    const previous = this.peers.get(packet.playerId)?.packet;
    if (previous && previous.instance === packet.instance && previous.sequence >= packet.sequence)
      return;
    this.peers.set(packet.playerId, { packet: structuredClone(packet), receivedAt: now });
  }

  advance(now: number, connected: boolean) {
    if (this.ended) return;
    const disconnected =
      !connected ||
      this.players.some((p) => {
        const peer = this.peers.get(p.id);
        return !peer || !peer.packet.active || now - peer.receivedAt > PEER_TIMEOUT_MS;
      });
    this.paused = disconnected || this.players.some((p) => this.peers.get(p.id)?.packet.paused);
    if (this.paused && !disconnected) {
      this.missingSince = null;
      return;
    }
    if (this.paused) {
      this.missingSince ??= now;
      if (now - this.missingSince >= DISCONNECT_LIMIT_MS)
        this.ended = "Connection lost. Return to the room to start a new match.";
      return;
    }
    this.missingSince = null;
    if (this.match.game.matchWinner !== null) return;
    if (this.match.game.phase === "round_over" && this.match.game.phaseTimerMs <= 0) {
      startPowerDuelRound(this.match);
    }
    const inputs = Object.fromEntries(
      this.players.map((p) => {
        const peer = this.peers.get(p.id)!;
        return [p.id, now - peer.receivedAt <= INPUT_TIMEOUT_MS ? peer.packet.input : EMPTY_INPUT];
      }),
    );
    stepPowerDuel(this.match, inputs);
  }

  get rematchVotes() {
    return this.players.filter((p) => this.peers.get(p.id)?.packet.rematch).map((p) => p.id);
  }

  snapshot(): PowerDuelSnapshot {
    return {
      matchId: this.matchId,
      sequence: ++this.sequence,
      game: structuredClone(this.match.game),
      pickup: this.match.pickup ? { ...this.match.pickup } : null,
      buffs: Object.fromEntries(this.match.buffs),
      teleportCharges: Object.fromEntries(this.match.teleportCharges),
      frozenUntil: Object.fromEntries(this.match.frozenUntil),
      paused: this.paused,
      ended: this.ended,
      rematch: this.rematchVotes,
    };
  }
}

/** Interpolate positions only; hits, scores, buffs and pickups always come from the host. */
export function interpolatePowerDuel(
  previous: PowerDuelSnapshot | null,
  next: PowerDuelSnapshot,
  amount: number,
): PowerDuelMatch {
  const game = interpolateDuel(previous?.game ?? null, next.game, amount);
  return {
    game,
    players: [],
    pickup: next.pickup,
    nextSpawnAtTick: 0,
    buffs: new Map(Object.entries(next.buffs)),
    teleportCharges: new Map(Object.entries(next.teleportCharges)),
    freezeInFlight: new Set(),
    frozenUntil: new Map(Object.entries(next.frozenUntil)),
  };
}
