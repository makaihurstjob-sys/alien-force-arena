import ClassicController from "./ClassicController";
import ClassicWindow, { type MenuController } from "./ClassicWindow";
import spriteSheetUrl from "@/assets/classic/original-sprites.bmp?url";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createClassic,
  tickClassic,
  type ClassicInput,
  type Direction,
} from "@/game/classic/engine";
import "@/routes/classic-controls.css";
import { renderClassic } from "@/game/classic/render";
export default function Classic({ menuHref = "/" }: { menuHref?: string }) {
  const [mobileArena, setMobileArena] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const update = () => setMobileArena(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const menuController = useRef<MenuController>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef(createClassic());
  const input = useRef<ClassicInput>({ direction: null, fire: false });
  const [paused, setPaused] = useState(false);
  const [awayPaused, setAwayPaused] = useState(false);
  const away = useRef(false);
  const resumeFromAway = useCallback(() => {
    away.current = false;
    setAwayPaused(false);
  }, []);
  const [windowBlocked, setWindowBlocked] = useState(false);
  const simulationPaused = paused || awayPaused || windowBlocked;
  const pauseRef = useRef(simulationPaused);
  useEffect(() => {
    pauseRef.current = simulationPaused;
    if (simulationPaused) input.current = { direction: null, fire: false };
  }, [simulationPaused]);
  const [stats, setStats] = useState({
    score: 0,
    level: 1,
    lives: 3,
    over: false,
    shotInPlay: false,
  });
  useEffect(() => {
    const keys: Record<string, Direction> = {
      ArrowUp: "up",
      KeyW: "up",
      ArrowDown: "down",
      KeyS: "down",
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
      if (windowBlocked) return;
      if ((e.target as HTMLElement).closest("input,textarea,select,[contenteditable=true]")) return;
      if ((e.target as HTMLElement).closest("button,a") && ["Space", "Enter"].includes(e.code))
        return;
      const d = keys[e.code];
      if (d || e.code === "Space") e.preventDefault();
      if (d || e.code === "Space" || e.code === "KeyR") resumeFromAway();
      if (d) {
        held.delete(e.code);
        held.set(e.code, d);
        input.current.direction = d;
      }
      if (e.code === "Space") input.current.fire = true;
      if (e.code === "KeyR" && !e.repeat) input.current.reverse = true;
      if ((e.code === "Escape" || e.code === "KeyP") && !e.repeat) {
        if (away.current) resumeFromAway();
        else setPaused((p) => !p);
      }
    };
    const up = (e: KeyboardEvent) => {
      held.delete(e.code);
      input.current.direction = Array.from(held.values()).at(-1) ?? null;
      if (e.code === "Space") input.current.fire = false;
    };
    const blur = () => {
      clear();
      away.current = true;
      setAwayPaused(true);
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
  }, [windowBlocked, resumeFromAway]);
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
        if (!pauseRef.current) {
          tickClassic(game.current, input.current);
          input.current.reverse = false;
        }
        accumulator -= 1000 / 60;
      }
      const ctx = canvas.current?.getContext("2d");
      if (ctx) renderClassic(ctx, game.current, pauseRef.current);
      if (now - hud > 100) {
        const s = game.current;
        setStats({
          score: s.score,
          level: s.level,
          lives: s.lives,
          over: s.phase === "game_over",
          shotInPlay: s.shots.some((shot) => shot.owner === 0),
        });
        hud = now;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  const restart = (level = 1) => {
    game.current = createClassic(level);
    input.current = { direction: null, fire: false };
    setPaused(false);
    resumeFromAway();
    canvas.current?.focus();
  };
  return (
    <main className="min-h-screen bg-background p-4 font-mono text-foreground">
      <div className="classic-shell mx-auto max-w-4xl space-y-4">
        <ClassicWindow
          controllerRef={menuController}
          paused={simulationPaused}
          onPause={() => {
            resumeFromAway();
            setPaused(!simulationPaused);
          }}
          onInteractionChange={setWindowBlocked}
          onRestart={() => restart()}
          level={stats.level}
          onLevelChange={restart}
          menuHref={menuHref}
        >
          <canvas
            ref={canvas}
            tabIndex={0}
            onPointerDown={() => {
              resumeFromAway();
              canvas.current?.focus();
            }}
            width={mobileArena ? 424 : 620}
            height={424}
            className="classic-canvas block w-full bg-black [image-rendering:pixelated]"
            aria-label="Classic Alien Force playfield"
          />
        </ClassicWindow>
        <div className="classic-mobile-stats" aria-label="Game status">
          <span>Level {stats.level}</span>
          <span>Score {stats.score}</span>
          <span className="classic-mobile-lives" aria-label={`Lives ${stats.lives}`}>
            {Array.from({ length: stats.lives }, (_, index) => (
              <span
                key={index}
                aria-hidden="true"
                style={{ backgroundImage: `url(${spriteSheetUrl})` }}
              />
            ))}
          </span>
          <span className="classic-shot-status">
            {stats.over ? "GAME OVER" : stats.shotInPlay ? "SHOT IN PLAY" : "SHOT READY"}
          </span>
        </div>
        <ClassicController input={input} menuController={menuController}
          windowBlocked={windowBlocked} resumeFromAway={resumeFromAway}
          paused={paused || awayPaused} onStart={() => {
            if (away.current) resumeFromAway();
            else setPaused(p => !p);
            canvas.current?.focus();
          }} />
        <p className="classic-desktop-stats">
          Level {stats.level} | Score {stats.score} | Lives {stats.lives}
          {stats.over ? " | Game over - select New game to retry." : ""}
        </p>
        <p className="classic-keyboard-instructions text-sm">
          Arrows / WASD: steer through lanes. R: reverse. Space: fire. P / Escape: pause.
        </p>
      </div>
    </main>
  );
}
