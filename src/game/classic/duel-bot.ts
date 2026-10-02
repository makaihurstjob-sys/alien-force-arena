/**
 * Local-only bot for Classic's duel physics. Practice's freeform-aim bot.ts
 * doesn't apply here: duel.ts only understands four ABSOLUTE directions
 * (thrust=up, reverse=down, left=left, right=right), not turn-rate steering,
 * so "aiming" is just picking which of the four flags to set.
 */

import { CLASSIC } from './engine';
import type { PlayerInput } from '../types';
import type { PowerDuelMatch } from './powerup-duel';

const FIRE_TOLERANCE = 6; // px — "on the same lane" for firing purposes
const TELEPORT_RANGE = CLASSIC.spacing * 2; // only teleport when the target is meaningfully far

const IDLE: PlayerInput = { thrust: false, reverse: false, left: false, right: false, fire: false, dash: false };

export function duelBotInput(match: PowerDuelMatch, botId: string): PlayerInput {
  const { game } = match;
  const me = game.ships.find((s) => s.id === botId);
  if (!me || !me.alive || game.phase !== 'playing') return { ...IDLE };

  const opponent = game.ships.find((s) => s.id !== botId && s.alive);
  const target: { x: number; y: number } | undefined = match.pickup ?? opponent;
  const input: PlayerInput = { ...IDLE };
  if (!target) return input;

  const dx = target.x - me.x;
  const dy = target.y - me.y;
  if (Math.abs(dx) > FIRE_TOLERANCE || Math.abs(dy) > FIRE_TOLERANCE) {
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) input.right = true;
      else input.left = true;
    } else {
      if (dy > 0) input.reverse = true;
      else input.thrust = true;
    }
  }

  if (opponent && me.canFire) {
    const alignedX = Math.abs(me.x - opponent.x) < FIRE_TOLERANCE;
    const alignedY = Math.abs(me.y - opponent.y) < FIRE_TOLERANCE;
    if (alignedX || alignedY) input.fire = true;
  }

  const charges = match.teleportCharges.get(botId) ?? 0;
  if (charges > 0 && (Math.abs(dx) > TELEPORT_RANGE || Math.abs(dy) > TELEPORT_RANGE)) input.dash = true;

  return input;
}
