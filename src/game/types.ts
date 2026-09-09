/** Shared game types. Used by the client renderer and (later) the server. */

export type PlayerInput = {
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
  team: 0 | 1;
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
};

export type Projectile = {
  id: string;
  ownerId: string;
  team: 0 | 1;
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
  | { type: "round_end"; winningTeam: 0 | 1 | null; tick: number };

export type RoundPhase = "countdown" | "playing" | "round_over";

export type GameState = {
  tick: number;
  phase: RoundPhase;
  phaseTimerMs: number;
  ships: Ship[];
  projectiles: Projectile[];
  round: number;
  score: [number, number];
  lastRoundWinner: 0 | 1 | null;
  matchWinner: 0 | 1 | null;
  events: GameEvent[];
};
