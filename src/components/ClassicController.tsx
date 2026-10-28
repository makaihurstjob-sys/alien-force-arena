import TouchJoystick from "./TouchJoystick";
import { useEffect, type RefObject } from "react";
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
  function applyDirection(direction: Direction | null) {
    if (windowBlocked) {
      if (direction) menuController.current?.move(direction);
    } else if (input.current.direction !== direction) {
      input.current.direction = direction; onInputChange?.();
    }
  }

  useEffect(() => {
    const clear = () => {
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
    input.current.direction = null; input.current.fire = false;
    onInputChange?.();
  }, [windowBlocked, input, onInputChange]);

  return (
        <section
          className="classic-controller"
          aria-label="Touch game controls"
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
            <TouchJoystick onChange={applyDirection} key={windowBlocked ? "menu" : "game"} />
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
