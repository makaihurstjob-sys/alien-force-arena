/**
 * Arcade mode: Classic's real 1v1 duel physics (src/game/classic/duel.ts),
 * unmodified, with a power-up layer wrapped around it — the same
 * relationship src/game/classic/ranked-duel.ts already has to duel.ts.
 *
 * Pickups, buffs and dash charges live here as external bookkeeping, never
 * inside GameState/Ship, so Classic's own engine, the online duel, and the
 * Ranked experiment are all unaffected.
 *
 * A ship holds at most ONE timed buff at a time (a new pickup replaces the
 * old one) plus a separate dash charge that stacks independently.
 *
 * Shield and Rapid Fire/Speed Boost differ from Reflect on purpose: Shield
 * is a short full-invulnerability window (shots simply find no valid target
 * and fly past), while Reflect is a single consumed use that also punishes
 * the shooter — two meaningfully different defensive tools, not the same
 * mechanic with different numbers.
 */

import { createMatch, directionFromAngle, startRound, step, type PlayerSeed } from './duel';
import { CLASSIC, vectors } from './engine';
import { PVP_RULES, TICK_MS } from '../config';
import type { GameState, PlayerInput, Ship } from '../types';

export type PowerUpKind = 'shield' | 'reflect' | 'rapidFire' | 'speedBoost' | 'dash';
type BuffKind = Exclude<PowerUpKind, 'dash'>;
type Buff = { kind: BuffKind; untilTick: number };
export type Pickup = { id: string; kind: PowerUpKind; x: number; y: number };

export const POWERUP_KINDS: PowerUpKind[] = ['shield', 'reflect', 'rapidFire', 'speedBoost', 'dash'];

export const POWERUP = {
  spawnIntervalMs: 8000,
  pickupRadius: 14,
  shieldDurationMs: 5000,
  reflectDurationMs: 9000,
  rapidFireDurationMs: 6000,
  speedBoostDurationMs: 6000,
  speedBoostMultiplier: 1.6,
  /** Instant burst: two full lane cells along the ship's current facing direction. */
  dashCells: 2,
} as const;

export type PowerDuelMatch = {
  game: GameState;
  players: PlayerSeed[];
  pickup: Pickup | null;
  /** state.game.tick at which the next pickup is allowed to spawn. */
  nextSpawnAtTick: number;
  buffs: Map<string, Buff>;
  dashCharges: Map<string, number>;
};

export function createPowerDuelMatch(players: PlayerSeed[]): PowerDuelMatch {
  return {
    game: createMatch(players),
    players,
    pickup: null,
    nextSpawnAtTick: 0,
    buffs: new Map(),
    dashCharges: new Map(),
  };
}

export function startPowerDuelRound(match: PowerDuelMatch) {
  startRound(match.game, match.players);
  match.pickup = null;
  match.nextSpawnAtTick = match.game.tick;
  match.buffs.clear();
  match.dashCharges.clear();
}

let pickupCounter = 0;

function ticksFor(ms: number): number {
  return Math.round(ms / TICK_MS);
}

function buffDurationMs(kind: BuffKind): number {
  switch (kind) {
    case 'shield':
      return POWERUP.shieldDurationMs;
    case 'reflect':
      return POWERUP.reflectDurationMs;
    case 'rapidFire':
      return POWERUP.rapidFireDurationMs;
    case 'speedBoost':
      return POWERUP.speedBoostDurationMs;
  }
}

function lane(n: number): number {
  return CLASSIC.margin + n * CLASSIC.spacing;
}

/** A straight continuation of the ship's current travel axis, so it can never break lane alignment. */
function dashMove(ship: Ship) {
  const direction = directionFromAngle(ship.angle);
  const [dx, dy] = vectors[direction];
  const min = CLASSIC.margin;
  const max = CLASSIC.margin + CLASSIC.cells * CLASSIC.spacing;
  const distance = CLASSIC.spacing * POWERUP.dashCells;
  ship.x = Math.max(min, Math.min(max, ship.x + dx * distance));
  ship.y = Math.max(min, Math.min(max, ship.y + dy * distance));
}

function applyPickup(match: PowerDuelMatch, shipId: string, kind: PowerUpKind) {
  if (kind === 'dash') {
    match.dashCharges.set(shipId, 1);
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

  if (game.phase === 'playing') {
    for (const ship of game.ships) {
      if (!ship.alive) continue;
      const input = inputs[ship.id];
      if (input?.dash && (match.dashCharges.get(ship.id) ?? 0) > 0) {
        match.dashCharges.set(ship.id, 0);
        dashMove(ship);
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

  const protectedIds = new Set<string>();
  const speedMultiplier: Record<string, number> = {};
  for (const [id, buff] of match.buffs) {
    if (buff.kind === 'shield' || buff.kind === 'reflect') protectedIds.add(id);
    if (buff.kind === 'speedBoost') speedMultiplier[id] = POWERUP.speedBoostMultiplier;
  }

  step(game, inputs, { roundsToWin: PVP_RULES.roundsToWinMatch, protectedIds, speedMultiplier });

  // Reflect: duel.ts already skipped this ship as a kill target (protectedIds
  // above), so any projectile still this close to it only survived because
  // of that skip. Redirect the kill onto the shooter instead.
  for (const [id, buff] of match.buffs) {
    if (buff.kind !== 'reflect') continue;
    const ship = game.ships.find((s) => s.id === id);
    if (!ship?.alive) continue;
    const incoming = game.projectiles.find(
      (p) => p.ownerId !== id && Math.hypot(ship.x - p.x, ship.y - p.y) < 9,
    );
    if (!incoming) continue;
    game.projectiles = game.projectiles.filter((p) => p.id !== incoming.id);
    const shooter = game.ships.find((s) => s.id === incoming.ownerId);
    if (shooter) {
      shooter.alive = false;
      ship.hits++;
      game.events.push(
        { type: 'hit', playerId: ship.id, targetId: shooter.id, tick: game.tick },
        { type: 'elimination', playerId: shooter.id, byId: ship.id, tick: game.tick },
      );
    }
    match.buffs.delete(id);
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
