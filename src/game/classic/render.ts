import spriteSheetUrl from "@/assets/classic/original-sprites.png?url";

// Original 32px cells, separated by 2px white borders. Load only in the browser.
let spriteSheet: HTMLImageElement | undefined;
function getSpriteSheet() {
  if (!spriteSheet && typeof Image !== "undefined") {
    spriteSheet = new Image();
    spriteSheet.src = spriteSheetUrl;
  }
  return spriteSheet?.complete && spriteSheet.naturalWidth > 0 ? spriteSheet : null;
}
import { CLASSIC, type Actor, type ClassicState, EXIT_DOOR } from "./engine";
export function renderClassic(
  ctx: CanvasRenderingContext2D,
  s: ClassicState,
  paused: boolean,
  showPlayer = true,
) {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, 620, 424);
  ctx.strokeStyle = "#ccc";
  ctx.strokeRect(0.5, 0.5, 423, 423);
  ctx.fillStyle = "#008b8b";
  for (let y = 0; y < 10; y++)
    for (let x = 0; x < 10; x++)
      ctx.fillRect(22 + x * 40, 22 + y * 40, CLASSIC.block, CLASSIC.block);
  if (s.adventure) {
    const boss = s.enemies.find((e) => e.boss);
    if (boss) {
      ctx.fillStyle = "#572437";
      ctx.fillRect(85, 46, 254, 8);
      ctx.fillStyle = "#ff486d";
      ctx.fillRect(85, 46, (254 * (boss.health ?? 1)) / (boss.maxHealth ?? 1), 8);
    }
    const open = s.phase === "level_clear";
    ctx.fillStyle = open ? "#63ffce" : "#344555";
    ctx.fillRect(EXIT_DOOR.x - 13, 1, 26, 20);
    ctx.fillStyle = "#07131d";
    ctx.fillRect(EXIT_DOOR.x - 9, 3, 18, 16);
    if (open) {
      ctx.fillStyle = "#63ffce";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText("↑ EXIT OPEN · FLY TO THE DOOR ↑", 212, 400);
      ctx.textAlign = "left";
    }
  }
  const sprites = getSpriteSheet();
  ctx.imageSmoothingEnabled = false;
  const ship = (a: Actor) => {
    if (s.adventure && a.id === 0) {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate({ up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[a.direction]);
      ctx.fillStyle = s.shipColor ?? "white";
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(8, 7);
      ctx.lineTo(0, 4);
      ctx.lineTo(-8, 7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#163b60";
      ctx.fillRect(-2, -2, 4, 5);
      ctx.restore();
      return;
    }
    if (!sprites) return;
    const column = { up: 0, left: 1, down: 2, right: 3 }[a.direction];
    // Half-size maps the original 32px artwork to the existing 20px lanes.
    ctx.drawImage(
      sprites,
      2 + column * 34,
      a.id === 0 ? 2 : 70,
      32,
      32,
      Math.round(a.x) - 8,
      Math.round(a.y) - 8,
      16,
      16,
    );
  };
  for (const e of s.enemies) {
    ship(e);
    if (e.boss) {
      ctx.strokeStyle = "#ff486d";
      ctx.lineWidth = 3;
      ctx.strokeRect(e.x - 11, e.y - 11, 22, 22);
      ctx.lineWidth = 1;
    }
    if ((e.maxHealth ?? 1) > 1) {
      ctx.fillStyle = "#ffcf53";
      ctx.fillRect(Math.round(e.x) + 5, Math.round(e.y) - 13, 12, 11);
      ctx.fillStyle = "#171717";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(String(e.health ?? 1), Math.round(e.x) + 11, Math.round(e.y) - 4);
      ctx.textAlign = "left";
    }
  }
  if (showPlayer && (s.invulnerable === 0 || Math.floor(s.elapsed * 10) % 2 === 0)) ship(s.player);
  for (const b of s.shots) {
    ctx.fillStyle = b.owner === 0 ? "white" : "#ffb000";
    ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
  }
  if (ctx.canvas.width > CLASSIC.size) {
    ctx.fillStyle = "#ddd";
    ctx.font = '16px \"Windows Bold\", monospace';
    ctx.fillText(`Level ${s.level}`, 450, 300);
    ctx.fillText(String(s.score), 450, 328);
    for (let i = 0; i < s.lives; i++) ship({ id: 0, x: 458 + i * 24, y: 355, direction: "up" });
    ctx.font = '12px \"Windows Bold\", monospace';
    ctx.fillText(s.shots.some((b) => b.owner === 0) ? "SHOT IN PLAY" : "SHOT READY", 450, 390);
  }
  const message =
    s.phase === "game_over"
      ? s.completed
        ? "UNIVERSE SAVED"
        : "GAME OVER"
      : paused
        ? "PAUSED"
        : s.phase === "level_clear"
          ? s.adventure
            ? null
            : "LEVEL CLEAR"
          : s.phase === "waiting"
            ? s.waitingReason === "respawn"
              ? "MOVE TO RESUME"
              : "MOVE TO START"
            : null;
  if (message) {
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(65, 172, 290, 65);
    ctx.fillStyle = "white";
    ctx.font = '24px "Windows Bold", monospace';
    ctx.textAlign = "center";
    ctx.fillText(message, 210, 212);
    ctx.textAlign = "left";
  }
}
