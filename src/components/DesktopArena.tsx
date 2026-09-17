import { useEffect, useRef } from "react";
import spriteSheetUrl from "@/assets/classic/original-sprites.bmp?url";

// Decorative attract scene, independent of gameplay and room state.
export function DesktopArena({ mode, thumbnail = false }: { mode: number; thumbnail?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    let frame = 0;
    let disposed = false;
    const sheet = new Image();
    const sprites = document.createElement("canvas");
    sprites.width = 136;
    sprites.height = 102;
    const spriteContext = sprites.getContext("2d");
    let ready = false;
    const media = window.matchMedia("(min-width: 768px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const draw = (now: number) => {
      if (disposed) return;
      if (media.matches && !document.hidden) {
        const w = 1440,
          h = 900;
        const t = thumbnail || reduced.matches ? 12 : now / 1000;
        ctx.fillStyle = "#1c2022";
        ctx.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 64)
          for (let x = 0; x < w; x += 64) {
            const n = (x * 13 + y * 7) % 19;
            ctx.fillStyle = `rgb(${27 + n / 3},${30 + n / 3},${31 + n / 3})`;
            ctx.fillRect(x + 1, y + 1, 62, 62);
            ctx.strokeStyle = "#ffffff06";
            ctx.strokeRect(x + 3, y + 3, 58, 58);
            ctx.fillStyle = "#080a0b88";
            ctx.fillRect(x + 8, y + 9, 3, 3);
          }
        const blocks: [number, number, number, number][] = [
          [580, 140, 160, 60],
          [980, 260, 60, 180],
          [420, 300, 140, 60],
          [680, 610, 170, 60],
          [1140, 680, 60, 140],
          [400, 730, 150, 60],
          [790, 380, 60, 130],
          [1260, 70, 130, 60],
        ];
        for (const [x, y, bw, bh] of blocks) {
          ctx.fillStyle = "#080a0c";
          ctx.fillRect(x + 9, y + 10, bw, bh);
          ctx.fillStyle = "#555957";
          ctx.fillRect(x, y, bw, bh);
          ctx.fillStyle = "#343938";
          ctx.fillRect(x + 5, y + 5, bw - 10, bh - 10);
          ctx.strokeStyle = "#84867a";
          ctx.strokeRect(x + 2, y + 2, bw - 4, bh - 4);
          ctx.save();
          ctx.beginPath();
          ctx.rect(x + 5, y + bh - 22, bw - 10, 17);
          ctx.clip();
          ctx.fillStyle = "#80713a";
          ctx.fillRect(x, y + bh - 22, bw, 17);
          ctx.strokeStyle = "#202525";
          ctx.lineWidth = 13;
          for (let j = 0; j < bw + 30; j += 29) {
            ctx.beginPath();
            ctx.moveTo(x + j, y + bh);
            ctx.lineTo(x + j + 22, y + bh - 25);
            ctx.stroke();
          }
          ctx.restore();
          for (let k = 0; k < 9; k++) {
            ctx.fillStyle = "#85877b30";
            ctx.fillRect(x + 10 + ((k * 31) % (bw - 18)), y + 8 + ((k * 17) % (bh - 30)), 4, 3);
          }
        }
        ctx.imageSmoothingEnabled = false;
        for (let i = 0; i < 12; i++) {
          const x = 460 + ((i * 193 + mode * 71 + Math.sin(t * 0.22 + i) * 45) % 930);
          const y = 65 + ((i * 137 + mode * 97 + t * (i % 2 ? 12 : -9) + 9000) % 760);
          const player = i === 4;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(player ? 0 : Math.sin(i * 5) * 0.7);
          ctx.shadowColor = player ? "#e0e8ff" : i % 2 ? "#ff4b38" : "#50ff72";
          ctx.shadowBlur = 12;
          ctx.fillStyle = player ? "#dae5fc" : i % 2 ? "#ff563b" : "#65f784";
          ctx.fillRect(-3, 18, 6, 10 + Math.sin(t * 8 + i) * 4);
          ctx.shadowBlur = 0;
          if (ready) ctx.drawImage(sprites, 3, player ? 3 : 71, 30, 30, -24, -24, 48, 48);
          ctx.restore();
          ctx.fillStyle = "#ffda62";
          ctx.shadowColor = "#ffc94c";
          ctx.shadowBlur = 9;
          ctx.fillRect(x + 35, y - ((t * 60 + i * 51) % 220), 4, 12);
          ctx.shadowBlur = 0;
          if (mode === 1 && i % 3 === 0) {
            ctx.strokeStyle = "#ffe066";
            ctx.strokeRect(x + 65, y + 30, 20, 20);
            ctx.fillStyle = "#ffe066";
            ctx.font = "20px monospace";
            ctx.fillText("+", x + 69, y + 47);
          }
        }
      }
      if (!thumbnail) frame = requestAnimationFrame(draw);
    };
    sheet.onload = () => {
      if (disposed || !spriteContext) return;
      spriteContext.drawImage(sheet, 0, 0);
      const pixels = spriteContext.getImageData(0, 0, 136, 102);
      for (let i = 0; i < pixels.data.length; i += 4)
        if (pixels.data[i] === 0 && pixels.data[i + 1] === 0 && pixels.data[i + 2] === 0)
          pixels.data[i + 3] = 0;
      spriteContext.putImageData(pixels, 0, 0);
      ready = true;
      if (thumbnail) draw(0);
    };
    sheet.src = spriteSheetUrl;
    const redraw = () => {
      if (thumbnail) draw(0);
    };
    media.addEventListener("change", redraw);
    draw(0);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      media.removeEventListener("change", redraw);
    };
  }, [mode, thumbnail]);
  return <canvas ref={canvas} width={1440} height={900} aria-hidden="true" />;
}
