import { createMatch, startRound, step, type PlayerSeed } from "./classic/duel";
import { EMPTY_INPUT, type GameState, type PlayerInput } from "./types";

export const PEER_TIMEOUT_MS = 1500;
export const INPUT_TIMEOUT_MS = 350;
export const DISCONNECT_LIMIT_MS = 30000;
export const DUEL_LAYOUT = "classic";

export type PilotPacket = {
  playerId: string;
  instance: string;
  sequence: number;
  active: boolean;
  paused?: boolean;
  input: PlayerInput;
  matchId: string | null;
  rematch: boolean;
  returnFrom: string | null;
};
export type DuelSnapshot = {
  matchId: string;
  sequence: number;
  state: GameState;
  paused: boolean;
  ended: string;
  rematch: string[];
};

export function isPilotPacket(value: unknown): value is PilotPacket {
  if (!value || typeof value !== "object") return false;
  const p = value as PilotPacket;
  return (
    typeof p.playerId === "string" &&
    typeof p.instance === "string" &&
    Number.isSafeInteger(p.sequence) &&
    p.sequence >= 0 &&
    typeof p.active === "boolean" &&
    (p.paused === undefined || typeof p.paused === "boolean") &&
    typeof p.rematch === "boolean" &&
    (p.matchId === null || typeof p.matchId === "string") &&
    (p.returnFrom === null || typeof p.returnFrom === "string") &&
    !!p.input &&
    (p.input.turnaround === undefined || typeof p.input.turnaround === "boolean") &&
    Object.keys(EMPTY_INPUT).every((k) => typeof p.input[k as keyof PlayerInput] === "boolean")
  );
}

export function isDuelSnapshot(value: unknown, players: string[]): value is DuelSnapshot {
  if (!value || typeof value !== "object") return false;
  const p = value as DuelSnapshot;
  const s = p.state;
  const seats = Array.isArray(s?.ships) ? s.ships.map(ship => ship?.team) : [];
  return (
    typeof p.matchId === "string" &&
    Number.isSafeInteger(p.sequence) &&
    p.sequence >= 0 &&
    typeof p.paused === "boolean" &&
    typeof p.ended === "string" &&
    Array.isArray(p.rematch) &&
    p.rematch.every((id) => players.includes(id)) &&
    !!s &&
    Number.isSafeInteger(s.tick) &&
    Number.isSafeInteger(s.round) &&
    Number.isFinite(s.phaseTimerMs) &&
    ["countdown", "playing", "round_over"].includes(s.phase) &&
    [null, ...seats].includes(s.matchWinner) &&
    [null, ...seats].includes(s.lastRoundWinner) &&
    Array.isArray(s.score) &&
    s.score.length >= 2 && s.score.length <= 4 &&
    s.score.every((n) => Number.isSafeInteger(n) && n >= 0) &&
    Array.isArray(s.ships) &&
    s.ships.length >= 2 && s.ships.length <= 4 && s.ships.length === players.length &&
    s.ships.every((ship) => !!ship) &&
    new Set(s.ships.map((ship) => ship.id)).size === players.length &&
    new Set(seats).size === players.length &&
    s.ships.every(
      (ship) =>
        players.includes(ship.id) &&
        Number.isInteger(ship.team) && ship.team >= 0 && ship.team < s.score.length &&
        typeof ship.name === "string" &&
        typeof ship.alive === "boolean" &&
        typeof ship.canFire === "boolean" &&
        [ship.x, ship.y, ship.vx, ship.vy, ship.angle, ship.shots, ship.hits].every(
          Number.isFinite,
        ),
    ) &&
    Array.isArray(s.projectiles) &&
    s.projectiles.length <= players.length &&
    s.projectiles.every(
      (shot) =>
        !!shot &&
        players.includes(shot.ownerId) &&
        typeof shot.id === "string" &&
        s.ships.some(ship => ship.id === shot.ownerId && ship.team === shot.team) &&
        [shot.x, shot.y, shot.vx, shot.vy, shot.ageMs].every(Number.isFinite),
    ) &&
    Array.isArray(s.events)
  );
}

/** The room host is the sole simulation owner for this unranked prototype. */
export class DuelHost {
  state: GameState;
  paused = true;
  ended = "";
  private missingSince: number | null = null;
  private peers = new Map<string, { packet: PilotPacket; receivedAt: number }>();
  private sequence = 0;

  constructor(
    readonly matchId: string,
    readonly players: PlayerSeed[],
    mode: "1v1" | "ffa" = "1v1",
  ) {
    this.state = createMatch(players);
    this.state.mode = mode;
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
    this.paused = disconnected || this.players.some(p => this.peers.get(p.id)?.packet.paused);
    if (this.paused && !disconnected) { this.missingSince = null; return; }
    if (this.paused) {
      this.missingSince ??= now;
      if (now - this.missingSince >= DISCONNECT_LIMIT_MS)
        this.ended = "Connection lost. Return to the room to start a new match.";
      return;
    }
    this.missingSince = null;
    if (this.state.matchWinner !== null) return;
    if (this.state.phase === "round_over" && this.state.phaseTimerMs <= 0) {
      startRound(this.state, this.players);
    }
    const inputs = Object.fromEntries(
      this.players.map((p) => {
        const peer = this.peers.get(p.id)!;
        return [p.id, now - peer.receivedAt <= INPUT_TIMEOUT_MS ? peer.packet.input : EMPTY_INPUT];
      }),
    );
    step(this.state, inputs);
  }

  get rematchVotes() {
    return this.players.filter((p) => this.peers.get(p.id)?.packet.rematch).map((p) => p.id);
  }

  snapshot(): DuelSnapshot {
    return {
      matchId: this.matchId,
      sequence: ++this.sequence,
      state: structuredClone(this.state),
      paused: this.paused,
      ended: this.ended,
      rematch: this.rematchVotes,
    };
  }
}

/** Interpolate positions only; hits, scores and shot ownership always come from the host. */
export function interpolateDuel(
  previous: GameState | null,
  next: GameState,
  amount: number,
): GameState {
  if (!previous || previous.round !== next.round || previous.phase !== next.phase) return next;
  const t = Math.max(0, Math.min(1, amount));
  return {
    ...next,
    ships: next.ships.map((ship) => {
      const before = previous.ships.find((s) => s.id === ship.id);
      if (!before || !before.alive || !ship.alive) return ship;
      if (ship.angle !== before.angle) return ship;
      return {
        ...ship,
        x: before.x + (ship.x - before.x) * t,
        y: before.y + (ship.y - before.y) * t,
        angle: ship.angle,
      };
    }),
    projectiles: next.projectiles.map((shot) => {
      const before = previous.projectiles.find((p) => p.id === shot.id);
      return before
        ? { ...shot, x: before.x + (shot.x - before.x) * t, y: before.y + (shot.y - before.y) * t }
        : shot;
    }),
  };
}
