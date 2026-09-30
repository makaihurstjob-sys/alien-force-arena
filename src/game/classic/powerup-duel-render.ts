/**
 * Draws the pickup and buff/dash indicators on top of the existing, unforked
 * renderClassicDuel — the arena, ships and shots are rendered exactly as
 * Classic already renders them.
 */

import { renderClassicDuel } from './duel-render';
import { POWERUP, type PowerDuelMatch, type PowerUpKind } from './powerup-duel';

const POWERUP_COLORS: Record<PowerUpKind, string> = {
  shield: '#69d9ff',
  reflect: '#ff5f5f',
  rapidFire: '#ffe066',
  speedBoost: '#3ee08a',
  dash: '#d0a0ff',
};

const POWERUP_LABELS: Record<PowerUpKind, string> = {
  shield: 'S',
  reflect: 'R',
  rapidFire: 'F',
  speedBoost: 'B',
  dash: 'D',
};

export function renderPowerDuel(ctx: CanvasRenderingContext2D, match: PowerDuelMatch) {
  renderClassicDuel(ctx, match.game);

  if (match.pickup) {
    const { x, y, kind } = match.pickup;
    const pulse = 1 + Math.sin(match.game.tick * 0.05) * 0.15;
    const r = POWERUP.pickupRadius * pulse * 0.6;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = POWERUP_COLORS[kind];
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.fillStyle = '#0d1117';
    ctx.font = "bold 10px 'Windows Bold', monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(POWERUP_LABELS[kind], x, y + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  for (const ship of match.game.ships) {
    if (!ship.alive) continue;
    const buff = match.buffs.get(ship.id);
    if (buff) {
      ctx.strokeStyle = POWERUP_COLORS[buff.kind];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    if ((match.dashCharges.get(ship.id) ?? 0) > 0) {
      ctx.fillStyle = POWERUP_COLORS.dash;
      ctx.beginPath();
      ctx.moveTo(ship.x, ship.y - 20);
      ctx.lineTo(ship.x - 4, ship.y - 14);
      ctx.lineTo(ship.x + 4, ship.y - 14);
      ctx.closePath();
      ctx.fill();
    }
  }
}
