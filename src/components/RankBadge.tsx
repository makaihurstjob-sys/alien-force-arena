import type { CSSProperties } from "react";
import { Medal } from "lucide-react";
import "./rank-badge.css";
// Render only complete artwork from the supplied sheet. Preserve every pixel.
const artwork: Record<string, { x: number; y: number }> = {
  commander: { x: 162, y: 160 }, ace: { x: 692, y: 160 },
  pilot: { x: 162, y: 689 }, scout: { x: 692, y: 689 },
};
export default function RankBadge({ id, name, className = "" }: { id: string; name: string; className?: string }) {
  const badge = artwork[id];
  const standalone = id === "cadet" || id === "captain" ? `${import.meta.env.BASE_URL}ranks/${id}-badge.png` : null;
  return <span className={`rank-badge ${standalone ? "has-standalone-artwork" : badge ? "has-artwork" : "is-placeholder"} ${className}`} role="img" aria-label={`${name} rank badge${badge || standalone ? "" : " (artwork pending)"}`}>
    {standalone ? <img src={standalone} alt="" aria-hidden="true" draggable={false} /> : badge ? <img src={`${import.meta.env.BASE_URL}ranks/framber-reference.png`} alt="" aria-hidden="true" draggable={false}
      style={{ "--badge-x": `${-badge.x / 510 * 100}%`, "--badge-y": `${-badge.y / 510 * 100}%` } as CSSProperties} /> : <Medal aria-hidden="true" />}
  </span>;
}
