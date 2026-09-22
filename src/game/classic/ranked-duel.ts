import { createMatch, startRound, step, type PlayerSeed } from './duel';
import type { PlayerInput } from '../types';
import type { RankedFormat } from '../../lib/ranked-rules';

/** Experimental local formats. This module never submits ranked results. */
export function createRankedMatch(players: PlayerSeed[], format: RankedFormat) {
  if (players.length !== 2 || players[0]!.id === players[1]!.id || new Set(players.map(p => p.team)).size !== 2) throw new Error('Ranked requires two opposing pilots');
  return { game: createMatch(players), players, format, stocks: [4, 4] as [number, number],
    protection: new Map<string, number>(), draw: false };
}
export type RankedMatch = ReturnType<typeof createRankedMatch>;

export function stepRankedMatch(match: RankedMatch, inputs: Record<string, PlayerInput>) {
  const { game, players } = match;
  if (game.matchWinner !== null || match.draw) return;
  if (game.phase === 'round_over' && game.phaseTimerMs <= 0) startRound(game, players);
  const protectedIds = new Set([...match.protection].filter(([, until]) => until > game.tick).map(([id]) => id));
  const safeInputs = { ...inputs };
  for (const id of protectedIds) if (safeInputs[id]) safeInputs[id] = { ...safeInputs[id], fire: false };
  const wasPlaying = game.phase === 'playing';
  step(game, safeInputs, { roundsToWin: 4, protectedIds });
  if (!wasPlaying || game.phase !== 'round_over') return;
  if (match.format === '1b') {
    match.stocks = [4 - game.score[1], 4 - game.score[0]];
    return;
  }
  const dead = game.ships.filter(ship => !ship.alive);
  for (const ship of dead) match.stocks[ship.team]--;
  game.score = [4 - match.stocks[1], 4 - match.stocks[0]];
  const exhausted = match.stocks.map(lives => lives === 0);
  if (exhausted[0] || exhausted[1]) {
    match.draw = !!(exhausted[0] && exhausted[1]);
    game.matchWinner = match.draw ? null : exhausted[0] ? 1 : 0;
    game.lastRoundWinner = game.matchWinner;
    return;
  }
  // Continuous stocks have no round timeout. Respawned pilots cannot hit or be hit for one second.
  const spawns = createMatch(players).ships;
  for (const ship of dead) {
    const fresh = spawns.find(s => s.id === ship.id)!;
    Object.assign(ship, { x: fresh.x, y: fresh.y, angle: fresh.angle, alive: true, canFire: true, turnaroundHeld: false });
    game.projectiles = game.projectiles.filter(p => p.ownerId !== ship.id);
    match.protection.set(ship.id, game.tick + 60);
  }
  game.phase = 'playing';
  game.phaseTimerMs = 60_000;
  game.lastRoundWinner = null;
  game.events = game.events.filter(event => event.type !== 'round_end');
}
