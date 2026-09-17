import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { GameBoyShell } from "@/components/GameBoyShell";
import { ARENA, ARENA_LAYOUTS, PVP_RULES } from "@/game/config";
import { botInput } from "@/game/bot";
import { createMatch, startRound, step, type PlayerSeed } from "@/game/engine";
import { render } from "@/game/render";
import { useGameLoop, useKeyboardInput } from "@/game/useGameLoop";
import { EMPTY_INPUT, type GameState } from "@/game/types";

export const Route = createFileRoute("/practice")({
  head: () => ({
    meta: [
      { title: "Practice Arena — Alien Force Arena" },
      {
        name: "description",
        content:
          "Local offline practice on a Game Boy-style handheld: fly a top-down ship, dodge obstacles and land the one shot you are allowed to have in play.",
      },
      { property: "og:title", content: "Practice Arena — Alien Force Arena" },
      { property: "og:description", content: "Local offline practice against a training bot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Practice,
});

const PLAYERS: PlayerSeed[] = [
  { id: "you", name: "YOU", team: 0 },
  { id: "bot", name: "BOT", team: 1 },
];

export function Practice() {
  const [paused, setPaused] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [layoutIndex, setLayoutIndex] = useState(0);
  const layoutRef = useRef(ARENA_LAYOUTS[0]!.id);
  layoutRef.current = ARENA_LAYOUTS[layoutIndex]!.id;

  const stateRef = useRef<GameState>(createMatch(PLAYERS, layoutRef.current));
  const { inputRef } = useKeyboardInput(!paused);

  useEffect(() => {
    const pause = () => {
      inputRef.current = { ...EMPTY_INPUT };
      setPaused(true);
    };
    const visibility = () => {
      if (document.hidden) pause();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.code === "Escape" && !event.repeat) {
        inputRef.current = { ...EMPTY_INPUT };
        setPaused((value) => !value);
      }
    };
    window.addEventListener("blur", pause);
    window.addEventListener("keydown", keyboard);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", pause);
      window.removeEventListener("keydown", keyboard);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [inputRef]);

  // HUD values mirror into React state ~6x a second, not every frame.
  const [hud, setHud] = useState(() => readHud(stateRef.current));
  const hudTimer = useRef(0);

  const tick = useCallback(() => {
    const state = stateRef.current;
    const layout = layoutRef.current;

    if (state.phase === "round_over" && state.phaseTimerMs <= 0 && state.matchWinner === null) {
      startRound(state, PLAYERS, layout);
    }

    step(state, { you: inputRef.current, bot: botInput(state, "bot", layout) }, layout);

    if (++hudTimer.current % 10 === 0) setHud(readHud(state));
  }, [inputRef]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    render(ctx, stateRef.current, layoutRef.current);
  }, []);

  const getState = useCallback(() => stateRef.current, []);
  useGameLoop(getState, tick, draw, canvasRef, !paused);

  const restart = () => {
    inputRef.current = { ...EMPTY_INPUT };
    setPaused(false);
    stateRef.current = createMatch(PLAYERS, layoutRef.current);
    setHud(readHud(stateRef.current));
  };

  const nextLayout = () => {
    inputRef.current = { ...EMPTY_INPUT };
    setPaused(false);
    const next = (layoutIndex + 1) % ARENA_LAYOUTS.length;
    setLayoutIndex(next);
    layoutRef.current = ARENA_LAYOUTS[next]!.id;
    stateRef.current = createMatch(PLAYERS, layoutRef.current);
    setHud(readHud(stateRef.current));
  };

  const you = hud.ships.find((s) => s.id === "you");
  const accuracy = you && you.shots > 0 ? Math.round((you.hits / you.shots) * 100) : 0;

  return (
    <main className="min-h-screen bg-background px-3 py-4 font-mono text-foreground">
      <div className="mx-auto max-w-[560px] space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <Link
            to="/"
            className="truncate text-xs uppercase tracking-widest text-primary hover:underline"
          >
            &lt; Main menu
          </Link>
          <span className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">
            Offline practice
          </span>
        </div>

        <GameBoyShell
          inputRef={inputRef}
          onStart={restart}
          onSelect={nextLayout}
          statusLight={hud.matchWinner === null}
          statusLabel={you?.canFire ? "Ready" : "Reloading"}
          screen={
            <div>
              <div className="flex items-center justify-between px-2 py-1 text-[10px] uppercase tracking-widest">
                <span className="text-team-a">You {hud.score[0]}</span>
                <span className="text-hud">
                  R{hud.round} · First to {PVP_RULES.roundsToWinMatch}
                </span>
                <span className="text-team-b">Bot {hud.score[1]}</span>
              </div>
              <canvas
                ref={canvasRef}
                width={ARENA.width}
                height={ARENA.height}
                className="block h-auto w-full touch-none"
                style={{ imageRendering: "pixelated" }}
              />
              <div className="flex items-center justify-between px-2 py-1 text-[10px] uppercase tracking-widest">
                <span className={you?.canFire ? "text-team-a" : "text-muted-foreground"}>
                  {you?.canFire ? "● Fire ready" : "○ Shot in flight"}
                </span>
                <span className="text-[#8d97a6]">
                  {you?.shots ?? 0}S / {you?.hits ?? 0}H / {accuracy}%
                </span>
              </div>
              {hud.matchWinner !== null && (
                <p className="bg-[#182130] py-1 text-center text-[10px] font-bold uppercase tracking-widest text-hud">
                  {hud.matchWinner === 0 ? "You win — press start" : "Bot wins — press start"}
                </p>
              )}
            </div>
          }
        />

        <div className="flex items-center justify-between gap-3 text-xs">
          <span>
            {ARENA_LAYOUTS[layoutIndex]!.name} · {Math.ceil(hud.phaseTimerMs / 1000)}s
          </span>
          <button
            className="border-2 border-panel-shadow bg-panel px-4 py-2 text-card-foreground"
            onClick={() => {
              inputRef.current = { ...EMPTY_INPUT };
              setPaused((value) => !value);
            }}
          >
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
        {paused && (
          <p role="status" className="text-center text-sm text-primary">
            Paused — press Resume or Escape to continue.
          </p>
        )}
        {hud.matchWinner !== null && (
          <section
            aria-label="Match results"
            className="border-2 border-panel-shadow bg-panel p-3 text-xs text-card-foreground"
          >
            <h2 className="font-bold">
              {hud.matchWinner === 0 ? "Victory" : "Defeat"} · {hud.score.join(" – ")}
            </h2>
            <table className="mt-3 w-full text-left">
              <caption className="sr-only">Practice match statistics</caption>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Shots</th>
                  <th>Hits</th>
                  <th>Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {hud.ships.map((ship) => (
                  <tr key={ship.id}>
                    <th>{ship.id === "you" ? "You" : "Bot"}</th>
                    <td>{ship.shots}</td>
                    <td>{ship.hits}</td>
                    <td>{ship.shots ? Math.round((ship.hits / ship.shots) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3">
              Local practice only. Results are not saved and do not change your rating.
            </p>
            <button onClick={restart} className="mt-3 border-2 border-panel-shadow px-4 py-2">
              Play again
            </button>
          </section>
        )}
        <div className="border-2 border-panel-shadow bg-panel p-3 text-xs text-card-foreground">
          <p className="font-bold uppercase tracking-widest">Controls</p>
          <p className="mt-1">
            D-pad or WASD / arrows to turn, thrust and reverse. <b>A</b>, <b>B</b> or <b>Space</b>{" "}
            to fire. <b>Start</b> restarts the match, <b>Select</b> switches arena. <b>Escape</b>{" "}
            pauses. Switching away automatically pauses practice.
          </p>
          <p className="mt-2">
            Only one of your shots can be in the air at a time — the ring around your ship is solid
            when the next shot is available.
          </p>
        </div>
      </div>
    </main>
  );
}

function readHud(state: GameState) {
  return {
    phaseTimerMs: Math.max(0, state.phaseTimerMs),
    round: state.round,
    score: [...state.score] as [number, number],
    matchWinner: state.matchWinner,
    ships: state.ships.map((s) => ({
      id: s.id,
      canFire: s.canFire,
      shots: s.shots,
      hits: s.hits,
      alive: s.alive,
    })),
  };
}
