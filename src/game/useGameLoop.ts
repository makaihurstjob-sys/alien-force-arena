/**
 * Fixed-timestep game loop for local play.
 *
 * We accumulate real elapsed time and run the simulation in whole 1/60s ticks,
 * so the physics are frame-rate independent and identical to what the
 * authoritative server will run.
 */

import { useEffect, useRef, useState } from "react";
import { TICK_MS } from "./config";
import type { GameState, PlayerInput } from "./types";

export function useGameLoop(
  getState: () => GameState,
  tick: () => void,
  draw: (ctx: CanvasRenderingContext2D) => void,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  running: boolean,
) {
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let accumulator = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      accumulator += Math.min(now - last, 250); // avoid spiral of death on tab switch
      last = now;
      while (accumulator >= TICK_MS) {
        tick();
        accumulator -= TICK_MS;
      }
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) draw(ctx);
      void getState();
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, tick, draw, getState, canvasRef]);
}

/** Reads the keyboard into a PlayerInput ref (no re-renders per key). */
export function useKeyboardInput(enabled = true) {
  const inputRef = useRef<PlayerInput>({
    thrust: false,
    reverse: false,
    left: false,
    right: false,
    fire: false,
  });
  const [pressedFire, setPressedFire] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const set = (code: string, down: boolean) => {
      const i = inputRef.current;
      switch (code) {
        case "ArrowUp": case "KeyW": i.thrust = down; break;
        case "ArrowDown": case "KeyS": i.reverse = down; break;
        case "ArrowLeft": case "KeyA": i.left = down; break;
        case "ArrowRight": case "KeyD": i.right = down; break;
        case "Space": i.fire = down; setPressedFire(down); break;
        default: return;
      }
    };
    const down = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      set(e.code, true);
    };
    const up = (e: KeyboardEvent) => set(e.code, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [enabled]);

  return { inputRef, pressedFire };
}
