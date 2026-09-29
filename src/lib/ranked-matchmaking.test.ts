import { describe, expect, it } from 'vitest';
import { randomRankedFormat, selectRankedOpponent, type RankedQueueEntry } from './ranked-matchmaking';

const entry = (playerId: string, preferRounds = false, rating = 500, queuedAt = 0): RankedQueueEntry => ({ playerId, preferRounds, rating, queuedAt });
describe('Ranked queue policy', () => {
  it('uses exactly 80 stocks and 20 rounds per 100 evenly spaced samples', () => {
    const formats = Array.from({ length: 100 }, (_, i) => randomRankedFormat(() => i / 100));
    expect(formats.filter(f => f === '1a')).toHaveLength(80);
    expect(formats.filter(f => f === '1b')).toHaveLength(20);
  });
  it('matches two rounds preferences immediately', () => {
    expect(selectRankedOpponent(entry('a', true), [entry('b', true)], 0, 100)).toEqual({ opponentId: 'b', format: '1b' });
  });
  it('waits until exactly ten seconds before stocks fallback', () => {
    expect(selectRankedOpponent(entry('a', true), [entry('b')], 9999, 100)).toBeNull();
    expect(selectRankedOpponent(entry('a', true), [entry('b')], 10000, 100, () => .99)).toEqual({ opponentId: 'b', format: '1a' });
  });
  it('protects the other player’s full wait regardless of who requests a match', () => {
    expect(selectRankedOpponent(entry('a'), [entry('b', true, 500, 1)], 10000, 100)).toBeNull();
    expect(selectRankedOpponent(entry('a'), [entry('b', true, 500, 1)], 10001, 100)).toEqual({ opponentId: 'b', format: '1a' });
  });
  it('still prefers rounds after the deadline', () => {
    expect(selectRankedOpponent(entry('a', true), [entry('b'), entry('c', true, 550)], 20000, 100)).toEqual({ opponentId: 'c', format: '1b' });
  });
  it('allows either format for two players with the setting off', () => {
    expect(selectRankedOpponent(entry('a'), [entry('b')], 0, 100, () => .799)?.format).toBe('1a');
    expect(selectRankedOpponent(entry('a'), [entry('b')], 0, 100, () => .8)?.format).toBe('1b');
  });
  it('does not expand rank limits or match a player to themselves', () => {
    expect(selectRankedOpponent(entry('a', true), [entry('a', true), entry('b', true, 601)], 20000, 100)).toBeNull();
  });
  it('chooses nearest rank, then longest waiting opponent', () => {
    expect(selectRankedOpponent(entry('a'), [entry('b', false, 550), entry('c', false, 510, 2), entry('d', false, 490, 1)], 10, 100, () => 0)?.opponentId).toBe('d');
  });
  it('handles an empty queue without consuming randomness', () => {
    expect(selectRankedOpponent(entry('a'), [], 0, 100, () => { throw new Error('unexpected roll'); })).toBeNull();
  });
  it('rejects invalid timestamps and random values', () => {
    expect(() => selectRankedOpponent(entry('a', false, 500, 1), [], 0, 100)).toThrow();
    expect(() => randomRankedFormat(() => 1)).toThrow();
  });
});
