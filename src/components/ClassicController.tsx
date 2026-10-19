import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import type { ClassicInput } from "@/game/classic/engine";
import type { MenuController } from "./ClassicWindow";
import "@/routes/classic-controls.css";

export default function ClassicController({ input, menuController, windowBlocked, resumeFromAway, paused, onStart, onInputChange }: {
  input: RefObject<ClassicInput>;
  menuController: RefObject<MenuController | null>;
  windowBlocked: boolean;
  resumeFromAway: () => void;
  paused: boolean;
  onStart: () => void;
  onInputChange?: () => void;
}) {
  type Direction = NonNullable<ClassicInput["direction"]>;
  const pointers = useRef(new Map<number, Direction | null>());
  const [pressed, setPressed] = useState<Direction | null>(null);
  const pulse = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function applyDirection(direction: Direction | null) {
    setPressed(direction);
    if (windowBlocked) {
      if (direction) menuController.current?.move(direction);
    } else if (input.current.direction !== direction) {
      input.current.direction = direction; onInputChange?.();
    }
  }

  function trackPointer(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width * 2 - 1;
    const y = (event.clientY - bounds.top) / bounds.height * 2 - 1;
    const distance = Math.max(Math.abs(x), Math.abs(y));
    const direction: Direction | null = distance < .18 || distance > 1.2 ? null
      : Math.abs(x) > Math.abs(y) ? (x < 0 ? "left" : "right") : (y < 0 ? "up" : "down");
    if (pointers.current.has(event.pointerId) && pointers.current.get(event.pointerId) === direction) return;
    pointers.current.delete(event.pointerId);
    pointers.current.set(event.pointerId, direction);
    applyDirection(direction);
  }

  function releasePointer(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.delete(event.pointerId)) return;
    applyDirection([...pointers.current.values()].reverse().find(value => value !== null) ?? null);
  }

  useEffect(() => {
    const clear = () => {
      pointers.current.clear(); clearTimeout(pulse.current);
      setPressed(null);
      input.current.direction = null; input.current.fire = false;
      onInputChange?.();
    };
    const hidden = () => { if (document.hidden) clear(); };
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", hidden);
      clear();
    };
  }, [input, onInputChange]);

  useEffect(() => {
    pointers.current.clear(); setPressed(null);
    input.current.direction = null; input.current.fire = false;
    onInputChange?.();
  }, [windowBlocked, input, onInputChange]);

  return (
        <section
          className="classic-controller"
          aria-label="Game Boy touch controls"
          onContextMenu={event => event.preventDefault()}
          onPointerDownCapture={(e) => {
            if (!(e.target as HTMLElement).closest('[aria-label^="Start:"]')) resumeFromAway();
          }}
          onClickCapture={(e) => {
            if (!(e.target as HTMLElement).closest('[aria-label^="Start:"]')) resumeFromAway();
          }}
          onKeyDownCapture={(e) => {
            if (
              ["Enter", "Space"].includes(e.code) &&
              !(e.target as HTMLElement).closest('[aria-label^="Start:"]')
            )
              resumeFromAway();
          }}
        >
          <div className="classic-controller-main">
            <div className="classic-dpad" role="group" aria-label="Direction pad"
              onPointerDown={event => {
                if (event.pointerType === "mouse" && event.button !== 0) return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                trackPointer(event);
              }}
              onPointerMove={event => {
                if (!pointers.current.has(event.pointerId)) return;
                event.preventDefault(); trackPointer(event);
              }}
              onPointerUp={releasePointer}
              onPointerCancel={releasePointer}
              onLostPointerCapture={releasePointer}
            >
              {(["up", "left", "down", "right"] as const).map((direction) => (
                <button
                  key={direction}
                  type="button"
                  className={`classic-pad-key classic-pad-${direction}`}
                  data-held={pressed === direction || undefined}
                  aria-label={`Move ${direction}`}
                  onKeyDown={event => {
                    if (!["Space", "Enter"].includes(event.code)) return;
                    event.preventDefault();
                    if (!event.repeat) applyDirection(direction);
                  }}
                  onKeyUp={event => {
                    if (["Space", "Enter"].includes(event.code)) { event.preventDefault(); applyDirection(null); }
                  }}
                  onBlur={() => { if (!pointers.current.size && input.current.direction === direction) applyDirection(null); }}
                  onClick={(e) => {
                    if (e.detail === 0) {
                      applyDirection(direction);
                      clearTimeout(pulse.current);
                      pulse.current = setTimeout(() => {
                        if (!pointers.current.size && input.current.direction === direction) applyDirection(null);
                      }, 100);
                    }
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
                    if (windowBlocked) {
                      menuController.current?.back();
                      return;
                    }
                    input.current.direction = null;
                    input.current.reverse = true; onInputChange?.();
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
                    if (windowBlocked) {
                      menuController.current?.select();
                      return;
                    }
                    input.current.fire = true; onInputChange?.();
                  }}
                  onPointerUp={() => {
                    input.current.fire = false; onInputChange?.();
                  }}
                  onPointerCancel={() => {
                    input.current.fire = false; onInputChange?.();
                  }}
                  onLostPointerCapture={() => {
                    input.current.fire = false; onInputChange?.();
                  }}
                  onKeyDown={(e) => {
                    if (e.code === "Space" || e.code === "Enter") {
                      if (windowBlocked) {
                        e.preventDefault();
                        menuController.current?.select();
                      } else { input.current.fire = true; onInputChange?.(); }
                    }
                  }}
                  onKeyUp={() => {
                    input.current.fire = false; onInputChange?.();
                  }}
                  onBlur={() => {
                    input.current.fire = false; onInputChange?.();
                  }}
                >
                  A
                </button>
                <span>FIRE</span>
              </div>
            </div>
          </div>
          <div className="classic-system-buttons">
            <button
              className="classic-system"
              aria-label="Menu"
              onClick={() => menuController.current?.menu()}
            >
              <span aria-hidden="true">&#9473;</span>MENU
            </button>
            <button
              className="classic-system"
              aria-label="Select: Confirm"
              onClick={() => {
                menuController.current?.select();
              }}
            >
              <span aria-hidden="true">&#9473;</span>SELECT
            </button>
            <button
              className="classic-system"
              aria-label={paused ? "Start: Resume" : "Start: Pause"}
              onClick={() => {
                onStart();
              }}
            >
              <span aria-hidden="true">&#9473;</span>START
            </button>
          </div>
        </section>
  );
}
