import { useEffect, useRef, useState } from "react";
import { type ClassicState, ENTRY_DOOR } from "@/game/classic/engine";
import { renderClassic } from "@/game/classic/render";
import { ShipIcon } from "./ShipIcon";
import "./adventure-transit.css";
export default function AdventureTransit({
  scene,
  game,
  onFinish,
}: {
  scene: "travel" | "arrival";
  game: ClassicState;
  onFinish: () => void;
}) {
  const duration = scene === "travel" ? 3600 : 2200;
  const [progress, setProgress] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const finish = useRef(onFinish);
  finish.current = onFinish;
  const state = useRef(game);
  state.current = game;
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.querySelector("button")?.focus();
    let frame = 0,
      elapsed = 0,
      last: number | null = null,
      hud = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = (now: number) => {
      if (document.hidden) last = null;
      else {
        if (last !== null) elapsed += Math.min(100, now - last);
        last = now;
      }
      const amount = Math.min(1, elapsed / duration);
      if (now - hud > 40) {
        setProgress(amount);
        hud = now;
      }
      if (scene === "arrival") {
        const ctx = canvas.current?.getContext("2d");
        if (ctx) {
          renderClassic(
            ctx,
            {
              ...state.current,
              scene: undefined,
              phase: "playing",
              invulnerable: 0,
              shots: [],
              player: {
                ...state.current.player,
                x: reduced
                  ? ENTRY_DOOR.x
                  : 458 - (458 - ENTRY_DOOR.x) * (1 - Math.pow(1 - amount, 3)),
                y: ENTRY_DOOR.y,
                direction: "left",
              },
            },
            false,
          );
          ctx.strokeStyle = "#9bffe0";
          ctx.lineWidth = 3;
          ctx.strokeRect(411, 398, 12, 25);
        }
      }
      if (amount >= 1) {
        finish.current();
        return;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
    };
  }, [scene, duration]);
  return (
    <div
      ref={root}
      className={`adventure-transit is-${scene}`}
      role="dialog"
      aria-modal="true"
      aria-label={scene === "travel" ? "Flying to the next level" : "Entering the mission gate"}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") finish.current();
        if (e.key === "Tab") {
          e.preventDefault();
          root.current?.querySelector("button")?.focus();
        }
      }}
    >
      <section>
        <header>
          <small>OPERATION LAST LIGHT</small>
          <h2>
            {scene === "travel"
              ? `Mission ${game.level - 1} secured`
              : `Entering level ${game.level}`}
          </h2>
          <p>
            {scene === "travel"
              ? "Gate locked. Course plotted. The next world is waiting."
              : "Arriving through the lower-right gate. Combat waits for your first move."}
          </p>
        </header>
        {scene === "travel" ? (
          <div
            className="transit-space"
            style={{ "--flight-progress": progress } as React.CSSProperties}
            aria-hidden="true"
          >
            <div className="transit-nebula" />
            <div className="transit-stars" />
            <span className="transit-gate departure" />
            <span className="transit-gate destination" />
            <div
              className="transit-ship"
              style={{
                left: `${12 + progress * 72}%`,
                transform: `translate(-50%,-50%) rotate(${90 + Math.sin(progress * Math.PI) * 8}deg) scale(${1 - Math.max(0, progress - 0.8) * 2})`,
              }}
            >
              <ShipIcon
                size={100}
                color={
                  (game.transferPending ? game.previousShipColor : game.shipColor) ?? "#e8f5ff"
                }
              />
              <i />
            </div>
            <span className="transit-coordinates">
              GATE {String(game.level - 1).padStart(3, "0")} → GATE{" "}
              {String(game.level).padStart(3, "0")}
            </span>
          </div>
        ) : (
          <canvas
            ref={canvas}
            width={424}
            height={424}
            aria-label="Your ship arrives at the bottom-right corner of the next level"
          />
        )}
        <div className="transit-progress">
          <i style={{ transform: `scaleX(${progress})` }} />
        </div>
        <footer>
          <span>
            {scene === "arrival"
              ? "Enemies are holding position."
              : "Interstellar transit in progress…"}
          </span>
          <button onClick={() => finish.current()}>Skip flight</button>
        </footer>
      </section>
    </div>
  );
}
