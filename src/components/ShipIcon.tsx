import { useEffect, useRef } from "react";
import spriteSheetUrl from "@/assets/classic/original-sprites.bmp?url";

// Crops the player ship, facing up, from the same sheet Classic mode renders from.
export function ShipIcon({ size = 100 }: { size?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const sheet = new Image();
    sheet.onload = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(sheet, 2, 2, 32, 32, 0, 0, size, size);
      const pixels = ctx.getImageData(0, 0, size, size);
      for (let i = 0; i < pixels.data.length; i += 4) {
        if (pixels.data[i] === 0 && pixels.data[i + 1] === 0 && pixels.data[i + 2] === 0)
          pixels.data[i + 3] = 0;
      }
      ctx.putImageData(pixels, 0, 0);
    };
    sheet.src = spriteSheetUrl;
  }, [size]);
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
