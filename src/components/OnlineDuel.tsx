import ClassicController from "./ClassicController";
import ClassicWindow, { type MenuController } from "./ClassicWindow";
import type { ClassicInput } from "@/game/classic/engine";
import { useCallback, useEffect, useRef, useState } from "react";
import { PVP_RULES } from "@/game/config";
import { interpolateDuel } from "@/game/online";
import { renderClassicDuel } from "@/game/classic/duel-render";
import { CLASSIC } from "@/game/classic/engine";
import { EMPTY_INPUT, type PlayerInput } from "@/game/types";
import type { useOnlineDuel } from "@/game/useOnlineDuel";
import "./online-duel.css";

const mapping: Record<string, keyof PlayerInput> = {
  ArrowUp: "thrust",
  KeyW: "thrust",
  ArrowDown: "reverse",
  KeyS: "reverse",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  Space: "fire",
  KeyR: "turnaround",
  KeyB: "turnaround",
};

export function OnlineDuel({
  duel,
  player,
  onReturn,
  onLeave,
  busy,
}: {
  duel: ReturnType<typeof useOnlineDuel>;
  player: string;
  onReturn: () => void;
  onLeave: () => void;
  busy: boolean;
}) {
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.classList.add("online-match-active");
    window.scrollTo(0, 0);
    return () => {
      document.body.classList.remove("online-match-active");
      window.scrollTo(0, scrollY);
    };
  }, []);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { inputRef, display } = duel;
  const controllerInput = useRef<ClassicInput>({ direction: null, fire: false });
  const reverseUntil = useRef(0);
  const [windowBlocked, setWindowBlocked] = useState(false);
  const [manualPause, setManualPause] = useState(false);
  const menuController = useRef<MenuController | null>(null);
  const pauseRequest = useRef(duel.requestPause);
  pauseRequest.current = duel.requestPause;
  useEffect(() => { pauseRequest.current(windowBlocked || manualPause); }, [windowBlocked, manualPause]);
  const keys = useRef(new Set<string>());
  const enabled = useRef(false);
  const snapshot = duel.view!;
  enabled.current =
    !windowBlocked && !manualPause && !snapshot.paused && !duel.stalled && !snapshot.ended && snapshot.state.matchWinner === null;
  const updateInput = useCallback(() => {
    const input = { ...EMPTY_INPUT };
    if (enabled.current) {
      for (const code of keys.current) {
        const key = mapping[code];
        if (key) input[key] = true;
      }
      const direction = controllerInput.current.direction;
      if (direction) {
        input.thrust = direction === "up"; input.reverse = direction === "down";
        input.left = direction === "left"; input.right = direction === "right";
      }
      input.fire ||= controllerInput.current.fire;
      if (controllerInput.current.reverse) {
        reverseUntil.current = performance.now() + 150;
        controllerInput.current.reverse = false;
      }
      input.turnaround ||= performance.now() < reverseUntil.current;
    }
    inputRef.current = input;
  }, [inputRef]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "KeyP" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault(); setManualPause(value => !value); return;
      }
      if (windowBlocked) return;
      if (!mapping[e.code] || e.target instanceof HTMLInputElement) return;
      // Preserve Space activation when a real action button has keyboard focus.
      if (
        e.code === "Space" &&
        e.target instanceof HTMLButtonElement &&
        !e.target.hasAttribute("data-control")
      )
        return;
      e.preventDefault();
      keys.current.add(e.code);
      updateInput();
    };
    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.code);
      updateInput();
    };
    const reset = () => {
      keys.current.clear();
      controllerInput.current = { direction: null, fire: false };
      reverseUntil.current = 0;
      inputRef.current = { ...EMPTY_INPUT };
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    let frame = 0;
    const draw = (now: number) => {
      updateInput();
      const frameState = display.current;
      const ctx = canvas.current?.getContext("2d");
      if (ctx && frameState)
        renderClassicDuel(
          ctx,
          interpolateDuel(frameState.previous, frameState.current, (now - frameState.at) / 50),
        );
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    canvas.current?.focus();
    return () => {
      cancelAnimationFrame(frame);
      reset();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset);
    };
  }, [inputRef, display, updateInput, windowBlocked]);
  useEffect(() => {
    controllerInput.current = { direction: null, fire: false };
    reverseUntil.current = 0;
    keys.current.clear();
    duel.inputRef.current = { ...EMPTY_INPUT };
  }, [snapshot.matchId, snapshot.paused, duel.stalled, snapshot.ended, duel.inputRef]);

  const state = snapshot.state;
  const you = state.ships.find((s) => s.id === player)!;
  const winner = state.matchWinner;
  const paused = snapshot.paused || duel.stalled;
  return (
    <div className="online-classic-shell">
    <ClassicWindow controllerRef={menuController} paused={manualPause}
      onPause={() => setManualPause(value => !value)} onRestart={onReturn}
      onInteractionChange={setWindowBlocked} menuHref={import.meta.env.BASE_URL}
      level={1} onLevelChange={() => {}} online={{ onReturn, onLeave, busy }}>
    <section
      className="online-duel"
      aria-label="Online 1v1 match"
      data-match-id={snapshot.matchId}
      data-tick={state.tick}
      data-phase={state.phase}
      data-paused={paused}
    >
      <header className="duel-scoreboard">
        <span className="duel-green">
          White <b>{state.score[0]}</b>
        </span>
        <span>
          Round {state.round}
          <small>First to {PVP_RULES.roundsToWinMatch}</small>
        </span>
        <span className="duel-red">
          <b>{state.score[1]}</b> Orange
        </span>
      </header>
      <div className="duel-arena">
        <canvas
          ref={canvas}
          width={CLASSIC.size}
          height={CLASSIC.size}
          tabIndex={0}
          aria-label={`Arena. You control the ${you.team === 0 ? "white" : "orange"} ship.`}
        />
        {!windowBlocked && (snapshot.ended || paused) && (
          <div className="duel-overlay" role="status">
            <strong>{snapshot.ended ? "Match ended" : "Match paused"}</strong>
            <p>
              {snapshot.ended || (duel.localPaused ? "Press START to resume." : "Waiting for the other player to resume or reconnect.")}
            </p>
            {!snapshot.ended && <small>Keep the game visible on both devices.</small>}
          </div>
        )}
      </div>
      <div className="duel-status">
        <span className={you.team === 0 ? "duel-green" : "duel-red"}>
          You are {you.team === 0 ? "WHITE" : "ORANGE"}
        </span>
        <span>
          {!you.alive ? "Eliminated this round" : you.canFire ? "Shot ready" : "Shot in flight"}
        </span>
        <span>{Math.max(0, Math.ceil(state.phaseTimerMs / 1000))}s</span>
      </div>
      {winner !== null && !snapshot.ended ? (
        <section className="duel-results" aria-label="Match results" aria-live="polite">
          <h3>
            {winner === you.team ? "Victory!" : "Defeat"} {state.score.join(" - ")}
          </h3>
          <p>
            {you.shots} shots · {you.hits} hits ·{" "}
            {you.shots ? Math.round((you.hits / you.shots) * 100) : 0}% accuracy
          </p>
          <button disabled={duel.voted || paused} onClick={duel.rematch}>
            {duel.voted ? "Waiting for opponent..." : "Rematch"}
          </button>
          <p>{snapshot.rematch.length}/2 players want a rematch</p>
        </section>
      ) : (
        !snapshot.ended && (
          <div className="duel-controls">
            <ClassicController input={controllerInput} menuController={menuController}
              windowBlocked={windowBlocked} resumeFromAway={() => {}}
              paused={duel.localPaused} onInputChange={updateInput}
              onStart={() => { menuController.current?.back(); setManualPause(value => !value); }} />
            <p className="classic-keyboard-instructions">WASD / arrows to steer. Space to fire. R to reverse.</p>
          </div>
        )
      )}
      <div className="duel-footer">
        <span>{duel.connectionStatus}</span>
        {(winner !== null || snapshot.ended || paused) && (
          <button disabled={busy} onClick={onReturn}>
            Return to room
          </button>
        )}
        <button disabled={busy} onClick={onLeave}>
          {busy ? "Leaving..." : "Leave match"}
        </button>
      </div>
    </section>
    </ClassicWindow>
    </div>
  );
}
