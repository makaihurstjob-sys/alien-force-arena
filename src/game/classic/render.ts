import { CLASSIC, vectors, type Actor, type ClassicState } from "./engine";
export function renderClassic(ctx: CanvasRenderingContext2D, s: ClassicState, paused: boolean) {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, 620, 424);
  ctx.strokeStyle = "#ccc";
  ctx.strokeRect(0.5, 0.5, 423, 423);
  ctx.fillStyle = "#008b8b";
  for (let y = 0; y < 10; y++)
    for (let x = 0; x < 10; x++)
      ctx.fillRect(22 + x * 40, 22 + y * 40, CLASSIC.block, CLASSIC.block);
  const ship = (a: Actor, color: string) => {
    ctx.save();
    ctx.translate(a.x, a.y);
    const [dx, dy] = vectors[a.direction];
    ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-6, -6);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = a.id === 0 ? "#00dddd" : "#ffff00";
    ctx.fillRect(-3, -2, 4, 4);
    ctx.restore();
  };
  for (const e of s.enemies) ship(e, "#ff352b");
  if (s.invulnerable === 0 || Math.floor(s.elapsed * 10) % 2 === 0) ship(s.player, "#eee");
  for (const b of s.shots) {
    ctx.fillStyle = b.owner === 0 ? "white" : "#ffb000";
    ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
  }
  ctx.fillStyle = "#ddd";
  ctx.font = "16px monospace";
  ctx.fillText(`Level ${s.level}`, 450, 300);
  ctx.fillText(String(s.score), 450, 328);
  for (let i = 0; i < s.lives; i++)
    ship({ id: 0, x: 458 + i * 24, y: 355, direction: "up" }, "#eee");
  ctx.font = "12px monospace";
  ctx.fillText(s.shots.some((b) => b.owner === 0) ? "SHOT IN PLAY" : "SHOT READY", 450, 390);
  const message =
    s.phase === "game_over"
      ? "GAME OVER"
      : paused
        ? "PAUSED"
        : s.phase === "level_clear"
          ? "LEVEL CLEAR"
          : null;
  if (message) {
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(65, 172, 290, 65);
    ctx.fillStyle = "white";
    ctx.font = "24px monospace";
    ctx.textAlign = "center";
    ctx.fillText(message, 210, 212);
    ctx.textAlign = "left";
  }
}
