/**
 * Authoritative game simulation.
 *
 * This module is pure: it takes a state + a map of player inputs and advances
 * one fixed tick. The same file runs in the browser for local practice and on
 * the authoritative server for online play, so both agree on the rules.
 *
 * Key rule: ONE ACTIVE PROJECTILE PER PLAYER. A player's `canFire` flag is
 * false while their projectile exists, and only becomes true again when that
 * projectile hits something, hits a wall/obstacle, or expires.
 */

import { ARENA, ARENA_LAYOUTS, PROJECTILE, PVP_RULES, SHIP, TICK_MS, type ArenaLayout } from "./config";
import type { GameEvent, GameState, PlayerInput, Projectile, Ship } from "./types";

export type PlayerSeed = { id: string; name: string; team: 0 | 1 };

export function getLayout(layoutId: string): ArenaLayout {
  return ARENA_LAYOUTS.find((l) => l.id === layoutId) ?? ARENA_LAYOUTS[0]!;
}

export function createMatch(players: PlayerSeed[], layoutId = "cross"): GameState {
  const state: GameState = {
    tick: 0,
    phase: "countdown",
    phaseTimerMs: PVP_RULES.countdownSeconds * 1000,
    ships: [],
    projectiles: [],
    round: 1,
    score: [0, 0],
    lastRoundWinner: null,
    matchWinner: null,
    events: [],
  };
  spawnShips(state, players, layoutId);
  return state;
}

export function startRound(state: GameState, players: PlayerSeed[], layoutId: string) {
  state.projectiles = [];
  state.phase = "countdown";
  state.phaseTimerMs = PVP_RULES.countdownSeconds * 1000;
  state.lastRoundWinner = null;
  spawnShips(state, players, layoutId);
}

function spawnShips(state: GameState, players: PlayerSeed[], layoutId: string) {
  const layout = getLayout(layoutId);
  const usedPerTeam: Record<number, number> = { 0: 0, 1: 0 };
  const existing = new Map(state.ships.map((s) => [s.id, s]));

  state.ships = players.map((p) => {
    const teamSpawns = layout.spawns.filter((s) => s.team === p.team);
    const spawn = teamSpawns[usedPerTeam[p.team]! % teamSpawns.length]!;
    usedPerTeam[p.team]!++;
    const prev = existing.get(p.id);
    return {
      id: p.id,
      name: p.name,
      team: p.team,
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      angle: spawn.angle,
      alive: true,
      canFire: true,
      // cumulative match stats survive between rounds
      shots: prev?.shots ?? 0,
      hits: prev?.hits ?? 0,
    } satisfies Ship;
  });
}

let projectileCounter = 0;

/** Advance the simulation by exactly one tick. Mutates and returns state. */
export function step(
  state: GameState,
  inputs: Record<string, PlayerInput>,
  layoutId = "cross",
): GameState {
  const layout = getLayout(layoutId);
  const dt = TICK_MS / 1000;
  state.tick++;
  state.events = [];

  if (state.phase === "countdown") {
    state.phaseTimerMs -= TICK_MS;
    if (state.phaseTimerMs <= 0) {
      state.phase = "playing";
      state.phaseTimerMs = PVP_RULES.roundTimeLimitSeconds * 1000;
    }
    return state;
  }

  if (state.phase === "round_over") {
    state.phaseTimerMs -= TICK_MS;
    return state;
  }

  state.phaseTimerMs -= TICK_MS;

  // --- ships ---
  for (const ship of state.ships) {
    if (!ship.alive) continue;
    const input = inputs[ship.id];
    if (input) {
      if (input.left) ship.angle -= SHIP.turnRate * dt;
      if (input.right) ship.angle += SHIP.turnRate * dt;
      if (input.thrust) {
        ship.vx += Math.cos(ship.angle) * SHIP.accel * dt;
        ship.vy += Math.sin(ship.angle) * SHIP.accel * dt;
      }
      if (input.reverse) {
        ship.vx -= Math.cos(ship.angle) * SHIP.reverseAccel * dt;
        ship.vy -= Math.sin(ship.angle) * SHIP.reverseAccel * dt;
      }
      if (input.fire && ship.canFire) fireProjectile(state, ship);
    }

    // friction + speed clamp
    const damp = Math.max(0, 1 - SHIP.friction * dt);
    ship.vx *= damp;
    ship.vy *= damp;
    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > SHIP.maxSpeed) {
      ship.vx = (ship.vx / speed) * SHIP.maxSpeed;
      ship.vy = (ship.vy / speed) * SHIP.maxSpeed;
    }

    // move on each axis separately so we can slide along obstacles
    moveShipAxis(ship, layout, ship.vx * dt, 0);
    moveShipAxis(ship, layout, 0, ship.vy * dt);
  }

  // --- projectiles ---
  for (const p of [...state.projectiles]) {
    p.ageMs += TICK_MS;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    let dead = false;

    if (p.ageMs >= PROJECTILE.lifetimeMs) dead = true;

    if (!dead && outOfBounds(p)) {
      if (PROJECTILE.bouncesOffWalls) {
        if (p.x < 0 || p.x > ARENA.width) p.vx *= -1;
        if (p.y < 0 || p.y > ARENA.height) p.vy *= -1;
        p.x = clamp(p.x, 0, ARENA.width);
        p.y = clamp(p.y, 0, ARENA.height);
      } else {
        dead = true;
      }
    }

    if (!dead && hitsObstacle(p.x, p.y, PROJECTILE.radius, layout)) dead = true;

    if (!dead) {
      for (const ship of state.ships) {
        if (!ship.alive || ship.id === p.ownerId) continue;
        if (circlesOverlap(p.x, p.y, PROJECTILE.radius, ship.x, ship.y, SHIP.radius)) {
          dead = true;
          const shooter = state.ships.find((s) => s.id === p.ownerId);
          if (shooter) shooter.hits++;
          state.events.push({ type: "hit", playerId: p.ownerId, targetId: ship.id, tick: state.tick });
          if (PVP_RULES.oneHitElimination) {
            ship.alive = false;
            state.events.push({
              type: "elimination",
              playerId: ship.id,
              byId: p.ownerId,
              tick: state.tick,
            });
          }
          break;
        }
      }
    }

    if (dead) removeProjectile(state, p);
  }

  checkRoundEnd(state);
  return state;
}

function fireProjectile(state: GameState, ship: Ship) {
  const id = `p${++projectileCounter}`;
  state.projectiles.push({
    id,
    ownerId: ship.id,
    team: ship.team,
    x: ship.x + Math.cos(ship.angle) * (SHIP.radius + PROJECTILE.radius + 2),
    y: ship.y + Math.sin(ship.angle) * (SHIP.radius + PROJECTILE.radius + 2),
    vx: Math.cos(ship.angle) * PROJECTILE.speed + ship.vx * 0.25,
    vy: Math.sin(ship.angle) * PROJECTILE.speed + ship.vy * 0.25,
    ageMs: 0,
  });
  ship.canFire = false; // ONE-SHOT RULE
  ship.shots++;
  state.events.push({ type: "shot", playerId: ship.id, tick: state.tick });
}

function removeProjectile(state: GameState, p: Projectile) {
  state.projectiles = state.projectiles.filter((x) => x.id !== p.id);
  // the owner regains their shot the moment the projectile leaves play
  const owner = state.ships.find((s) => s.id === p.ownerId);
  if (owner) owner.canFire = true;
}

function checkRoundEnd(state: GameState) {
  const aliveA = state.ships.filter((s) => s.team === 0 && s.alive).length;
  const aliveB = state.ships.filter((s) => s.team === 1 && s.alive).length;
  const timeUp = state.phaseTimerMs <= 0;

  if (aliveA > 0 && aliveB > 0 && !timeUp) return;

  let winner: 0 | 1 | null = null;
  if (aliveA > 0 && aliveB === 0) winner = 0;
  else if (aliveB > 0 && aliveA === 0) winner = 1;
  else if (timeUp && aliveA !== aliveB) winner = aliveA > aliveB ? 0 : 1;

  state.phase = "round_over";
  state.phaseTimerMs = 2000;
  state.lastRoundWinner = winner;
  if (winner !== null) state.score[winner]++;
  state.events.push({ type: "round_end", winningTeam: winner, tick: state.tick });

  if (state.score[0] >= PVP_RULES.roundsToWinMatch) state.matchWinner = 0;
  if (state.score[1] >= PVP_RULES.roundsToWinMatch) state.matchWinner = 1;
}

// --- collision helpers -------------------------------------------------

function moveShipAxis(ship: Ship, layout: ArenaLayout, dx: number, dy: number) {
  const nx = clamp(ship.x + dx, SHIP.radius, ARENA.width - SHIP.radius);
  const ny = clamp(ship.y + dy, SHIP.radius, ARENA.height - SHIP.radius);
  if (hitsObstacle(nx, ny, SHIP.radius, layout)) {
    if (dx !== 0) ship.vx = 0;
    if (dy !== 0) ship.vy = 0;
    return;
  }
  if (nx !== ship.x + dx) ship.vx = 0;
  if (ny !== ship.y + dy) ship.vy = 0;
  ship.x = nx;
  ship.y = ny;
}

export function hitsObstacle(cx: number, cy: number, r: number, layout: ArenaLayout): boolean {
  for (const o of layout.obstacles) {
    const closestX = clamp(cx, o.x, o.x + o.w);
    const closestY = clamp(cy, o.y, o.y + o.h);
    if ((cx - closestX) ** 2 + (cy - closestY) ** 2 < r * r) return true;
  }
  return false;
}

export function circlesOverlap(
  ax: number, ay: number, ar: number,
  bx: number, by: number, br: number,
): boolean {
  return (ax - bx) ** 2 + (ay - by) ** 2 <= (ar + br) ** 2;
}

function outOfBounds(p: Projectile) {
  return p.x < 0 || p.y < 0 || p.x > ARENA.width || p.y > ARENA.height;
}

function clamp(v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v;
}
