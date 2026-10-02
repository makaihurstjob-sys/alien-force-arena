/**
 * Power-up wrapper tests: confirm Classic's real duel rules (one-shot,
 * lane movement, round scoring) are untouched by default, then confirm
 * each of the 5 power-ups does exactly what it claims.
 */

import { describe, expect, it } from 'vitest';
import { CLASSIC } from './engine';
import {
  createPowerDuelMatch,
  startPowerDuelRound,
  stepPowerDuel,
  POWERUP,
  type PowerDuelMatch,
} from './powerup-duel';
import { PVP_RULES, TICK_HZ } from '../config';
import type { PlayerSeed } from './duel';
import type { PlayerInput } from '../types';

const PLAYERS: PlayerSeed[] = [
  { id: 'a', name: 'A', team: 0 },
  { id: 'b', name: 'B', team: 1 },
];

const IDLE: PlayerInput = { thrust: false, reverse: false, left: false, right: false, fire: false, dash: false };
const FIRE: PlayerInput = { ...IDLE, fire: true };

function skipCountdown(match: PowerDuelMatch) {
  const ticks = PVP_RULES.countdownSeconds * TICK_HZ + 1;
  for (let i = 0; i < ticks; i++) stepPowerDuel(match, {});
}

// Ships spawn on the same bottom row (y=412) facing each other, so most
// tests move "b" out of "a"'s firing lane unless they specifically want a hit.
const OUT_OF_LANE_Y = CLASSIC.margin;
const MAX_CROSS_ARENA_TICKS = Math.ceil((CLASSIC.size / CLASSIC.bulletSpeed) * TICK_HZ) + 5;

describe('baseline Classic duel rules (unchanged without power-ups)', () => {
  it('allows only one active projectile per player', () => {
    const match = createPowerDuelMatch(PLAYERS);
    skipCountdown(match);
    match.game.ships.find((s) => s.id === 'b')!.y = OUT_OF_LANE_Y;

    stepPowerDuel(match, { a: FIRE });
    expect(match.game.projectiles.filter((p) => p.ownerId === 'a')).toHaveLength(1);
    for (let i = 0; i < 10; i++) stepPowerDuel(match, { a: FIRE });
    expect(match.game.projectiles.filter((p) => p.ownerId === 'a')).toHaveLength(1);
    expect(match.game.ships.find((s) => s.id === 'a')!.canFire).toBe(false);
  });

  it('restores the shot once it leaves the arena', () => {
    const match = createPowerDuelMatch(PLAYERS);
    skipCountdown(match);
    match.game.ships.find((s) => s.id === 'b')!.y = OUT_OF_LANE_Y;

    stepPowerDuel(match, { a: FIRE });
    for (let i = 0; i < MAX_CROSS_ARENA_TICKS; i++) stepPowerDuel(match, {});

    expect(match.game.projectiles.filter((p) => p.ownerId === 'a')).toHaveLength(0);
    expect(match.game.ships.find((s) => s.id === 'a')!.canFire).toBe(true);
  });
});

describe('Rapid Fire', () => {
  it('holds more than one projectile at once while active, then the one-shot rule reasserts', () => {
    const match = createPowerDuelMatch(PLAYERS);
    skipCountdown(match);
    match.game.ships.find((s) => s.id === 'b')!.y = OUT_OF_LANE_Y;
    match.buffs.set('a', { kind: 'rapidFire', untilTick: match.game.tick + 5 });

    stepPowerDuel(match, { a: FIRE });
    stepPowerDuel(match, { a: FIRE });
    expect(match.game.projectiles.filter((p) => p.ownerId === 'a').length).toBeGreaterThan(1);

    for (let i = 0; i < 10; i++) stepPowerDuel(match, {});
    expect(match.buffs.has('a')).toBe(false);

    for (let i = 0; i < MAX_CROSS_ARENA_TICKS; i++) stepPowerDuel(match, {});
    expect(match.game.projectiles.filter((p) => p.ownerId === 'a')).toHaveLength(0);

    stepPowerDuel(match, { a: FIRE });
    for (let i = 0; i < 5; i++) stepPowerDuel(match, { a: FIRE });
    expect(match.game.projectiles.filter((p) => p.ownerId === 'a')).toHaveLength(1);
  });
});

describe('Shield', () => {
  it('makes the ship immune to hits for its duration (shot passes through)', () => {
    const match = createPowerDuelMatch(PLAYERS);
    skipCountdown(match);
    const b = match.game.ships.find((s) => s.id === 'b')!;
    match.buffs.set('b', { kind: 'shield', untilTick: match.game.tick + 1000 });

    stepPowerDuel(match, { a: FIRE });
    for (let i = 0; i < MAX_CROSS_ARENA_TICKS; i++) stepPowerDuel(match, {});

    expect(b.alive).toBe(true);
  });
});

describe('Freeze Shot', () => {
  it('loads on pickup, launches on the next fired shot, and is consumed the moment it launches', () => {
    const match = createPowerDuelMatch(PLAYERS);
    skipCountdown(match);
    match.buffs.set('b', { kind: 'freeze', untilTick: match.game.tick + 1000 });

    stepPowerDuel(match, { b: FIRE });
    expect(match.buffs.has('b')).toBe(false);
    expect(match.freezeInFlight.has('b')).toBe(true);
  });

  it('freezes the target on a landed hit without eliminating them', () => {
    const match = createPowerDuelMatch(PLAYERS);
    skipCountdown(match);
    const a = match.game.ships.find((s) => s.id === 'a')!;
    match.buffs.set('b', { kind: 'freeze', untilTick: match.game.tick + 1000 });

    stepPowerDuel(match, { b: FIRE });
    for (let i = 0; i < MAX_CROSS_ARENA_TICKS && !match.frozenUntil.has('a'); i++) stepPowerDuel(match, {});

    expect(a.alive).toBe(true);
    expect(match.frozenUntil.has('a')).toBe(true);
    expect(match.freezeInFlight.has('b')).toBe(false);
  });

  it('prevents the frozen ship from moving or firing until it expires', () => {
    const match = createPowerDuelMatch(PLAYERS);
    skipCountdown(match);
    const a = match.game.ships.find((s) => s.id === 'a')!;
    match.frozenUntil.set('a', match.game.tick + 5);
    const x0 = a.x;

    stepPowerDuel(match, { a: { ...IDLE, right: true, fire: true } });
    expect(a.x).toBe(x0);
    expect(match.game.projectiles.filter((p) => p.ownerId === 'a')).toHaveLength(0);

    for (let i = 0; i < 10; i++) stepPowerDuel(match, {});
    expect(match.frozenUntil.has('a')).toBe(false);
    // control returns once it expires
    stepPowerDuel(match, { a: { ...IDLE, right: true } });
    expect(a.x).not.toBe(x0);
  });

  it("a Shield holder's freeze is blocked, not just the normal elimination", () => {
    const match = createPowerDuelMatch(PLAYERS);
    skipCountdown(match);
    const a = match.game.ships.find((s) => s.id === 'a')!;
    match.buffs.set('a', { kind: 'shield', untilTick: match.game.tick + 1000 });
    match.buffs.set('b', { kind: 'freeze', untilTick: match.game.tick + 1000 });

    stepPowerDuel(match, { b: FIRE });
    for (let i = 0; i < MAX_CROSS_ARENA_TICKS; i++) stepPowerDuel(match, {});

    expect(a.alive).toBe(true);
    expect(match.frozenUntil.has('a')).toBe(false);
  });
});

describe('Speed Boost', () => {
  it('covers proportionally more distance per tick while active', () => {
    const normal = createPowerDuelMatch(PLAYERS);
    skipCountdown(normal);
    const a1 = normal.game.ships.find((s) => s.id === 'a')!;
    const x0 = a1.x;
    for (let i = 0; i < 60; i++) stepPowerDuel(normal, { a: { ...IDLE, right: true } });
    const normalDistance = a1.x - x0;

    const boosted = createPowerDuelMatch(PLAYERS);
    skipCountdown(boosted);
    const a2 = boosted.game.ships.find((s) => s.id === 'a')!;
    boosted.buffs.set('a', { kind: 'speedBoost', untilTick: boosted.game.tick + 1000 });
    const x0b = a2.x;
    for (let i = 0; i < 60; i++) stepPowerDuel(boosted, { a: { ...IDLE, right: true } });
    const boostedDistance = a2.x - x0b;

    expect(boostedDistance).toBeCloseTo(normalDistance * POWERUP.speedBoostMultiplier, 0);
  });
});

describe('Teleport', () => {
  it('moves three lane cells in the held direction, independent of current facing', () => {
    const match = createPowerDuelMatch(PLAYERS);
    skipCountdown(match);
    const a = match.game.ships.find((s) => s.id === 'a')!;
    a.x = 200;
    a.y = 200;
    a.angle = 0; // facing right
    match.teleportCharges.set('a', 1);

    stepPowerDuel(match, { a: { ...IDLE, dash: true, thrust: true } }); // hold "up" while teleporting
    expect(a.y).toBeCloseTo(200 - CLASSIC.spacing * POWERUP.teleportCells, -1);
    expect(a.x).toBeCloseTo(200, -1); // no horizontal movement despite facing right
    expect(match.teleportCharges.get('a') ?? 0).toBe(0);
  });

  it('falls back to current facing when no direction is held', () => {
    const match = createPowerDuelMatch(PLAYERS);
    skipCountdown(match);
    const a = match.game.ships.find((s) => s.id === 'a')!;
    a.x = 200;
    a.y = 200;
    a.angle = 0; // facing right
    match.teleportCharges.set('a', 1);

    stepPowerDuel(match, { a: { ...IDLE, dash: true } });
    expect(a.x).toBeCloseTo(200 + CLASSIC.spacing * POWERUP.teleportCells, -1);
  });

  it('clamps to the arena bounds instead of leaving the grid', () => {
    const match = createPowerDuelMatch(PLAYERS);
    skipCountdown(match);
    const a = match.game.ships.find((s) => s.id === 'a')!;
    a.angle = Math.PI; // face left, already at the left edge (x = CLASSIC.margin)
    match.teleportCharges.set('a', 1);

    stepPowerDuel(match, { a: { ...IDLE, dash: true } });
    expect(a.x).toBe(CLASSIC.margin);
  });

  it('does nothing once the charge is spent', () => {
    const match = createPowerDuelMatch(PLAYERS);
    skipCountdown(match);
    const a = match.game.ships.find((s) => s.id === 'a')!;
    match.teleportCharges.set('a', 1);
    stepPowerDuel(match, { a: { ...IDLE, dash: true } });
    const afterFirst = a.x;

    stepPowerDuel(match, { a: { ...IDLE, dash: true } });
    // no charge left, so only a normal tick of continuous movement happens,
    // nowhere near another full teleport
    expect(a.x - afterFirst).toBeLessThan(CLASSIC.spacing);
  });
});

describe('power-up pickups', () => {
  it('spawns one pickup at a time on a lane intersection', () => {
    const match = createPowerDuelMatch(PLAYERS);
    skipCountdown(match);
    stepPowerDuel(match, {});
    expect(match.pickup).not.toBeNull();

    const { x, y } = match.pickup!;
    expect((x - CLASSIC.margin) % CLASSIC.spacing).toBe(0);
    expect((y - CLASSIC.margin) % CLASSIC.spacing).toBe(0);

    const first = match.pickup;
    stepPowerDuel(match, {});
    expect(match.pickup).toEqual(first);
  });

  it('applies the correct effect on contact and clears the pickup', () => {
    const match = createPowerDuelMatch(PLAYERS);
    skipCountdown(match);
    stepPowerDuel(match, {});
    const pickup = match.pickup!;
    const a = match.game.ships.find((s) => s.id === 'a')!;
    a.x = pickup.x;
    a.y = pickup.y;

    stepPowerDuel(match, {});
    expect(match.pickup).toBeNull();
    if (pickup.kind === 'teleport') expect(match.teleportCharges.get('a')).toBe(1);
    else expect(match.buffs.get('a')?.kind).toBe(pickup.kind);
  });
});

describe('round reset (unchanged Classic scoring)', () => {
  it('clears buffs, teleport charges and frozen status on a new round while Classic scoring proceeds normally', () => {
    const match = createPowerDuelMatch(PLAYERS);
    skipCountdown(match);
    match.buffs.set('a', { kind: 'shield', untilTick: match.game.tick + 1000 });
    match.teleportCharges.set('a', 1);
    match.frozenUntil.set('a', match.game.tick + 1000);
    match.game.ships.find((s) => s.id === 'b')!.alive = false;

    stepPowerDuel(match, {});
    expect(match.game.phase).toBe('round_over');
    expect(match.game.score[0]).toBe(1);

    startPowerDuelRound(match);
    expect(match.game.round).toBe(2);
    expect(match.buffs.has('a')).toBe(false);
    expect(match.teleportCharges.get('a') ?? 0).toBe(0);
    expect(match.frozenUntil.has('a')).toBe(false);
  });
});
