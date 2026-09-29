import type { RankedFormat } from './ranked-rules';

export const ROUNDS_FALLBACK_MS = 10_000;
export const ROUNDS_PREFERENCE_KEY = 'alien-force-ranked-rounds';
export type RankedQueueEntry = {
  playerId: string;
  rating: number;
  queuedAt: number;
  preferRounds: boolean;
};

export function randomRankedFormat(random: () => number = Math.random): RankedFormat {
  const roll = random();
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new Error('Invalid random sample');
  return roll < 0.8 ? '1a' : '1b';
}

/** Server policy: use trusted queue timestamps/ratings and atomically claim both entries.
 * The caller supplies the allowed skill gap; waiting never overrides that limit.
 */
export function selectRankedOpponent(
  player: RankedQueueEntry, queue: readonly RankedQueueEntry[], now: number,
  maxRatingGap: number, random: () => number = Math.random,
): { opponentId: string; format: RankedFormat } | null {
  if (!Number.isSafeInteger(now) || now < 0 || !Number.isFinite(maxRatingGap) || maxRatingGap < 0) throw new Error('Invalid queue policy');
  for (const entry of [player, ...queue]) {
    if (!entry.playerId || !Number.isSafeInteger(entry.rating) || entry.rating < 0 || !Number.isSafeInteger(entry.queuedAt) || entry.queuedAt < 0 || entry.queuedAt > now) throw new Error('Invalid queue entry');
  }
  const eligible = queue.filter(candidate => candidate.playerId !== player.playerId && Math.abs(candidate.rating - player.rating) <= maxRatingGap)
    .sort((a, b) => Math.abs(a.rating - player.rating) - Math.abs(b.rating - player.rating) || a.queuedAt - b.queuedAt || a.playerId.localeCompare(b.playerId));
  // Opted-in opponents remain the first choice even after fallback opens.
  const rounds = player.preferRounds && eligible.find(candidate => candidate.preferRounds);
  if (rounds) return { opponentId: rounds.playerId, format: '1b' };
  if (player.preferRounds && now - player.queuedAt < ROUNDS_FALLBACK_MS) return null;
  const opponent = eligible.find(candidate => !candidate.preferRounds || now - candidate.queuedAt >= ROUNDS_FALLBACK_MS);
  if (!opponent) return null;
  return { opponentId: opponent.playerId, format: player.preferRounds || opponent.preferRounds ? '1a' : randomRankedFormat(random) };
}
