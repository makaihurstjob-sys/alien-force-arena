/**
 * Local practice bot. This is an offline opponent only — it is never used for
 * online play and is never presented to the user as a real remote player.
 */

import { BOT, TICK_MS } from "./config";
import { getLayout, hitsObstacle } from "./engine";
import type { GameState, PlayerInput } from "./types";
import { EMPTY_INPUT } from "./types";

const cooldowns: Record<string, number> = {};

export function botInput(state: GameState, botId: string, layoutId: string): PlayerInput {
  const me = state.ships.find((s) => s.id === botId);
  if (!me || !me.alive || state.phase !== "playing") return { ...EMPTY_INPUT };

  const target = state.ships.find((s) => s.team !== me.team && s.alive);
  if (!target) return { ...EMPTY_INPUT };

  const desired = Math.atan2(target.y - me.y, target.x - me.x);
  let diff = normalize(desired - me.angle);
  diff += (Math.random() - 0.5) * BOT.aimErrorRadians;

  const dist = Math.hypot(target.x - me.x, target.y - me.y);
  cooldowns[botId] = (cooldowns[botId] ?? 0) - TICK_MS;

  // only shoot when roughly aimed and nothing blocks the line
  const aimed = Math.abs(diff) < 0.12;
  const clear = lineIsClear(me.x, me.y, target.x, target.y, layoutId);
  let fire = false;
  if (aimed && clear && me.canFire && (cooldowns[botId] ?? 0) <= 0) {
    fire = true;
    cooldowns[botId] = BOT.fireCooldownMs;
  }

  return {
    left: diff < -0.03,
    right: diff > 0.03,
    thrust: dist > 220 && Math.abs(diff) < 0.8,
    reverse: dist < 110,
    fire,
  };
}

function lineIsClear(x1: number, y1: number, x2: number, y2: number, layoutId: string) {
  const layout = getLayout(layoutId);
  const steps = 24;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (hitsObstacle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 3, layout)) return false;
  }
  return true;
}

function normalize(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
