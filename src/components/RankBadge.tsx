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
  return <span className={`rank-badge ${badge ? "has-artwork" : "is-placeholder"} ${className}`} role="img" aria-label={`${name} rank badge${badge ? "" : " (artwork pending)"}`}>
    {badge ? <img src={`${import.meta.env.BASE_URL}ranks/framber-reference.png`} alt="" aria-hidden="true" draggable={false}
      style={{ "--badge-x": `${-badge.x / 510 * 100}%`, "--badge-y": `${-badge.y / 510 * 100}%` } as CSSProperties} /> : <Medal aria-hidden="true" />}
  </span>;
}
