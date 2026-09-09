/**
 * Canvas renderer. Deliberately simple, chunky, Windows-3.1 flavoured:
 * hard edges, dithered grid floor, no anti-aliased gradients.
 */

import { ARENA, PROJECTILE, SHIP } from "./config";
import { getLayout } from "./engine";
import type { GameState } from "./types";

const TEAM_COLORS = ["#3ee08a", "#ff5f5f"];

export function render(ctx: CanvasRenderingContext2D, state: GameState, layoutId: string) {
  const layout = getLayout(layoutId);

  // floor
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  ctx.strokeStyle = "#182130";
  ctx.lineWidth = 1;
  for (let x = 0; x <= ARENA.width; x += 40) {
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, ARENA.height); ctx.stroke();
  }
  for (let y = 0; y <= ARENA.height; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(ARENA.width, y + 0.5); ctx.stroke();
  }

  // obstacles: beveled "Windows button" look
  for (const o of layout.obstacles) {
    ctx.fillStyle = "#5b6472";
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = "#8d97a6";
    ctx.fillRect(o.x, o.y, o.w, 3);
    ctx.fillRect(o.x, o.y, 3, o.h);
    ctx.fillStyle = "#2b313b";
    ctx.fillRect(o.x, o.y + o.h - 3, o.w, 3);
    ctx.fillRect(o.x + o.w - 3, o.y, 3, o.h);
  }

  // ships
  for (const ship of state.ships) {
    if (!ship.alive) continue;
    const color = TEAM_COLORS[ship.team]!;
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(SHIP.radius, 0);
    ctx.lineTo(-SHIP.radius * 0.8, -SHIP.radius * 0.8);
    ctx.lineTo(-SHIP.radius * 0.3, 0);
    ctx.lineTo(-SHIP.radius * 0.8, SHIP.radius * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(-2, -3, 6, 6);
    ctx.restore();

    // reload ring: solid when the player may fire
    ctx.strokeStyle = ship.canFire ? color : "#4a5260";
    ctx.setLineDash(ship.canFire ? [] : [3, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, SHIP.radius + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#c8d2e0";
    ctx.font = "10px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(ship.name, ship.x, ship.y - SHIP.radius - 12);
  }

  // projectiles
  for (const p of state.projectiles) {
    ctx.fillStyle = "#ffe066";
    ctx.fillRect(
      Math.round(p.x - PROJECTILE.radius),
      Math.round(p.y - PROJECTILE.radius),
      PROJECTILE.radius * 2 + 1,
      PROJECTILE.radius * 2 + 1,
    );
  }

  // phase overlays
  if (state.phase === "countdown") {
    overlayText(ctx, String(Math.ceil(state.phaseTimerMs / 1000)));
  } else if (state.phase === "round_over") {
    const w = state.lastRoundWinner;
    overlayText(ctx, w === null ? "DRAW" : `TEAM ${w === 0 ? "GREEN" : "RED"} WINS ROUND`);
  }
}

function overlayText(ctx: CanvasRenderingContext2D, text: string) {
  ctx.fillStyle = "rgba(13,17,23,0.55)";
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  ctx.fillStyle = "#ffe066";
  ctx.font = "bold 40px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, ARENA.width / 2, ARENA.height / 2);
}
