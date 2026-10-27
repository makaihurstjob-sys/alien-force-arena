import type { GameState } from '../types';
import { renderClassic } from './render';
import { directionFromAngle } from './duel';

export function renderClassicDuel(ctx: CanvasRenderingContext2D, state: GameState, viewerId?: string) {
  const host = state.ships.find(s => s.team === 0)!;
  const actor = (s: typeof host) => ({ id: s.team, x: s.x, y: s.y, direction: directionFromAngle(s.angle) });
  renderClassic(ctx, {
    player: actor(host), enemies: state.ships.filter(s => s.id !== host.id && s.alive).map(actor),
    shots: state.projectiles.map((p, id) => ({ id, owner: p.team, x: p.x, y: p.y,
      direction: directionFromAngle(Math.atan2(p.vy, p.vx)) })),
    score: 0, lives: 0, level: 1, phase: 'playing', waitingReason: 'start', awaitDirectionRelease: false, timer: 0, invulnerable: 0,
    elapsed: 0, shotsFired: 0, hits: 0, playerMoving: true,
    startLevel: 1, crashes: 0, shotDeaths: 0, levelsCleared: 0,
  }, false, host.alive);
  const viewer = state.ships.find(s => s.id === viewerId);
  if (viewer) {
    ctx.save();
    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
    for (const ship of state.ships) {
      if (!ship.alive || ship.team !== viewer.team) continue;
      const text = ship.name.slice(0, 20);
      const width = Math.min(130, ctx.measureText(text).width + 10);
      const x = Math.max(width / 2 + 2, Math.min(422 - width / 2, ship.x));
      const y = Math.max(13, ship.y - 15);
      ctx.fillStyle = '#061a20dd'; ctx.fillRect(x - width / 2, y - 11, width, 14);
      ctx.fillStyle = '#8fffd0'; ctx.fillText(text, x, y, width - 6);
    }
    ctx.restore();
  }
  const message = state.phase === 'countdown' ? String(Math.max(1, Math.ceil(state.phaseTimerMs / 1000)))
    : state.phase === 'round_over' ? state.lastRoundWinner === null ? 'DRAW'
      : `${state.lastRoundWinner === 0 ? 'WHITE' : 'ORANGE'} WINS` : null;
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
