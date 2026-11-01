import { useEffect, useId, useRef, useState } from "react";
import { adventureSector } from "@/game/classic/engine";
import { campaignRoute } from "@/lib/campaign-route";
import "./adventure-route.css";
export default function AdventureRouteMap({
  level,
  onContinue,
  onClose,
}: {
  level: number;
  onContinue: () => void;
  onClose?: () => void;
}) {
  const current = adventureSector(level);
  const [sector, setSector] = useState(current.number);
  const nodes = campaignRoute(level, sector);
  const selected = adventureSector((sector - 1) * 20 + 1);
  const id = useId().replace(/:/g, "");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.querySelector<HTMLButtonElement>("[data-continue]")?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  const route = nodes
    .map((node, index) =>
      index
        ? `C ${nodes[index - 1]!.x} ${(nodes[index - 1]!.y + node.y) / 2} ${node.x} ${(nodes[index - 1]!.y + node.y) / 2} ${node.x} ${node.y}`
        : `M ${node.x} ${node.y}`,
    )
    .join(" ");
  return (
    <div
      ref={root}
      className="adventure-route"
      role="dialog"
      aria-modal="true"
      aria-label="Adventure star route"
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape" && onClose) onClose();
        if (e.key === "Tab") {
          const buttons = Array.from(
            e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
          );
          if (e.shiftKey && document.activeElement === buttons[0]) {
            e.preventDefault();
            buttons.at(-1)?.focus();
          } else if (!e.shiftKey && document.activeElement === buttons.at(-1)) {
            e.preventDefault();
            buttons[0]?.focus();
          }
        }
      }}
    >
      <section className="route-frame">
        <header>
          <div>
            <small>OPERATION LAST LIGHT / CAMPAIGN ROUTE</small>
            <h1>{selected.name}</h1>
            <p>
              Sector {sector} / 50 · {nodes[0]!.level}–{nodes.at(-1)!.level}
            </p>
          </div>
          <strong>MISSION {String(level).padStart(3, "0")}</strong>
        </header>
        <svg
          viewBox="0 0 960 600"
          className="route-galaxy"
          role="img"
          aria-label={`Connected mission route for sector ${sector}. Mission ${level} is the current destination; later missions are locked.`}
        >
          <defs>
            <radialGradient id={`${id}-space`}>
              <stop stopColor="#1d465b" />
              <stop offset="1" stopColor="#06101f" />
            </radialGradient>
            <linearGradient id={`${id}-path`}>
              <stop stopColor="#6ff2d3" />
              <stop offset="1" stopColor="#648cff" />
            </linearGradient>
          </defs>
          <rect width="960" height="600" fill={`url(#${id}-space)`} />
          {Array.from({ length: 95 }, (_, i) => (
            <circle
              key={i}
              cx={(i * 173 + 13) % 960}
              cy={(i * 83 + 27) % 600}
              r={i % 7 === 0 ? 1.8 : 0.8}
              fill="#b5ddf5"
              opacity={0.2 + (i % 4) * 0.1}
            />
          ))}
          <g fill="#203a50" stroke="#4e6b82" opacity=".7">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <path
                key={i}
                transform={`translate(${60 + i * 143} ${260 + (i % 3) * 55}) rotate(${i * 35})`}
                d="m0-19 23 12 7 23-22 16-24-17Z"
              />
            ))}
          </g>
          <circle cx="745" cy="300" r="92" fill="#376785" opacity=".12" />
          <ellipse
            cx="745"
            cy="300"
            rx="132"
            ry="30"
            transform="rotate(-30 745 300)"
            fill="none"
            stroke="#78c2df"
            opacity=".12"
            strokeWidth="8"
          />
          <path d={route} fill="none" stroke="#152c41" strokeWidth="14" />
          <path
            d={route}
            fill="none"
            stroke={`url(#${id}-path)`}
            strokeWidth="3"
            strokeDasharray="3 11"
            strokeLinecap="round"
            opacity=".7"
          />
          {nodes.map((node) => (
            <g
              key={node.level}
              className={`route-node is-${node.state} ${node.boss ? "is-boss" : ""}`}
              transform={`translate(${node.x} ${node.y})`}
              role="img"
              aria-label={`Level ${node.level}, ${node.state}${node.boss ? ", commander" : ""}`}
            >
              {node.state === "current" && (
                <>
                  <circle
                    className="route-orbit"
                    r="37"
                    fill="none"
                    stroke="#8fffe0"
                    strokeWidth="2"
                  />
                  <circle r="46" fill="#80ffdc" opacity=".08" />
                </>
              )}
              <ellipse cy="14" rx="30" ry="13" fill="#020b17" />
              <circle
                r={node.boss ? 24 : 19}
                fill={
                  node.state === "current"
                    ? "#abf6d9"
                    : node.state === "cleared"
                      ? "#397c83"
                      : "#142b3f"
                }
                stroke={node.boss ? "#ff927c" : node.state === "current" ? "#e0fff3" : "#517b97"}
                strokeWidth="3"
              />
              <path d="m-12-6 12-7 12 7" fill="none" stroke="#bdedff" opacity=".35" />
              <text
                y="6"
                textAnchor="middle"
                fill={node.state === "current" ? "#082c28" : "#d6eafa"}
                fontSize="14"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {node.state === "cleared" ? "✓" : node.boss ? "◆" : node.level}
              </text>
              <text
                y="44"
                textAnchor="middle"
                fill={node.state === "current" ? "#a9ffe5" : "#8eafc6"}
                fontSize="11"
                fontFamily="monospace"
              >
                {node.boss
                  ? node.level === 999
                    ? "THE CORE"
                    : `BOSS ${node.level}`
                  : node.state === "current"
                    ? "YOU ARE HERE"
                    : node.state === "locked"
                      ? "LOCKED"
                      : `LEVEL ${node.level}`}
              </text>
            </g>
          ))}
        </svg>
        <footer>
          <nav aria-label="Browse sectors">
            <button disabled={sector === 1} onClick={() => setSector((s) => s - 1)}>
              ← Sector
            </button>
            <button disabled={sector === 50} onClick={() => setSector((s) => s + 1)}>
              Sector →
            </button>
            {sector !== current.number && (
              <button onClick={() => setSector(current.number)}>Current route</button>
            )}
          </nav>
          <p>Clear each mission to unlock the next gate. Commanders guard every 20th level.</p>
          <button data-continue className="route-launch" onClick={onContinue}>
            Enter level {level} ↗
          </button>
          {onClose && <button onClick={onClose}>Back to flight</button>}
        </footer>
      </section>
    </div>
  );
}
