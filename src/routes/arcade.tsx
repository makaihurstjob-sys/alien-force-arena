import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import ClassicWindow, { type MenuController } from "@/components/ClassicWindow";
import ClassicController from "@/components/ClassicController";
import type { ClassicInput } from "@/game/classic/engine";
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
      {
        property: "og:description",
        content: "Classic-feel arena duel with power-up pickups, against a training bot.",
      },
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
  const [windowBlocked, setWindowBlocked] = useState(false);
  const menuController = useRef<MenuController | null>(null);
  const controllerInput = useRef<ClassicInput>({ direction: null, fire: false });
  const teleport = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const matchRef = useRef<PowerDuelMatch>(createPowerDuelMatch(PLAYERS));
  const { inputRef } = useKeyboardInput(!paused && !windowBlocked);

  useEffect(() => {
    const pause = () => {
      inputRef.current = { ...EMPTY_INPUT };
      controllerInput.current = { direction: null, fire: false };
      teleport.current = false;
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

    if (
      match.game.phase === "round_over" &&
      match.game.phaseTimerMs <= 0 &&
      match.game.matchWinner === null
    ) {
      startPowerDuelRound(match);
    }

    const controls = controllerInput.current;
    const input = { ...inputRef.current };
    if (controls.direction) {
      input.thrust = controls.direction === "up";
      input.reverse = controls.direction === "down";
      input.left = controls.direction === "left";
      input.right = controls.direction === "right";
    }
    input.fire ||= controls.fire;
    input.turnaround ||= !!controls.reverse;
    controls.reverse = false;
    input.dash ||= teleport.current;
    stepPowerDuel(match, { you: input, bot: duelBotInput(match, "bot") });

    if (++hudTimer.current % 10 === 0) setHud(readHud(match));
  }, [inputRef]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    renderPowerDuel(ctx, matchRef.current);
  }, []);

  const getState = useCallback(() => matchRef.current, []);
  useGameLoop(getState, tick, draw, canvasRef, !paused && !windowBlocked);

  const restart = () => {
    controllerInput.current = { direction: null, fire: false };
    teleport.current = false;
    inputRef.current = { ...EMPTY_INPUT };
    setPaused(false);
    matchRef.current = createPowerDuelMatch(PLAYERS);
    setHud(readHud(matchRef.current));
  };

  const you = hud.ships.find((s) => s.id === "you");
  const accuracy = you && you.shots > 0 ? Math.round((you.hits / you.shots) * 100) : 0;
  const buff = hud.buffs.you;
  const buffSecondsLeft = buff
    ? Math.max(0, Math.ceil(((buff.untilTick - hud.tick) * (1000 / 60)) / 1000))
    : 0;
  const youFrozen = hud.frozenUntil.you !== null && hud.tick < hud.frozenUntil.you;
  const frozenSecondsLeft = youFrozen
    ? Math.max(0, Math.ceil((hud.frozenUntil.you! - hud.tick) / 60))
    : 0;

  return (
    <main className="min-h-screen bg-background p-4 font-mono text-foreground">
      <div className="classic-shell mx-auto max-w-4xl space-y-4">
        <ClassicWindow
          controllerRef={menuController}
          paused={paused}
          onPause={() => setPaused((value) => !value)}
          onRestart={restart}
          onInteractionChange={setWindowBlocked}
          menuHref={import.meta.env.BASE_URL}
          level={hud.round}
          onLevelChange={restart}
        >
          <canvas
            ref={canvasRef}
            tabIndex={0}
            width={CLASSIC.size}
            height={CLASSIC.size}
            className="classic-canvas block w-full bg-black [image-rendering:pixelated]"
            aria-label="Arcade Alien Force playfield"
          />
        </ClassicWindow>
        <div className="classic-mobile-stats" aria-label="Game status">
          <span>You {hud.score[0]}</span>
          <span>Round {hud.round}</span>
          <span>Bot {hud.score[1]}</span>
          <span className="classic-shot-status">
            {you?.canFire ? "SHOT READY" : "SHOT IN PLAY"}
          </span>
        </div>
        <ClassicController
          input={controllerInput}
          menuController={menuController}
          windowBlocked={windowBlocked}
          resumeFromAway={() => {}}
          paused={paused}
          onStart={() => {
            menuController.current?.back();
            setPaused((value) => !value);
          }}
        />
        <div className="classic-desktop-stats">
          You {hud.score[0]} | Bot {hud.score[1]} | Round {hud.round} | First to{" "}
          {PVP_RULES.roundsToWinMatch}
        </div>
        <div aria-label="Arcade power-ups">
          <span>
            {buff ? `${POWERUP_NAMES[buff.kind]} - ${buffSecondsLeft}s` : "No active buff"}
          </span>{" "}
          <button
            data-control
            disabled={hud.teleportCharges.you <= 0 || paused || windowBlocked}
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              teleport.current = true;
            }}
            onPointerUp={() => {
              teleport.current = false;
            }}
            onPointerCancel={() => {
              teleport.current = false;
            }}
            onLostPointerCapture={() => {
              teleport.current = false;
            }}
          >
            Teleport {hud.teleportCharges.you > 0 ? "ready" : "empty"}
          </button>
          {youFrozen && <p role="status">Frozen! Controls return in {frozenSecondsLeft}s</p>}
        </div>
        {hud.matchWinner !== null && (
          <section aria-label="Match results">
            <h2>
              {hud.matchWinner === 0 ? "Victory" : "Defeat"} - {hud.score.join(" - ")}
            </h2>
            <p>
              {you?.shots ?? 0} shots | {you?.hits ?? 0} hits | {accuracy}% accuracy
            </p>
            <button onClick={restart}>Play again</button>
          </section>
        )}
        <p className="classic-keyboard-instructions text-sm">
          Arrows / WASD: steer. R: reverse. Space: fire. Shift / Q: teleport. Escape: pause.
        </p>
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
