import { useId } from "react";
import spriteSheetUrl from "@/assets/classic/original-sprites.png?url";

// A native SVG image paints when its asset decodes, including first mobile visits.
// Keep the original 32px ship cell and remove only its black background.
export function ShipIcon({ size = 100, color }: { size?: number; color?: string }) {
  const filterId = `ship-${useId().replace(/:/g, "")}`;
  const tint = color && /^#[0-9a-f]{6}$/i.test(color)
    ? [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255) : null;
  return <svg width={size} height={size} viewBox="3 3 30 30" role="img"
    aria-label="Alien Force ship" className="ship-icon mx-auto mb-4"
    style={{ aspectRatio: "1", flexShrink: 0, imageRendering: "pixelated" }}>
    <defs><filter id={filterId} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 1 1 0 0" result="blackMask" />
      <feComponentTransfer in="blackMask" result="opaqueMask"><feFuncA type="linear" slope={255} /></feComponentTransfer>
      {tint && <feColorMatrix in="SourceGraphic" type="matrix" values={`${tint[0]} 0 0 0 0  ${tint[1]} 0 0 0 0  ${tint[2]} 0 0 0 0  0 0 0 1 0`} result="tinted" />}
      <feComposite in={tint ? "tinted" : "SourceGraphic"} in2="opaqueMask" operator="in" />
    </filter></defs>
    <image href={spriteSheetUrl} x="0" y="0" width="138" height="104" filter={`url(#${filterId})`} />
  </svg>;
}
