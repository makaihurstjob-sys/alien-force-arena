import { useCallback, useEffect, useRef } from "react";
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
  const canvas = useRef<HTMLCanvasElement>(null);
  const { inputRef, display } = duel;
  const held = useRef(new Map<number, keyof PlayerInput>());
  const keys = useRef(new Set<string>());
  const enabled = useRef(false);
  const snapshot = duel.view!;
  enabled.current =
    !snapshot.paused && !duel.stalled && !snapshot.ended && snapshot.state.matchWinner === null;
  const updateInput = useCallback(() => {
    const input = { ...EMPTY_INPUT };
    if (enabled.current) {
      for (const code of keys.current) {
        const key = mapping[code];
        if (key) input[key] = true;
      }
      for (const key of held.current.values()) input[key] = true;
    }
    inputRef.current = input;
  }, [inputRef]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
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
      held.current.clear();
      inputRef.current = { ...EMPTY_INPUT };
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    let frame = 0;
    const draw = (now: number) => {
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
  }, [inputRef, display, updateInput]);
  useEffect(() => {
    held.current.clear();
    keys.current.clear();
    duel.inputRef.current = { ...EMPTY_INPUT };
  }, [snapshot.matchId, snapshot.paused, duel.stalled, snapshot.ended, duel.inputRef]);

  const control = (action: keyof PlayerInput, label: string, glyph: string) => (
    <button
      type="button"
      data-control={action}
      className={`duel-control duel-${action}`}
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        held.current.set(event.pointerId, action);
        updateInput();
        canvas.current?.focus();
      }}
      onPointerUp={(event) => {
        held.current.delete(event.pointerId);
        updateInput();
      }}
      onPointerCancel={(event) => {
        held.current.delete(event.pointerId);
        updateInput();
      }}
      onLostPointerCapture={(event) => {
        held.current.delete(event.pointerId);
        updateInput();
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {glyph}
    </button>
  );
  const state = snapshot.state;
  const you = state.ships.find((s) => s.id === player)!;
  const winner = state.matchWinner;
  const paused = snapshot.paused || duel.stalled;
  return (
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
        {(snapshot.ended || paused) && (
          <div className="duel-overlay" role="status">
            <strong>{snapshot.ended ? "Match ended" : "Match paused"}</strong>
            <p>
              {snapshot.ended || "Waiting for both players to reconnect or return to the game."}
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
          <div className="duel-controls" aria-label="Touch controls">
            <div className="duel-dpad">
              {control("thrust", "Move up", "▲")}
              {control("left", "Move left", "◀")}
              {control("right", "Move right", "▶")}
              {control("reverse", "Move down", "▼")}
            </div>
            <p>
              WASD / arrows to steer
              <br />
              Space to fire / R to reverse
            </p>
            {control("turnaround", "Reverse direction", "REV")}
            {control("fire", "Fire", "FIRE")}
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
  );
}
