export type RouteNode = {
  level: number;
  x: number;
  y: number;
  boss: boolean;
  state: "cleared" | "current" | "locked";
};
export function campaignRoute(
  level: number,
  sector = Math.floor((level - 1) / 20) + 1,
): RouteNode[] {
  const start = (Math.max(1, Math.min(50, sector)) - 1) * 20 + 1;
  return Array.from({ length: Math.min(20, 1000 - start) }, (_, i) => {
    const row = Math.floor(i / 4),
      column = row % 2 ? 3 - (i % 4) : i % 4;
    const nodeLevel = start + i;
    return {
      level: nodeLevel,
      x: 120 + column * 240,
      y: 80 + row * 108,
      boss: nodeLevel % 20 === 0 || nodeLevel === 999,
      state: nodeLevel < level ? "cleared" : nodeLevel === level ? "current" : "locked",
    };
  });
}
