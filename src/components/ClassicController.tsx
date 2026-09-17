import type { RefObject } from "react";
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
  return (
        <section
          className="classic-controller"
          aria-label="Game Boy touch controls"
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
            <div className="classic-dpad" role="group" aria-label="Direction pad">
              {(["up", "left", "down", "right"] as const).map((direction) => (
                <button
                  key={direction}
                  className={`classic-pad-key classic-pad-${direction}`}
                  aria-label={`Move ${direction}`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    if (windowBlocked) {
                      menuController.current?.move(direction);
                      return;
                    }
                    input.current.direction = direction; onInputChange?.();
                  }}
                  onPointerUp={() => {
                    if (input.current.direction === direction) { input.current.direction = null; onInputChange?.(); }
                  }}
                  onPointerCancel={() => {
                    if (input.current.direction === direction) { input.current.direction = null; onInputChange?.(); }
                  }}
                  onLostPointerCapture={() => {
                    if (input.current.direction === direction) { input.current.direction = null; onInputChange?.(); }
                  }}
                  onClick={(e) => {
                    if (e.detail === 0) {
                      if (windowBlocked) menuController.current?.move(direction);
                      else { input.current.direction = direction; onInputChange?.(); }
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
