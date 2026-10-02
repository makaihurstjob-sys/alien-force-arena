import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { GameBoyShell } from "@/components/GameBoyShell";
import { CLASSIC } from "@/game/classic/engine";
import type { PlayerSeed } from "@/game/classic/duel";
import { duelBotInput } from "@/game/classic/duel-bot";
import {
  createPowerDuelMatch,
  startPowerDuelRound,
  stepPowerDuel,
  type PowerDuelMatch,
  type PowerUpKind,
} from "@/game/classic/powerup-duel";
import { renderPowerDuel } from "@/game/classic/powerup-duel-render";
import { useGameLoop, useKeyboardInput } from "@/game/useGameLoop";
import { EMPTY_INPUT } from "@/game/types";
import { PVP_RULES } from "@/game/config";

export const Route = createFileRoute("/arcade")({
  head: () => ({
    meta: [
      { title: "Arcade — Alien Force Arena" },
      {
        name: "description",
        content:
          "Classic's real 1v1 duel physics, plus Shield, Freeze Shot, Rapid Fire, Speed Boost and Teleport power-ups that spawn on the grid.",
      },
      { property: "og:title", content: "Arcade — Alien Force Arena" },
      { property: "og:description", content: "Classic-feel arena duel with power-up pickups, against a training bot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Arcade,
});

const PLAYERS: PlayerSeed[] = [
  { id: "you", name: "YOU", team: 0 },
  { id: "bot", name: "BOT", team: 1 },
];

const POWERUP_NAMES: Record<PowerUpKind, string> = {
  shield: "Shield",
  freeze: "Freeze Shot",
  rapidFire: "Rapid Fire",
  speedBoost: "Speed Boost",
  teleport: "Teleport",
};

export function Arcade() {
  const [paused, setPaused] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const matchRef = useRef<PowerDuelMatch>(createPowerDuelMatch(PLAYERS));
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

  const [hud, setHud] = useState(() => readHud(matchRef.current));
  const hudTimer = useRef(0);

  const tick = useCallback(() => {
    const match = matchRef.current;

    if (match.game.phase === "round_over" && match.game.phaseTimerMs <= 0 && match.game.matchWinner === null) {
      startPowerDuelRound(match);
    }

    stepPowerDuel(match, { you: inputRef.current, bot: duelBotInput(match, "bot") });

    if (++hudTimer.current % 10 === 0) setHud(readHud(match));
  }, [inputRef]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    renderPowerDuel(ctx, matchRef.current);
  }, []);

  const getState = useCallback(() => matchRef.current, []);
  useGameLoop(getState, tick, draw, canvasRef, !paused);

  const restart = () => {
    inputRef.current = { ...EMPTY_INPUT };
    setPaused(false);
    matchRef.current = createPowerDuelMatch(PLAYERS);
    setHud(readHud(matchRef.current));
  };

  const you = hud.ships.find((s) => s.id === "you");
  const accuracy = you && you.shots > 0 ? Math.round((you.hits / you.shots) * 100) : 0;
  const buff = hud.buffs.you;
  const buffSecondsLeft = buff ? Math.max(0, Math.ceil(((buff.untilTick - hud.tick) * (1000 / 60)) / 1000)) : 0;
  const youFrozen = hud.frozenUntil.you !== null && hud.tick < hud.frozenUntil.you;
  const frozenSecondsLeft = youFrozen ? Math.max(0, Math.ceil((hud.frozenUntil.you! - hud.tick) / 60)) : 0;

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
            Arcade · Offline
          </span>
        </div>

        <GameBoyShell
          inputRef={inputRef}
          onStart={restart}
          onSelect={restart}
          statusLight={hud.matchWinner === null}
          statusLabel={youFrozen ? "Frozen" : you?.canFire ? "Ready" : "Reloading"}
          aAction="dash"
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
                width={CLASSIC.size}
                height={CLASSIC.size}
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
              <div className="flex items-center justify-between px-2 py-1 text-[10px] uppercase tracking-widest">
                <span className="text-primary">
                  {buff ? `${POWERUP_NAMES[buff.kind]} · ${buffSecondsLeft}s` : "No active buff"}
                </span>
                <span className={hud.teleportCharges.you > 0 ? "text-primary" : "text-muted-foreground"}>
                  Teleport {hud.teleportCharges.you > 0 ? "ready" : "empty"}
                </span>
              </div>
              {hud.pickup && (
                <p className="bg-[#182130] py-1 text-center text-[10px] uppercase tracking-widest text-hud">
                  On field: {POWERUP_NAMES[hud.pickup]}
                </p>
              )}
              {youFrozen && (
                <p className="bg-[#182130] py-1 text-center text-[10px] font-bold uppercase tracking-widest text-hud">
                  Frozen! Controls return in {frozenSecondsLeft}s
                </p>
              )}
              {hud.matchWinner !== null && (
                <p className="bg-[#182130] py-1 text-center text-[10px] font-bold uppercase tracking-widest text-hud">
                  {hud.matchWinner === 0 ? "You win — press start" : "Bot wins — press start"}
                </p>
              )}
            </div>
          }
        />

        <div className="flex items-center justify-between gap-3 text-xs">
          <span>{Math.ceil(hud.phaseTimerMs / 1000)}s</span>
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
              <caption className="sr-only">Arcade match statistics</caption>
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
            D-pad or WASD / arrows steer through Classic's lanes. <b>B</b> or <b>Space</b> to fire,{" "}
            <b>A</b>, <b>Shift</b> or <b>Q</b> to teleport in whatever direction you're holding.{" "}
            <b>Start</b> or <b>Select</b> restarts the match. <b>Escape</b> pauses.
          </p>
          <p className="mt-2">
            The exact same one-shot rule, lane movement and round scoring as Classic — plus a
            power-up pickup that periodically appears on the grid. Fly into it for Shield, a Freeze
            Shot, Rapid Fire, Speed Boost or a Teleport charge; you can hold one timed buff plus a
            separate teleport charge at a time.
          </p>
        </div>
      </div>
    </main>
  );
}

function readHud(match: PowerDuelMatch) {
  const { game } = match;
  return {
    tick: game.tick,
    phaseTimerMs: Math.max(0, game.phaseTimerMs),
    round: game.round,
    score: [...game.score] as [number, number],
    matchWinner: game.matchWinner,
    pickup: match.pickup?.kind ?? null,
    buffs: {
      you: match.buffs.get("you") ?? null,
      bot: match.buffs.get("bot") ?? null,
    },
    teleportCharges: {
      you: match.teleportCharges.get("you") ?? 0,
      bot: match.teleportCharges.get("bot") ?? 0,
    },
    frozenUntil: {
      you: match.frozenUntil.get("you") ?? null,
      bot: match.frozenUntil.get("bot") ?? null,
    },
    ships: game.ships.map((s) => ({
      id: s.id,
      canFire: s.canFire,
      shots: s.shots,
      hits: s.hits,
      alive: s.alive,
    })),
  };
}
