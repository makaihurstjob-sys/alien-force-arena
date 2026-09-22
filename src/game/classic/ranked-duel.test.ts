import { expect, it } from 'vitest';
import { createRankedMatch, stepRankedMatch } from './ranked-duel';
const players = [{ id: 'a', name: 'A', team: 0 as const }, { id: 'b', name: 'B', team: 1 as const }];
function killGuest(match: ReturnType<typeof createRankedMatch>) {
  const g = match.game; g.phase = 'playing'; g.phaseTimerMs = 60000;
  g.ships[0]!.alive = true; g.ships[1]!.alive = false;
  stepRankedMatch(match, {});
}
it('1B needs four wins and shows remaining lives', () => {
  const m = createRankedMatch(players, '1b');
  for (let i = 0; i < 3; i++) killGuest(m);
  expect(m.game.matchWinner).toBeNull(); expect(m.stocks).toEqual([4, 1]);
  killGuest(m); expect(m.game.matchWinner).toBe(0);
  stepRankedMatch(m, {}); expect(m.stocks).toEqual([4, 0]);
});
it('1A respawns only the eliminated ship and ends at zero stocks', () => {
  const m = createRankedMatch(players, '1a');
  m.game.ships[0]!.x = 150;
  killGuest(m);
  expect(m.game.ships[0]!.x).toBeGreaterThan(150);
  expect(m.game.ships[1]!.alive).toBe(true);
  expect(m.game.phase).toBe('playing');
  expect(m.stocks).toEqual([4, 3]);
  for (let i = 0; i < 3; i++) killGuest(m);
  expect(m.game.matchWinner).toBe(0);
});
it('simultaneous last stocks draw without awarding a win', () => {
  const m = createRankedMatch(players, '1a'); m.stocks = [1, 1];
  m.game.phase = 'playing'; m.game.ships.forEach(s => { s.alive = false; });
  stepRankedMatch(m, {});
  expect(m.draw).toBe(true); expect(m.game.matchWinner).toBeNull();
});
it('1B resets both players after the round break', () => {
  const m = createRankedMatch(players, '1b'); killGuest(m);
  m.game.phaseTimerMs = 0; stepRankedMatch(m, {});
  expect(m.game.phase).toBe('countdown'); expect(m.game.ships.every(s => s.alive)).toBe(true);
});
