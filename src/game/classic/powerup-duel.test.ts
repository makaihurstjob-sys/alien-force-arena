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
    const maxTicks = Math.ceil((CLASSIC.size / CLASSIC.bulletSpeed) * TICK_HZ) + 5;
    for (let i = 0; i < maxTicks; i++) stepPowerDuel(match, {});

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

    const maxTicks = Math.ceil((CLASSIC.size / CLASSIC.bulletSpeed) * TICK_HZ) + 5;
    for (let i = 0; i < maxTicks; i++) stepPowerDuel(match, {});
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
    const maxTicks = Math.ceil((CLASSIC.size / CLASSIC.bulletSpeed) * TICK_HZ) + 5;
    for (let i = 0; i < maxTicks; i++) stepPowerDuel(match, {});

    expect(b.alive).toBe(true);
  });
});

describe('Reflect Shield', () => {
  it('eliminates the shooter instead of the holder, then is consumed', () => {
    const match = createPowerDuelMatch(PLAYERS);
    skipCountdown(match);
    const a = match.game.ships.find((s) => s.id === 'a')!;
    const b = match.game.ships.find((s) => s.id === 'b')!;
    match.buffs.set('b', { kind: 'reflect', untilTick: match.game.tick + 1000 });

    stepPowerDuel(match, { a: FIRE });
    const maxTicks = Math.ceil((CLASSIC.size / CLASSIC.bulletSpeed) * TICK_HZ) + 5;
    for (let i = 0; i < maxTicks && a.alive; i++) stepPowerDuel(match, {});

    expect(a.alive).toBe(false);
    expect(b.alive).toBe(true);
    expect(b.hits).toBe(1);
    expect(match.buffs.has('b')).toBe(false);
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

describe('Dash', () => {
  it('moves two lane cells instantly along the current facing direction and consumes the charge', () => {
    const match = createPowerDuelMatch(PLAYERS);
    skipCountdown(match);
    const a = match.game.ships.find((s) => s.id === 'a')!;
    match.dashCharges.set('a', 1);
    const x0 = a.x;

    stepPowerDuel(match, { a: { ...IDLE, dash: true } });
    // Classic ships move continuously every tick regardless of input, so this
    // same call also advances "a" by one normal tick on top of the dash burst.
    expect(a.x).toBeCloseTo(x0 + CLASSIC.spacing * POWERUP.dashCells, -1);
    expect(match.dashCharges.get('a') ?? 0).toBe(0);

    const afterFirst = a.x;
    stepPowerDuel(match, { a: { ...IDLE, dash: true } });
    // no charge left, so only a normal tick of continuous movement happens,
    // nowhere near another full dash burst
    expect(a.x - afterFirst).toBeLessThan(CLASSIC.spacing);
  });

  it('clamps to the arena bounds instead of leaving the grid', () => {
    const match = createPowerDuelMatch(PLAYERS);
    skipCountdown(match);
    const a = match.game.ships.find((s) => s.id === 'a')!;
    a.angle = Math.PI; // face left, already at the left edge (x = CLASSIC.margin)
    match.dashCharges.set('a', 1);

    stepPowerDuel(match, { a: { ...IDLE, dash: true } });
    expect(a.x).toBe(CLASSIC.margin);
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
    if (pickup.kind === 'dash') expect(match.dashCharges.get('a')).toBe(1);
    else expect(match.buffs.get('a')?.kind).toBe(pickup.kind);
  });
});

describe('round reset (unchanged Classic scoring)', () => {
  it('clears buffs and dash charges on a new round while Classic scoring proceeds normally', () => {
    const match = createPowerDuelMatch(PLAYERS);
    skipCountdown(match);
    match.buffs.set('a', { kind: 'shield', untilTick: match.game.tick + 1000 });
    match.dashCharges.set('a', 1);
    match.game.ships.find((s) => s.id === 'b')!.alive = false;

    stepPowerDuel(match, {});
    expect(match.game.phase).toBe('round_over');
    expect(match.game.score[0]).toBe(1);

    startPowerDuelRound(match);
    expect(match.game.round).toBe(2);
    expect(match.buffs.has('a')).toBe(false);
    expect(match.dashCharges.get('a') ?? 0).toBe(0);
  });
});
