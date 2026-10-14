import { useEffect, useRef } from "react";
import spriteSheetUrl from "@/assets/classic/original-sprites.png?url";

// Crops the player ship, facing up, from the same sheet Classic mode renders from.
export function ShipIcon({ size = 100, color }: { size?: number; color?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    let disposed = false;
    let frame = 0;
    const sheet = new Image();
    const paint = () => {
      if (disposed || !sheet.complete || !sheet.naturalWidth) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(sheet, 2, 2, 32, 32, 0, 0, size, size);
      const pixels = ctx.getImageData(0, 0, size, size);
      const tint = color && /^#[0-9a-f]{6}$/i.test(color)
        ? [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16)) : null;
      for (let i = 0; i < pixels.data.length; i += 4) {
        if (pixels.data[i] === 0 && pixels.data[i + 1] === 0 && pixels.data[i + 2] === 0)
          pixels.data[i + 3] = 0;
        else if (tint) {
          const light = Math.max(pixels.data[i]!, pixels.data[i + 1]!, pixels.data[i + 2]!) / 255;
          for (let channel = 0; channel < 3; channel++) pixels.data[i + channel] = Math.round(tint[channel]! * light);
        }
      }
      ctx.putImageData(pixels, 0, 0);
    };
    sheet.onload = () => {
      paint();
      // Repaint after the browser commits layout/compositing on the first visit.
      frame = requestAnimationFrame(paint);
    };
    sheet.src = spriteSheetUrl;
    if (sheet.complete && sheet.naturalWidth) paint();
    return () => { disposed = true; sheet.onload = null; cancelAnimationFrame(frame); };
  }, [size, color]);
  return (
    <canvas
      ref={canvas}
      width={size}
      height={size}
      role="img"
      aria-label="Alien Force ship"
      className="mx-auto mb-4 [image-rendering:pixelated]"
    />
  );
}
