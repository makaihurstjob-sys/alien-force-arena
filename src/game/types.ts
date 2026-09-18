/** Shared game types. Used by the client renderer and (later) the server. */

export type PlayerInput = {
  turnaround?: boolean;
  thrust: boolean;
  reverse: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
};

export const EMPTY_INPUT: PlayerInput = {
  thrust: false,
  reverse: false,
  left: false,
  right: false,
  fire: false,
};

export type Ship = {
  id: string;
  name: string;
  team: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  alive: boolean;
  /** true when this player has no projectile in play (the one-shot rule) */
  canFire: boolean;
  shots: number;
  hits: number;
  turnaroundHeld?: boolean;
};

export type Projectile = {
  id: string;
  ownerId: string;
  team: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageMs: number;
};

export type GameEvent =
  | { type: "shot"; playerId: string; tick: number }
  | { type: "hit"; playerId: string; targetId: string; tick: number }
  | { type: "elimination"; playerId: string; byId: string | null; tick: number }
  | { type: "round_end"; winningTeam: number | null; tick: number };

export type RoundPhase = "countdown" | "playing" | "round_over";

export type GameState = {
  mode?: "1v1" | "ffa";
  tick: number;
  phase: RoundPhase;
  phaseTimerMs: number;
  ships: Ship[];
  projectiles: Projectile[];
  round: number;
  score: [number, number, ...number[]];
  lastRoundWinner: number | null;
  matchWinner: number | null;
  events: GameEvent[];
};
