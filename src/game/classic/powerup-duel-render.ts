/**
 * Draws the pickup, buff and teleport/frozen indicators on top of the
 * existing, unforked renderClassicDuel — the arena, ships and shots render
 * exactly as Classic already renders them.
 */

import { renderClassicDuel } from './duel-render';
import { POWERUP, type PowerDuelMatch, type PowerUpKind } from './powerup-duel';

const POWERUP_COLORS: Record<PowerUpKind, string> = {
  shield: '#69d9ff',
  freeze: '#8fe3ff',
  rapidFire: '#ffe066',
  speedBoost: '#3ee08a',
  teleport: '#d0a0ff',
};

const POWERUP_LABELS: Record<Exclude<PowerUpKind, 'freeze'>, string> = {
  shield: 'S',
  rapidFire: 'F',
  speedBoost: 'B',
  teleport: 'T',
};

function drawSnowflake(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate((Math.PI / 3) * i);
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.moveTo(r * 0.5, -r * 0.3);
    ctx.lineTo(r, 0);
    ctx.lineTo(r * 0.5, r * 0.3);
    ctx.moveTo(-r * 0.5, -r * 0.3);
    ctx.lineTo(-r, 0);
    ctx.lineTo(-r * 0.5, r * 0.3);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

export function renderPowerDuel(ctx: CanvasRenderingContext2D, match: PowerDuelMatch) {
  renderClassicDuel(ctx, match.game);

  if (match.pickup) {
    const { x, y, kind } = match.pickup;
    const pulse = 1 + Math.sin(match.game.tick * 0.05) * 0.15;
    if (kind === 'freeze') {
      drawSnowflake(ctx, x, y, POWERUP.pickupRadius * pulse * 0.7, POWERUP_COLORS.freeze);
    } else {
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
    if ((match.teleportCharges.get(ship.id) ?? 0) > 0) {
      ctx.fillStyle = POWERUP_COLORS.teleport;
      ctx.beginPath();
      ctx.moveTo(ship.x, ship.y - 20);
      ctx.lineTo(ship.x - 4, ship.y - 14);
      ctx.lineTo(ship.x + 4, ship.y - 14);
      ctx.closePath();
      ctx.fill();
    }
    const frozenUntil = match.frozenUntil.get(ship.id);
    if (frozenUntil !== undefined && match.game.tick < frozenUntil) {
      ctx.strokeStyle = POWERUP_COLORS.freeze;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, 15, 0, Math.PI * 2);
      ctx.stroke();
      drawSnowflake(ctx, ship.x, ship.y, 9, POWERUP_COLORS.freeze);
      ctx.fillStyle = POWERUP_COLORS.freeze;
      ctx.font = "bold 9px 'Windows Bold', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('FROZEN', ship.x, ship.y - 24);
      ctx.textAlign = 'left';
    }
  }
}
