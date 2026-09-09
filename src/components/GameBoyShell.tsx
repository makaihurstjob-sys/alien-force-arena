import type { ReactNode } from "react";
import { useCallback, useRef } from "react";
import type { PlayerInput } from "@/game/types";

/**
 * A Game Boy-inspired handheld shell.
 *
 * The D-pad and A/B buttons write straight into the SAME PlayerInput object the
 * keyboard writes into, so touch and keyboard are interchangeable and the
 * simulation never has to know which one is being used.
 */

type Btn = "up" | "down" | "left" | "right" | "a" | "b";

export function GameBoyShell({
  screen,
  inputRef,
  onStart,
  onSelect,
  statusLight,
  statusLabel,
}: {
  screen: ReactNode;
  inputRef: React.RefObject<PlayerInput>;
  onStart: () => void;
  onSelect: () => void;
  statusLight: boolean;
  statusLabel: string;
}) {
  // Track which pointer is holding which button so sliding a thumb off releases it.
  const held = useRef<Map<number, Btn>>(new Map());

  const apply = useCallback(
    (btn: Btn, down: boolean) => {
      const i = inputRef.current;
      if (!i) return;
      if (btn === "up") i.thrust = down;
      if (btn === "down") i.reverse = down;
      if (btn === "left") i.left = down;
      if (btn === "right") i.right = down;
      if (btn === "a" || btn === "b") i.fire = down;
    },
    [inputRef],
  );

  const press = (btn: Btn) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    held.current.set(e.pointerId, btn);
    apply(btn, true);
  };

  const release = (btn: Btn) => (e: React.PointerEvent) => {
    e.preventDefault();
    held.current.delete(e.pointerId);
    apply(btn, false);
  };

  const padBtn =
    "select-none touch-none flex items-center justify-center bg-[#3b3f45] text-[#c9ccd1] active:bg-[#22252a] shadow-[inset_0_-2px_0_rgba(0,0,0,0.5)]";

  return (
    <div className="mx-auto w-full max-w-[420px] rounded-b-[3rem] rounded-t-xl border-2 border-[#8a8f98] bg-[#c4c8cf] p-4 shadow-[6px_6px_0_0_rgba(0,0,0,0.45)] lg:max-w-[520px]">
      {/* screen bezel */}
      <div className="rounded-lg rounded-br-[2rem] bg-[#4c4f5a] p-4 pb-6">
        <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-[#cfd3da]">
          <span className="flex items-center gap-1">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                statusLight ? "bg-[#ff4d4d]" : "bg-[#6a6e78]"
              }`}
            />
            {statusLabel}
          </span>
          <span>Alien Force Arena</span>
        </div>
        <div className="border-2 border-[#22252a] bg-[#0d1117]">{screen}</div>
      </div>

      {/* controls */}
      <div className="mt-5 grid grid-cols-[auto_1fr_auto] items-center gap-3">
        {/* D-pad */}
        <div className="grid h-28 w-28 grid-cols-3 grid-rows-3 gap-0.5">
          <span />
          <button
            aria-label="Thrust"
            className={`${padBtn} rounded-t-md`}
            onPointerDown={press("up")}
            onPointerUp={release("up")}
            onPointerLeave={release("up")}
            onPointerCancel={release("up")}
          >
            ▲
          </button>
          <span />
          <button
            aria-label="Turn left"
            className={`${padBtn} rounded-l-md`}
            onPointerDown={press("left")}
            onPointerUp={release("left")}
            onPointerLeave={release("left")}
            onPointerCancel={release("left")}
          >
            ◀
          </button>
          <span className={`${padBtn} pointer-events-none`} />
          <button
            aria-label="Turn right"
            className={`${padBtn} rounded-r-md`}
            onPointerDown={press("right")}
            onPointerUp={release("right")}
            onPointerLeave={release("right")}
            onPointerCancel={release("right")}
          >
            ▶
          </button>
          <span />
          <button
            aria-label="Reverse"
            className={`${padBtn} rounded-b-md`}
            onPointerDown={press("down")}
            onPointerUp={release("down")}
            onPointerLeave={release("down")}
            onPointerCancel={release("down")}
          >
            ▼
          </button>
          <span />
        </div>

        <div className="text-center font-mono text-[10px] uppercase leading-4 tracking-widest text-[#5a5f68]">
          <div>Dot Matrix</div>
          <div>With Stereo Sound</div>
        </div>

        {/* A / B */}
        <div className="flex -rotate-12 items-end gap-3">
          <button
            aria-label="Fire (B)"
            className="h-14 w-14 select-none touch-none rounded-full bg-[#8c2f5a] font-mono text-lg font-bold text-white shadow-[0_3px_0_rgba(0,0,0,0.45)] active:translate-y-[2px] active:shadow-none"
            onPointerDown={press("b")}
            onPointerUp={release("b")}
            onPointerLeave={release("b")}
            onPointerCancel={release("b")}
          >
            B
          </button>
          <button
            aria-label="Fire (A)"
            className="h-14 w-14 select-none touch-none rounded-full bg-[#8c2f5a] font-mono text-lg font-bold text-white shadow-[0_3px_0_rgba(0,0,0,0.45)] active:translate-y-[2px] active:shadow-none"
            onPointerDown={press("a")}
            onPointerUp={release("a")}
            onPointerLeave={release("a")}
            onPointerCancel={release("a")}
          >
            A
          </button>
        </div>
      </div>

      {/* start / select */}
      <div className="mt-6 flex justify-center gap-6">
        <button
          onClick={onSelect}
          className="-rotate-12 select-none rounded-full bg-[#5a5f68] px-4 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-[#e6e9ee] shadow-[0_2px_0_rgba(0,0,0,0.4)] active:translate-y-[2px] active:shadow-none"
        >
          Select
        </button>
        <button
          onClick={onStart}
          className="-rotate-12 select-none rounded-full bg-[#5a5f68] px-4 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-[#e6e9ee] shadow-[0_2px_0_rgba(0,0,0,0.4)] active:translate-y-[2px] active:shadow-none"
        >
          Start
        </button>
      </div>
    </div>
  );
}
