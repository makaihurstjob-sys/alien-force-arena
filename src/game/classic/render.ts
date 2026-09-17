import spriteSheetUrl from "@/assets/classic/original-sprites.bmp?url";

// Original 32px cells, separated by 2px white borders. Load only in the browser.
let spriteSheet: HTMLImageElement | undefined;
function getSpriteSheet() {
  if (!spriteSheet && typeof Image !== "undefined") {
    spriteSheet = new Image();
    spriteSheet.src = spriteSheetUrl;
  }
  return spriteSheet?.complete && spriteSheet.naturalWidth > 0 ? spriteSheet : null;
}
import { CLASSIC, type Actor, type ClassicState } from "./engine";
export function renderClassic(ctx: CanvasRenderingContext2D, s: ClassicState, paused: boolean, showPlayer = true) {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, 620, 424);
  ctx.strokeStyle = "#ccc";
  ctx.strokeRect(0.5, 0.5, 423, 423);
  ctx.fillStyle = "#008b8b";
  for (let y = 0; y < 10; y++)
    for (let x = 0; x < 10; x++)
      ctx.fillRect(22 + x * 40, 22 + y * 40, CLASSIC.block, CLASSIC.block);
  const sprites = getSpriteSheet();
  ctx.imageSmoothingEnabled = false;
  const ship = (a: Actor) => {
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
  for (const e of s.enemies) ship(e);
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
      ? "GAME OVER"
      : paused
        ? "PAUSED"
        : s.phase === "level_clear"
          ? "LEVEL CLEAR"
          : s.phase === "countdown"
            ? String(Math.max(1, Math.ceil(s.timer)))
            : null;
  if (message) {
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(65, 172, 290, 65);
    ctx.fillStyle = "white";
    ctx.font = (s.phase === "countdown" && !paused ? '48px ' : '24px ') + '\"Windows Bold\", monospace';
    ctx.textAlign = "center";
    ctx.fillText(message, 210, 212);
    ctx.textAlign = "left";
  }
}
