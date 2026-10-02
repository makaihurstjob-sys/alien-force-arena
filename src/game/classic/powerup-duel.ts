/**
 * Arcade mode: Classic's real 1v1 duel physics (src/game/classic/duel.ts),
 * unmodified in its core rules, with a power-up layer wrapped around it —
 * the same relationship src/game/classic/ranked-duel.ts already has to
 * duel.ts.
 *
 * Pickups, buffs, dash/teleport charges and frozen status live here as
 * external bookkeeping, never inside GameState/Ship, so Classic's own
 * engine, the online duel, and the Ranked experiment are all unaffected.
 *
 * A ship holds at most ONE timed buff at a time (a new pickup replaces the
 * old one) plus a separate teleport charge that stacks independently.
 *
 * Freeze is a loaded shot, not an instant effect: picking it up arms your
 * NEXT fired shot. duel.ts has no notion of "freeze" — we protect the
 * target from elimination for that shot (same protectedIds hook Shield
 * uses) and detect the near-miss ourselves afterward, same technique the
 * old Reflect power-up used. This keeps it skill-gated (you still have to
 * aim and land the shot under the normal one-shot rule) instead of an
 * instant win the moment someone fires at you.
 */

import { createMatch, directionFromAngle, startRound, step, type PlayerSeed } from './duel';
import { CLASSIC, vectors, type Direction } from './engine';
import { PVP_RULES, TICK_MS } from '../config';
import type { GameState, PlayerInput, Ship } from '../types';

export type PowerUpKind = 'shield' | 'freeze' | 'rapidFire' | 'speedBoost' | 'teleport';
type BuffKind = Exclude<PowerUpKind, 'teleport'>;
type Buff = { kind: BuffKind; untilTick: number };
export type Pickup = { id: string; kind: PowerUpKind; x: number; y: number };

export const POWERUP_KINDS: PowerUpKind[] = ['shield', 'freeze', 'rapidFire', 'speedBoost', 'teleport'];

export const POWERUP = {
  spawnIntervalMs: 8000,
  pickupRadius: 14,
  shieldDurationMs: 5000,
  /** How long a loaded freeze charge waits to be fired before it expires unused. */
  freezeLoadedMs: 9000,
  /** How long a landed freeze shot actually locks up its target. */
  freezeStunMs: 1500,
  rapidFireDurationMs: 6000,
  speedBoostDurationMs: 6000,
  speedBoostMultiplier: 1.6,
  /** Instant burst: three full lane cells, in a direction chosen at use-time. */
  teleportCells: 3,
} as const;

export type PowerDuelMatch = {
  game: GameState;
  players: PlayerSeed[];
  pickup: Pickup | null;
  /** state.game.tick at which the next pickup is allowed to spawn. */
  nextSpawnAtTick: number;
  buffs: Map<string, Buff>;
  teleportCharges: Map<string, number>;
  /** Ship ids whose in-flight shot is a loaded freeze shot, armed when they fired. */
  freezeInFlight: Set<string>;
  /** Ship id -> state.game.tick until which that ship is frozen (can't move or act). */
  frozenUntil: Map<string, number>;
};

export function createPowerDuelMatch(players: PlayerSeed[]): PowerDuelMatch {
  return {
    game: createMatch(players),
    players,
    pickup: null,
    nextSpawnAtTick: 0,
    buffs: new Map(),
    teleportCharges: new Map(),
    freezeInFlight: new Set(),
    frozenUntil: new Map(),
  };
}

export function startPowerDuelRound(match: PowerDuelMatch) {
  startRound(match.game, match.players);
  match.pickup = null;
  match.nextSpawnAtTick = match.game.tick;
  match.buffs.clear();
  match.teleportCharges.clear();
  match.freezeInFlight.clear();
  match.frozenUntil.clear();
}

let pickupCounter = 0;

function ticksFor(ms: number): number {
  return Math.round(ms / TICK_MS);
}

function buffDurationMs(kind: BuffKind): number {
  switch (kind) {
    case 'shield':
      return POWERUP.shieldDurationMs;
    case 'freeze':
      return POWERUP.freezeLoadedMs;
    case 'rapidFire':
      return POWERUP.rapidFireDurationMs;
    case 'speedBoost':
      return POWERUP.speedBoostDurationMs;
  }
}

function lane(n: number): number {
  return CLASSIC.margin + n * CLASSIC.spacing;
}

/** Picks the direction from an input's held movement keys, independent of which way the ship currently faces. */
function chosenDirection(input: PlayerInput | undefined): Direction | null {
  if (!input) return null;
  if (input.thrust) return 'up';
  if (input.reverse) return 'down';
  if (input.left) return 'left';
  if (input.right) return 'right';
  return null;
}

const DIRECTION_ANGLE: Record<Direction, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: Math.PI * 1.5 };

/** Instant jump in a freely chosen direction, clamped to the grid. Movement only -- no combat effect. */
function teleportMove(ship: Ship, direction: Direction) {
  const [dx, dy] = vectors[direction];
  const min = CLASSIC.margin;
  const max = CLASSIC.margin + CLASSIC.cells * CLASSIC.spacing;
  const distance = CLASSIC.spacing * POWERUP.teleportCells;
  ship.x = Math.max(min, Math.min(max, ship.x + dx * distance));
  ship.y = Math.max(min, Math.min(max, ship.y + dy * distance));
  ship.angle = DIRECTION_ANGLE[direction];
}

function applyPickup(match: PowerDuelMatch, shipId: string, kind: PowerUpKind) {
  if (kind === 'teleport') {
    match.teleportCharges.set(shipId, 1);
  } else {
    match.buffs.set(shipId, { kind, untilTick: match.game.tick + ticksFor(buffDurationMs(kind)) });
  }
}

function maybeSpawnPickup(match: PowerDuelMatch, rng: () => number) {
  const { game } = match;
  if (match.pickup || game.phase !== 'playing' || game.tick < match.nextSpawnAtTick) return;
  const kind = POWERUP_KINDS[Math.floor(rng() * POWERUP_KINDS.length)]!;
  const i = Math.floor(rng() * (CLASSIC.cells + 1));
  const j = Math.floor(rng() * (CLASSIC.cells + 1));
  match.pickup = { id: `pu${++pickupCounter}`, kind, x: lane(i), y: lane(j) };
}

export function stepPowerDuel(
  match: PowerDuelMatch,
  inputs: Record<string, PlayerInput>,
  rng: () => number = Math.random,
) {
  const { game } = match;

  for (const [id, buff] of [...match.buffs]) if (game.tick >= buff.untilTick) match.buffs.delete(id);
  for (const [id, until] of [...match.frozenUntil]) if (game.tick >= until) match.frozenUntil.delete(id);

  if (game.phase === 'playing') {
    for (const ship of game.ships) {
      if (!ship.alive) continue;
      const input = inputs[ship.id];
      if (input?.dash && (match.teleportCharges.get(ship.id) ?? 0) > 0) {
        const direction = chosenDirection(input) ?? directionFromAngle(ship.angle);
        match.teleportCharges.set(ship.id, 0);
        teleportMove(ship, direction);
      }
    }
  }

  // Rapid Fire bypasses the one-shot gate duel.ts checks at the top of its
  // own ship loop; it recomputes canFire itself from projectile presence at
  // the end of the tick, so this override only affects this tick's gate.
  for (const [id, buff] of match.buffs) {
    if (buff.kind !== 'rapidFire') continue;
    const ship = game.ships.find((s) => s.id === id);
    if (ship?.alive) ship.canFire = true;
  }

  // A ship about to fire its loaded freeze shot this tick -- note it before
  // stepping so we can tell afterward whether it actually launched.
  const armingFreeze = new Set<string>();
  for (const [id, buff] of match.buffs) {
    if (buff.kind === 'freeze' && game.ships.find((s) => s.id === id)?.canFire) armingFreeze.add(id);
  }

  const protectedIds = new Set<string>();
  const speedMultiplier: Record<string, number> = {};
  for (const [id, buff] of match.buffs) {
    if (buff.kind === 'shield') protectedIds.add(id);
    if (buff.kind === 'speedBoost') speedMultiplier[id] = POWERUP.speedBoostMultiplier;
  }
  // Protect the intended target of any in-flight freeze shot from being
  // eliminated by it -- duel.ts doesn't know about freeze, it just won't
  // find a target for this shot, same as it already does for Shield.
  for (const shooterId of match.freezeInFlight) {
    const opponent = game.ships.find((s) => s.id !== shooterId);
    if (opponent) protectedIds.add(opponent.id);
  }

  const frozenIds = new Set(match.frozenUntil.keys());
  step(game, inputs, { roundsToWin: PVP_RULES.roundsToWinMatch, protectedIds, speedMultiplier, frozenIds });

  // A freeze buff ship that just fired launches its loaded shot; consume the buff now.
  for (const id of armingFreeze) {
    if (game.events.some((e) => e.type === 'shot' && e.playerId === id)) {
      match.buffs.delete(id);
      match.freezeInFlight.add(id);
    }
  }

  // Resolve in-flight freeze shots: either they just landed near the
  // protected opponent (apply the freeze, unless Shield blocks it), or the
  // shooter's shot has resolved some other way (expired/out of bounds) --
  // either way the association ends here.
  for (const shooterId of [...match.freezeInFlight]) {
    const shooter = game.ships.find((s) => s.id === shooterId);
    const opponent = game.ships.find((s) => s.id !== shooterId);
    if (!shooter || !opponent) {
      match.freezeInFlight.delete(shooterId);
      continue;
    }
    const incoming = game.projectiles.find(
      (p) => p.ownerId === shooterId && Math.hypot(opponent.x - p.x, opponent.y - p.y) < 9,
    );
    if (incoming) {
      game.projectiles = game.projectiles.filter((p) => p.id !== incoming.id);
      const opponentShield = match.buffs.get(opponent.id);
      if (!(opponentShield?.kind === 'shield' && game.tick < opponentShield.untilTick)) {
        match.frozenUntil.set(opponent.id, game.tick + ticksFor(POWERUP.freezeStunMs));
        game.events.push({ type: 'hit', playerId: shooterId, targetId: opponent.id, tick: game.tick });
      }
      match.freezeInFlight.delete(shooterId);
    } else if (shooter.canFire) {
      // the shot resolved without reaching the opponent (expired or left the arena)
      match.freezeInFlight.delete(shooterId);
    }
  }

  if (match.pickup) {
    for (const ship of game.ships) {
      if (!ship.alive) continue;
      if (Math.hypot(ship.x - match.pickup.x, ship.y - match.pickup.y) >= POWERUP.pickupRadius) continue;
      applyPickup(match, ship.id, match.pickup.kind);
      match.pickup = null;
      match.nextSpawnAtTick = game.tick + ticksFor(POWERUP.spawnIntervalMs);
      break;
    }
  }
  maybeSpawnPickup(match, rng);
}
