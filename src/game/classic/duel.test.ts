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
  it('preserves duel speed independently of solo Classic progression', () => {
    const s = playing();
    step(s, {});
    expect(s.ships[0]!.x).toBeCloseTo(CLASSIC.margin + 110 / 60);
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
  it('remembers a quick tap until the next lane intersection even after the key is released', () => {
    const s = playing();
    s.ships[0]!.x = 22; // short of the first crossing at x=52
    step(s, { a: { ...EMPTY_INPUT, thrust: true } }); // a single tick's tap
    expect(s.ships[0]!.y).toBe(412); // too far from the crossing to turn yet
    for (let i = 0; i < 20; i++) step(s, {}); // key released, no more input at all
    expect(s.ships[0]!.x).toBe(52);
    expect(s.ships[0]!.y).toBeLessThan(412); // still turned, from the earlier tap
  });
  it('reverses once per press even between intersections', () => {
    const s = playing();
    s.ships[0]!.x = 100;
    for (let i = 0; i < 3; i++) step(s, { a: { ...EMPTY_INPUT, turnaround: true } });
    expect(s.ships[0]!.x).toBeCloseTo(100 - 110 * 3 / 60);
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
