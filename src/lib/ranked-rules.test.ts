import { describe, expect, it } from 'vitest';
import { applyRatingChange, rankAt, ratingChanges, recordDisconnect, freshDisconnectState } from './ranked-rules';

describe('preseason ladder', () => {
  it('starts at Cadet I and promotes with carryover', () => {
    expect(rankAt(0).label).toBe('Cadet I');
    expect(rankAt(applyRatingChange(90, 30).rating)).toMatchObject({ label: 'Cadet II', progress: 20 });
    expect(rankAt(applyRatingChange(70, 30).rating).progress).toBe(0);
  });
  it('gives one zero grace game and rearms after a win', () => {
    expect(applyRatingChange(110, -30)).toMatchObject({ rating: 100, grace: true });
    expect(applyRatingChange(100, -25).rating).toBe(75);
    expect(applyRatingChange(125, -25)).toMatchObject({ rating: 100, grace: true });
    expect(applyRatingChange(0, -39).rating).toBe(0);
  });
  it('reserves Legend for an eligible #1, without capping rating', () => {
    expect(rankAt(1499, 1).label).toBe('Commander III');
    expect(rankAt(1500, 1).label).toBe('Galactic Legend');
    expect(rankAt(1900, 2).label).toBe('Commander III');
    expect(applyRatingChange(1900, 30).rating).toBe(1930);
  });
  it('bounds all combined changes and softens close losses', () => {
    for (const gap of [0, 100, 300, 10000]) for (let score = 0; score < 4; score++) {
      const result = ratingChanges(0, gap, score);
      expect(result.winner).toBeGreaterThanOrEqual(21);
      expect(result.winner).toBeLessThanOrEqual(39);
      expect(result.loser).toBe(-result.winner);
    }
    expect(ratingChanges(0, 10000, 0).winner).toBe(39);
    expect(ratingChanges(10000, 0, 3).winner).toBe(21);
    expect(ratingChanges(500, 500, 3).loser).toBeGreaterThan(ratingChanges(500, 500, 0).loser);
    expect(ratingChanges(500, 500, 3, true)).toEqual(ratingChanges(500, 500, 0));
    expect(() => ratingChanges(0, 0, 4)).toThrow();
    expect(() => rankAt(NaN)).toThrow();
  });
  it('starts cooldown at the third rapid consecutive disconnect', () => {
    let state = recordDisconnect(freshDisconnectState(), 1000);
    state = recordDisconnect(state, 2000);
    expect(state.cooldownUntil).toBe(0);
    state = recordDisconnect(state, 3000);
    expect(state.cooldownUntil).toBe(303000);
    expect(recordDisconnect(state, 304000).cooldownUntil).toBe(1204000);
    expect(recordDisconnect(state, 1000000).count).toBe(1);
  });
});
