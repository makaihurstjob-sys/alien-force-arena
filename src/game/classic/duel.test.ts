import { describe, expect, it } from 'vitest';
import { createMatch, step } from './duel';
import { CLASSIC } from './engine';
import { EMPTY_INPUT } from '../types';

const players = [{ id: 'a', name: 'White', team: 0 as const }, { id: 'b', name: 'Orange', team: 1 as const }];
function playing() {
  const s = createMatch(players);
  s.phase = 'playing';
  s.phaseTimerMs = 60000;
  return s;
}
describe('Classic two-player rules', () => {
  it('moves automatically at Classic speed without acceleration', () => {
    const s = playing();
    step(s, {});
    expect(s.ships[0]!.x).toBeCloseTo(CLASSIC.margin + CLASSIC.playerSpeed / 60);
    expect(s.ships[0]!.y).toBe(412);
  });
  it('buffers cardinal turns until a lane crossing', () => {
    const s = playing();
    s.ships[0]!.x = 22;
    step(s, { a: { ...EMPTY_INPUT, thrust: true } });
    expect(s.ships[0]!.y).toBe(412);
    for (let i = 0; i < 20; i++) step(s, { a: { ...EMPTY_INPUT, thrust: true } });
    expect(s.ships[0]!.x).toBe(52);
    expect(s.ships[0]!.y).toBeLessThan(412);
  });
  it('reverses once per press even between intersections', () => {
    const s = playing();
    s.ships[0]!.x = 100;
    for (let i = 0; i < 3; i++) step(s, { a: { ...EMPTY_INPUT, turnaround: true } });
    expect(s.ships[0]!.x).toBeCloseTo(100 - CLASSIC.playerSpeed * 3 / 60);
    expect(s.ships[0]!.angle).toBe(Math.PI);
  });
  it('uses Classic bullet speed and one shot per player', () => {
    const s = playing();
    for (let i = 0; i < 3; i++) step(s, { a: { ...EMPTY_INPUT, fire: true } });
    expect(s.projectiles).toHaveLength(1);
    expect(s.projectiles[0]!.vx).toBe(CLASSIC.bulletSpeed);
    expect(s.ships[0]!.shots).toBe(1);
  });
  it('treats a head-on ship collision as a draw', () => {
    const s = playing();
    s.ships[0]!.x = 100;
    s.ships[1]!.x = 112;
    step(s, {});
    expect(s.phase).toBe('round_over');
    expect(s.ships.every(p => !p.alive)).toBe(true);
    expect(s.score).toEqual([0, 0]);
  });
});
