import { useEffect, useRef } from "react";
import spriteSheetUrl from "@/assets/classic/original-sprites.bmp?url";

// Decorative home-page backdrop: original enemy ships drifting across the screen.
// Sprite sheet layout (see src/assets/classic/README.md): 32px cells from (2,2),
// 34px apart; enemy row at y=70; columns up, left, down, right.
const CELL = 32;
const ENEMY_ROW_Y = 70;
const COLUMN = { left: 1, right: 3 } as const;
const MAX_SHIPS = 14;
const SPAWN_MIN_S = 0.5;
const SPAWN_MAX_S = 1.6;
const SPEED_MIN = 45; // CSS px per second
const SPEED_MAX = 130;
const SCALES = [1, 1.5, 2]; // multiples of the 32px original

type Heading = keyof typeof COLUMN;
type Ship = { x: number; y: number; speed: number; size: number; heading: Heading };

const random = (min: number, max: number) => min + Math.random() * (max - min);

// Cut one enemy cell out of the sheet and make its black background transparent.
function cutSprite(sheet: HTMLImageElement, heading: Heading) {
  const canvas = document.createElement("canvas");
  canvas.width = CELL;
  canvas.height = CELL;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(sheet, 2 + COLUMN[heading] * 34, ENEMY_ROW_Y, CELL, CELL, 0, 0, CELL, CELL);
  const pixels = ctx.getImageData(0, 0, CELL, CELL);
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 0) d[i + 3] = 0;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

export function EnemyShipBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    };
    resize();
    window.addEventListener("resize", resize);

    const sprites: Record<Heading, HTMLCanvasElement | null> = { left: null, right: null };
    const sheet = new Image();
    sheet.onload = () => {
      sprites.left = cutSprite(sheet, "left");
      sprites.right = cutSprite(sheet, "right");
    };
    sheet.src = spriteSheetUrl;

    const ships: Ship[] = [];
    const spawn = (): Ship => {
      const heading: Heading = Math.random() < 0.5 ? "left" : "right";
      const size = CELL * (SCALES[Math.floor(Math.random() * SCALES.length)] ?? 1);
      const ship: Ship = {
        heading,
        size,
        speed: random(SPEED_MIN, SPEED_MAX),
        x: heading === "left" ? width : -size,
        y: Math.round(random(0, Math.max(0, height - size))),
      };
      ships.push(ship);
      return ship;
    };
    // Start with a few ships already mid-screen so the page isn't empty at first.
    for (let i = 0; i < 5; i++) {
      spawn().x = random(0, width);
    }

    let nextSpawn = random(SPAWN_MIN_S, SPAWN_MAX_S);
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      // Clamp so ships don't jump after the tab was in the background.
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      nextSpawn -= dt;
      if (nextSpawn <= 0) {
        if (ships.length < MAX_SHIPS) spawn();
        nextSpawn = random(SPAWN_MIN_S, SPAWN_MAX_S);
      }
      ctx.clearRect(0, 0, width, height);
      for (let i = ships.length - 1; i >= 0; i--) {
        const s = ships[i];
        if (!s) continue;
        s.x += (s.heading === "left" ? -1 : 1) * s.speed * dt;
        if (s.x < -s.size || s.x > width) {
          ships.splice(i, 1);
          continue;
        }
        const sprite = sprites[s.heading];
        if (sprite) ctx.drawImage(sprite, Math.round(s.x), s.y, s.size, s.size);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      sheet.onload = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-50 [image-rendering:pixelated]"
    />
  );
}
