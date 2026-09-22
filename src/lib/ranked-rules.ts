import { ranks } from './ranks';

export const RANKED_RULES = {
  season: 'preseason', pointsPerDivision: 100, divisionsPerTier: 3,
  startingRating: 0, legendMinimum: 1500, baseline: 30, minimumDelta: 21,
  maximumDelta: 39, stocks: 4, disconnectWindowMs: 15 * 60_000,
  cooldownsMs: [5 * 60_000, 15 * 60_000, 30 * 60_000],
} as const;
export type RankedFormat = '1a' | '1b';
export const RANKED_FORMATS = {
  '1a': { name: '1A · Stocks', description: 'Four lives. Only the eliminated pilot respawns.' },
  '1b': { name: '1B · Rounds', description: 'First to four. Both pilots reset after each round.' },
} as const;

function ratingValue(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid rating');
}

/** #1 is supplied by trusted standings, never inferred from a local match. */
export function rankAt(rating: number, standing?: number) {
  ratingValue(rating);
  const divisionIndex = Math.min(14, Math.floor(rating / 100));
  const legend = rating >= RANKED_RULES.legendMinimum && standing === 1;
  const rank = ranks[legend ? 5 : Math.floor(divisionIndex / 3)]!;
  const division = ['I', 'II', 'III'][divisionIndex % 3]!;
  return { ...rank, division: legend ? null : division,
    label: legend ? rank.name : `${rank.name} ${division}`,
    progress: Math.min(100, rating - divisionIndex * 100), rating };
}

/** Combined opponent and margin effects are bounded, not multiplied. */
export function ratingChanges(winnerRating: number, loserRating: number, loserScore: number, forfeit = false) {
  ratingValue(winnerRating); ratingValue(loserRating);
  if (!Number.isInteger(loserScore) || loserScore < 0 || loserScore > 3) throw new Error('Invalid final score');
  const strength = Math.max(-1, Math.min(1, (loserRating - winnerRating) / 300));
  const margin = forfeit ? 1 : 1 - 2 * loserScore / 3;
  const amount = Math.round(Math.max(21, Math.min(39, 30 + 4.5 * strength + 4.5 * margin)));
  return { winner: amount, loser: -amount };
}

/** Zero itself stores grace: wins rearm it; a subsequent loss crosses the boundary. */
export function applyRatingChange(rating: number, delta: number) {
  ratingValue(rating);
  if (!Number.isInteger(delta) || Math.abs(delta) < 21 || Math.abs(delta) > 39) throw new Error('Invalid rating change');
  const floor = Math.floor(rating / 100) * 100;
  const grace = delta < 0 && rating > floor && rating + delta <= floor && rating < 1500;
  const next = Math.max(0, grace ? floor : rating + delta);
  return { rating: next, appliedDelta: next - rating, grace };
}

export type DisconnectState = { count: number; lastAt: number | null; cooldownUntil: number };
export const freshDisconnectState = (): DisconnectState => ({ count: 0, lastAt: null, cooldownUntil: 0 });
/** Call only for a trusted disconnect event; completed matches reset the streak. */
export function recordDisconnect(previous: DisconnectState, now: number): DisconnectState {
  if (!Number.isSafeInteger(now) || now < 0 || (previous.lastAt !== null && now < previous.lastAt)) throw new Error('Invalid event time');
  const count = previous.lastAt !== null && now - previous.lastAt <= RANKED_RULES.disconnectWindowMs ? previous.count + 1 : 1;
  const cooldown = count < 3 ? 0 : RANKED_RULES.cooldownsMs[Math.min(count - 3, 2)]!;
  return { count, lastAt: now, cooldownUntil: Math.max(previous.cooldownUntil, cooldown ? now + cooldown : 0) };
}
