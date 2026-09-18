import { describe, expect, it } from 'vitest';
import { createMatch, step, startRound } from './duel';
import { DuelHost, isDuelSnapshot } from '../online';
const players = Array.from({length: 4}, (_, team) => ({id: `p${team}`, name: `Pilot ${team}`, team}));
function playing() { const s = createMatch(players); s.phase = 'playing'; s.phaseTimerMs = 60000; return s; }
describe('FFA rules', () => {
 it('spawns four distinct pilots and keeps playing with multiple survivors', () => {
  const s = playing(); expect(new Set(s.ships.map(p => `${p.x},${p.y}`)).size).toBe(4);
  s.ships[0]!.alive = false; step(s, {}); expect(s.phase).toBe('playing');
 });
 it('awards the last survivor their own score and a third-round victory', () => {
  const s = playing(); s.ships.forEach(p => p.alive = p.team === 3); s.score[3] = 2;
  step(s, {}); expect(s.score).toEqual([0,0,0,3]); expect(s.matchWinner).toBe(3);
 });
 it('resolves collisions between third and fourth pilots', () => {
  const s = playing(); s.ships[2]!.x = 100; s.ships[3]!.x = 112;
  step(s, {}); expect(s.ships[2]!.alive).toBe(false); expect(s.ships[3]!.alive).toBe(false);
  expect(s.phase).toBe('playing');
 });
 it('draws on timeout with multiple survivors and retains stats on respawn', () => {
  const s = playing(); s.ships[2]!.shots = 4; s.phaseTimerMs = 0; step(s, {});
  expect(s.lastRoundWinner).toBe(null); expect(s.score).toEqual([0,0,0,0]);
  startRound(s, players); expect(s.ships.every(p => p.alive)).toBe(true); expect(s.ships[2]!.shots).toBe(4);
 });
 it('accepts a full roster and rejects duplicate seats or missing pilots', () => {
  const host = new DuelHost('test', players, 'ffa'); const snapshot = host.snapshot();
  expect(isDuelSnapshot(snapshot, players.map(p => p.id))).toBe(true);
  expect(isDuelSnapshot(snapshot, ['p0','p1'])).toBe(false);
  snapshot.state.ships[3]!.team = 2; expect(isDuelSnapshot(snapshot, players.map(p => p.id))).toBe(false);
 });
});
