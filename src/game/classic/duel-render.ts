import type { GameState } from '../types';
import { renderClassic } from './render';
import { directionFromAngle } from './duel';

export function renderClassicDuel(ctx: CanvasRenderingContext2D, state: GameState) {
  const host = state.ships.find(s => s.team === 0)!;

  const actor = (s: typeof host) => ({ id: s.team, x: s.x, y: s.y, direction: directionFromAngle(s.angle) });
  renderClassic(ctx, {
    player: actor(host), enemies: state.ships.filter(s => s.team !== 0 && s.alive).map(actor),
    shots: state.projectiles.map((p, id) => ({ id, owner: p.team, x: p.x, y: p.y,
      direction: directionFromAngle(Math.atan2(p.vy, p.vx)) })),
    score: 0, lives: 0, level: 1, phase: 'playing', timer: 0, invulnerable: 0,
    elapsed: 0, shotsFired: 0, hits: 0, playerMoving: true,
    startLevel: 1, crashes: 0, shotDeaths: 0, levelsCleared: 0,
  }, false, host.alive);
  // Seat markers distinguish FFA pilots while preserving the original ship sprites.
  const colors = ['#ffffff', '#ffb000', '#63e6ff', '#e599ff'];
  if ((state.mode === "ffa" || state.score.length > 2)) {
    ctx.font = '10px monospace'; ctx.textAlign = 'center';
    for (const ship of state.ships) {
      if (!ship.alive) continue;
      ctx.strokeStyle = colors[ship.team]!; ctx.fillStyle = colors[ship.team]!;
      ctx.strokeRect(ship.x - 10, ship.y - 10, 20, 20);
      ctx.fillText(String(ship.team + 1), ship.x, ship.y - 13);
    }
    for (const shot of state.projectiles) {
      ctx.fillStyle = colors[shot.team]!; ctx.fillRect(shot.x - 2, shot.y - 2, 4, 4);
    }
    ctx.textAlign = 'left';
  }
  const message = state.phase === 'countdown' ? String(Math.max(1, Math.ceil(state.phaseTimerMs / 1000)))
    : state.phase === 'round_over' ? state.lastRoundWinner === null ? 'DRAW'
      : `${(state.mode === "ffa" || state.score.length > 2) ? `PILOT ${state.lastRoundWinner + 1}` : state.lastRoundWinner === 0 ? 'WHITE' : 'ORANGE'} WINS` : null;
  if (message) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(50, 172, 324, 65);
    ctx.fillStyle = 'white';
    ctx.font = '24px "Windows Bold", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(message, 212, 212);
    ctx.textAlign = 'left';
  }
}
