import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { RetroFrame } from "@/components/RetroFrame";
import { ARENA, ARENA_LAYOUTS, PVP_RULES } from "@/game/config";
import { botInput } from "@/game/bot";
import { createMatch, startRound, step, type PlayerSeed } from "@/game/engine";
import { render } from "@/game/render";
import { useGameLoop, useKeyboardInput } from "@/game/useGameLoop";
import type { GameState } from "@/game/types";

export const Route = createFileRoute("/practice")({
  head: () => ({
    meta: [
      { title: "Practice Arena — Alien Force Arena" },
      {
        name: "description",
        content:
          "Local offline practice: fly a top-down ship, dodge obstacles and land the one shot you are allowed to have in play.",
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

function Practice() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [layoutId, setLayoutId] = useState(ARENA_LAYOUTS[0]!.id);
  const layoutRef = useRef(layoutId);
  layoutRef.current = layoutId;

  const stateRef = useRef<GameState>(createMatch(PLAYERS, layoutId));
  const { inputRef } = useKeyboardInput();

  // HUD values are mirrored into React state a few times a second, not every frame.
  const [hud, setHud] = useState(() => readHud(stateRef.current));
  const hudTimer = useRef(0);

  const tick = useCallback(() => {
    const state = stateRef.current;
    const layout = layoutRef.current;

    // A finished round auto-restarts unless the match is over.
    if (state.phase === "round_over" && state.phaseTimerMs <= 0 && !state.matchWinner) {
      startRound(state, PLAYERS, layout);
    }

    step(
      state,
      {
        you: inputRef.current,
        bot: botInput(state, "bot", layout),
      },
      layout,
    );

    if (++hudTimer.current % 10 === 0) setHud(readHud(state));
  }, [inputRef]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    render(ctx, stateRef.current, layoutRef.current);
  }, []);

  const getState = useCallback(() => stateRef.current, []);
  useGameLoop(getState, tick, draw, canvasRef, true);

  const reset = () => {
    stateRef.current = createMatch(PLAYERS, layoutRef.current);
    setHud(readHud(stateRef.current));
  };

  const you = hud.ships.find((s) => s.id === "you");
  const accuracy = useMemo(
    () => (you && you.shots > 0 ? Math.round((you.hits / you.shots) * 100) : 0),
    [you],
  );

  return (
    <main className="min-h-screen bg-background px-3 py-6 font-mono text-foreground">
      <div className="mx-auto max-w-[860px] space-y-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-xs uppercase tracking-widest text-primary hover:underline">
            &lt; Main menu
          </Link>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Offline practice — not connected to any server
          </span>
        </div>

        <RetroFrame title={`Arena — ${hud.matchWinner === null ? "Live" : "Match over"}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-team-a">YOU {hud.score[0]}</span>
            <span className="text-hud">
              Round {hud.round} · first to {PVP_RULES.roundsToWinMatch}
            </span>
            <span className="text-team-b">BOT {hud.score[1]}</span>
          </div>

          <canvas
            ref={canvasRef}
            width={ARENA.width}
            height={ARENA.height}
            className="block h-auto w-full border-2 border-panel-shadow bg-[#0d1117]"
            style={{ imageRendering: "pixelated" }}
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span
              className={
                you?.canFire ? "font-bold text-team-a" : "font-bold text-muted-foreground"
              }
            >
              {you?.canFire ? "● READY TO FIRE" : "○ SHOT IN FLIGHT"}
            </span>
            <span className="text-card-foreground">
              Shots {you?.shots ?? 0} · Hits {you?.hits ?? 0} · Accuracy {accuracy}%
            </span>
            <div className="flex items-center gap-2">
              <select
                value={layoutId}
                onChange={(e) => {
                  setLayoutId(e.target.value);
                  stateRef.current = createMatch(PLAYERS, e.target.value);
                }}
                className="border-2 border-panel-shadow bg-input px-2 py-1 text-card-foreground"
                aria-label="Arena layout"
              >
                {ARENA_LAYOUTS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <button
                onClick={reset}
                className="border-2 border-panel-shadow bg-panel-light px-3 py-1 font-bold uppercase text-card-foreground shadow-panel"
              >
                Restart
              </button>
            </div>
          </div>

          {hud.matchWinner !== null && (
            <p className="mt-3 border-2 border-panel-shadow bg-panel-light p-2 text-center text-sm font-bold text-card-foreground">
              {hud.matchWinner === 0 ? "YOU WIN THE MATCH" : "BOT WINS THE MATCH"} — press Restart
            </p>
          )}
        </RetroFrame>

        <RetroFrame title="Controls">
          <p className="text-sm text-card-foreground">
            <b>W / ↑</b> thrust · <b>S / ↓</b> reverse · <b>A / ←</b> and <b>D / →</b> turn ·{" "}
            <b>Space</b> fire. Only one shot can be in the air at a time — the ring around your ship
            tells you when the next one is available.
          </p>
        </RetroFrame>
      </div>
    </main>
  );
}

function readHud(state: GameState) {
  return {
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
