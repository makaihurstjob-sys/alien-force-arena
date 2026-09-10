import { useEffect, useRef, useState } from "react";
import {
  createClassic,
  tickClassic,
  type ClassicInput,
  type Direction,
} from "@/game/classic/engine";
import "@/routes/classic-controls.css";
import { renderClassic } from "@/game/classic/render";
export default function Classic({ menuHref = "/" }: { menuHref?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef(createClassic());
  const input = useRef<ClassicInput>({ direction: null, fire: false });
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState({ score: 0, level: 1, lives: 3, over: false });
  useEffect(() => {
    const keys: Record<string, Direction> = {
      ArrowUp: "up",
      KeyW: "up",
      ArrowDown: "down",

      ArrowLeft: "left",
      KeyA: "left",
      ArrowRight: "right",
      KeyD: "right",
    };
    const held = new Map<string, Direction>();
    const clear = () => {
      held.clear();
      input.current = { direction: null, fire: false };
    };
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,select,[contenteditable=true]")) return;
      if ((e.target as HTMLElement).closest("button,a") && ["Space", "Enter"].includes(e.code))
        return;
      const d = keys[e.code];
      if (d || e.code === "Space") e.preventDefault();
      if (d) {
        held.delete(e.code);
        held.set(e.code, d);
        input.current.direction = d;
      }
      if (e.code === "Space") input.current.fire = true;
      if (e.code === "KeyR" && !e.repeat) input.current.reverse = true;
      if ((e.code === "Escape" || e.code === "KeyP") && !e.repeat) setPaused((p) => !p);
    };
    const up = (e: KeyboardEvent) => {
      held.delete(e.code);
      input.current.direction = Array.from(held.values()).at(-1) ?? null;
      if (e.code === "Space") input.current.fire = false;
    };
    const blur = () => {
      clear();
      setPaused(true);
    };
    const visibility = () => {
      if (document.hidden) blur();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clear();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [paused]);
  useEffect(() => {
    input.current = { direction: null, fire: false };
    let raf = 0,
      last = performance.now(),
      accumulator = 0,
      hud = 0;
    const frame = (now: number) => {
      accumulator += Math.min(now - last, 100);
      last = now;
      while (accumulator >= 1000 / 60) {
        if (!paused) {
          tickClassic(game.current, input.current);
          input.current.reverse = false;
        }
        accumulator -= 1000 / 60;
      }
      const ctx = canvas.current?.getContext("2d");
      if (ctx) renderClassic(ctx, game.current, paused);
      if (now - hud > 100) {
        const s = game.current;
        setStats({ score: s.score, level: s.level, lives: s.lives, over: s.phase === "game_over" });
        hud = now;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [paused]);
  const restart = () => {
    game.current = createClassic();
    input.current = { direction: null, fire: false };
    setPaused(false);
    canvas.current?.focus();
  };
  return (
    <main className="min-h-screen bg-background p-4 font-mono text-foreground">
      <div className="mx-auto max-w-4xl space-y-4">
        <a href={menuHref}>Main menu</a>
        <h1 className="text-2xl">Alien Force - Classic</h1>
        <div className="border-2 border-gray-400 bg-gray-300 p-1 text-black">
          <div className="bg-blue-900 px-2 py-1 text-white">Alien Force</div>
          <div className="flex gap-5 p-2">
            <button onClick={restart}>New game</button>
            <button
              onClick={() => {
                setPaused((p) => !p);
                canvas.current?.focus();
              }}
            >
              {paused ? "Resume" : "Pause"}
            </button>
          </div>
          <canvas
            ref={canvas}
            tabIndex={0}
            onPointerDown={() => canvas.current?.focus()}
            width={620}
            height={424}
            className="w-full bg-black"
            aria-label="Classic Alien Force playfield"
          />
        </div>
        <p>
          Level {stats.level} | Score {stats.score} | Lives {stats.lives}
          {stats.over ? " | Game over - select New game to retry." : ""}
        </p>
        <p className="text-sm">
          Arrows: steer through lanes. R: reverse. Space: fire. P / Escape: pause. Your ship keeps
          moving when you release a direction.
        </p>
        <section className="classic-controller" aria-label="Game Boy touch controls">
          <div className="classic-controller-main">
            <div className="classic-dpad" role="group" aria-label="Direction pad">
              {(["up", "left", "down", "right"] as const).map((direction) => (
                <button
                  key={direction}
                  className={`classic-pad-key classic-pad-${direction}`}
                  aria-label={`Move ${direction}`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    input.current.direction = direction;
                  }}
                  onPointerUp={() => {
                    if (input.current.direction === direction) input.current.direction = null;
                  }}
                  onPointerCancel={() => {
                    if (input.current.direction === direction) input.current.direction = null;
                  }}
                  onLostPointerCapture={() => {
                    if (input.current.direction === direction) input.current.direction = null;
                  }}
                  onClick={(e) => {
                    if (e.detail === 0) input.current.direction = direction;
                  }}
                >
                  {{ up: "\u25b2", left: "\u25c0", down: "\u25bc", right: "\u25b6" }[direction]}
                </button>
              ))}
              <span className="classic-pad-center" aria-hidden="true" />
            </div>
            <div className="classic-ab" role="group" aria-label="Action buttons">
              <div className="classic-action classic-action-b">
                <button
                  className="classic-round"
                  aria-label="B: Reverse"
                  onClick={() => {
                    input.current.direction = null;
                    input.current.reverse = true;
                  }}
                >
                  B
                </button>
                <span>REVERSE</span>
              </div>
              <div className="classic-action classic-action-a">
                <button
                  className="classic-round"
                  aria-label="A: Fire"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    input.current.fire = true;
                  }}
                  onPointerUp={() => {
                    input.current.fire = false;
                  }}
                  onPointerCancel={() => {
                    input.current.fire = false;
                  }}
                  onLostPointerCapture={() => {
                    input.current.fire = false;
                  }}
                  onKeyDown={(e) => {
                    if (e.code === "Space" || e.code === "Enter") input.current.fire = true;
                  }}
                  onKeyUp={() => {
                    input.current.fire = false;
                  }}
                  onBlur={() => {
                    input.current.fire = false;
                  }}
                >
                  A
                </button>
                <span>FIRE</span>
              </div>
            </div>
          </div>
          <div className="classic-system-buttons">
            <a href={menuHref} className="classic-system">
              <span aria-hidden="true">&#9473;</span>MENU
            </a>
            <button
              className="classic-system"
              aria-label="Select: Reverse"
              onClick={() => {
                input.current.reverse = true;
              }}
            >
              <span aria-hidden="true">&#9473;</span>SELECT<small>REVERSE</small>
            </button>
            <button
              className="classic-system"
              aria-label={paused ? "Start: Resume" : "Start: Pause"}
              onClick={() => {
                setPaused((p) => !p);
                canvas.current?.focus();
              }}
            >
              <span aria-hidden="true">&#9473;</span>START
              <small>{paused ? "RESUME" : "PAUSE"}</small>
            </button>
          </div>
        </section>
        <p className="text-xs text-muted-foreground">
          Video-informed reconstruction. Movement speed, enemy AI, and the firing penalty are
          provisional; this is not yet an exact recreation.
        </p>
      </div>
    </main>
  );
}
