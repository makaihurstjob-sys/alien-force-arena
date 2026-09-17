import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import "./classic-window.css";
import ClassicOptionsDialog from "./ClassicOptionsDialog";

export type MenuController = {
  menu: () => void;
  move: (direction: "up" | "down" | "left" | "right") => void;
  select: () => void;
  back: () => void;
};

type Props = {
  controllerRef: Ref<MenuController>;
  children: ReactNode;
  paused: boolean;
  onPause: () => void;
  onRestart: () => void;
  onInteractionChange: (blocked: boolean) => void;
  menuHref: string;
  level: number;
  onLevelChange: (level: number) => void;
  online?: { onReturn: () => void; onLeave: () => void; busy: boolean };
};
export default function ClassicWindow({
  children,
  controllerRef,
  paused,
  onPause,
  onRestart,
  onInteractionChange,
  menuHref,
  level,
  onLevelChange,
  online,
}: Props) {
  const [mode, setMode] = useState<"normal" | "minimized" | "maximized">("normal");
  const [menu, setMenu] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"level" | "multiplayer" | "rules" | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const selected = useRef(0);
  const items = () =>
    Array.from(
      root.current?.querySelectorAll<HTMLElement>(
        dialog
          ? ".classic-options-dialog input, .classic-options-dialog button:not(:disabled)"
          : ".classic-dropdown button:not(:disabled), .classic-dropdown a",
      ) ?? [],
    );
  const highlight = () => {
    root.current
      ?.querySelectorAll("[data-controller-selected]")
      .forEach((el) => el.removeAttribute("data-controller-selected"));
    const choices = items();
    selected.current = Math.max(0, Math.min(selected.current, choices.length - 1));
    choices[selected.current]?.setAttribute("data-controller-selected", "true");
  };
  useEffect(() => {
    selected.current = 0;
    highlight();
  }, [menu, dialog]);
  useImperativeHandle(controllerRef, () => ({
    menu: () => {
      if (dialog) setDialog(null);
      else {
        setMode(mode === "minimized" ? "normal" : mode);
        setMenu(menu ? null : "Game");
      }
    },
    back: () => {
      setDialog(null);
      setMenu(null);
    },
    move: (direction) => {
      if (!menu && !dialog) return;
      if (!dialog && (direction === "left" || direction === "right")) {
        const names = ["Game", "Options", "Help"];
        setMenu(
          names[(Math.max(0, names.indexOf(menu!)) + (direction === "right" ? 1 : 2)) % 3] ??
            "Game",
        );
        return;
      }
      const choices = items();
      const current = choices[selected.current];
      if (
        dialog &&
        current instanceof HTMLInputElement &&
        (direction === "up" || direction === "down")
      ) {
        const value = Math.max(
          1,
          Math.min(999, Number(current.value || 1) + (direction === "up" ? 1 : -1)),
        );
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
          current,
          String(value),
        );
        current.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (choices.length)
        selected.current =
          (selected.current +
            (direction === "up" || direction === "left" ? choices.length - 1 : 1)) %
          choices.length;
      highlight();
    },
    select: () => {
      const current = items()[selected.current];
      if (current instanceof HTMLInputElement) {
        selected.current++;
        highlight();
      } else current?.click();
    },
  }));
  useEffect(() => {
    onInteractionChange(menu !== null || dialog !== null || mode === "minimized");
  }, [menu, dialog, mode, onInteractionChange]);
  useEffect(() => {
    const dismiss = (e: PointerEvent) => {
      if (
        !(e.target as HTMLElement).closest(
          ".classic-dropdown, .classic-menubar, .classic-titlebar, .classic-controller, .classic-options-dialog",
        )
      )
        setMenu(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  const changeMode = (next: typeof mode) => {
    setMode(next);
    setMenu(null);
  };
  const toggleMenu = (name: string) => {
    setMenu(menu === name ? null : name);
  };
  return (
    <div
      ref={root}
      className={`classic-window is-${mode}`}
      onKeyDown={(e) => {
        if (e.key === "Escape" && (menu || dialog)) {
          e.preventDefault();
          e.stopPropagation();
          setMenu(null);
          setDialog(null);
        }
        if (menu || dialog) e.stopPropagation();
      }}
    >
      <div className="classic-titlebar">
        <button
          className="classic-caption-button"
          aria-label="Window menu"
          aria-expanded={menu === "system"}
          onClick={() => toggleMenu("system")}
        >
          <span className="classic-menu-glyph" />
        </button>
        <div
          className="classic-caption"
          onDoubleClick={() => changeMode(mode === "maximized" ? "normal" : "maximized")}
        >
          Alien Force
        </div>
        <button
          className="classic-caption-button"
          aria-label={mode === "minimized" ? "Restore window" : "Minimize window"}
          onClick={() => changeMode(mode === "minimized" ? "normal" : "minimized")}
        >
          <span className="classic-down-glyph" />
        </button>
        <button
          className="classic-caption-button"
          aria-label={mode === "maximized" ? "Restore window" : "Maximize window"}
          onClick={() => changeMode(mode === "maximized" ? "normal" : "maximized")}
        >
          <span className="classic-up-glyph" />
        </button>
      </div>
      {menu === "system" && (
        <div className="classic-dropdown classic-window-menu" aria-label="Window commands">
          <button
            aria-label="Restore"
            disabled={mode === "normal"}
            onClick={() => changeMode("normal")}
          >
            <u>R</u>estore
          </button>
          <button disabled>
            <u>M</u>ove
          </button>
          <button disabled>
            <u>S</u>ize
          </button>
          <button
            aria-label="Minimize"
            disabled={mode === "minimized"}
            onClick={() => changeMode("minimized")}
          >
            Mi<u>n</u>imize
          </button>
          <button
            aria-label="Maximize"
            disabled={mode === "maximized"}
            onClick={() => changeMode("maximized")}
          >
            Ma<u>x</u>imize
          </button>
          <hr />
          <a href={menuHref} onClick={online ? event => { event.preventDefault(); if (!online.busy) online.onReturn(); } : undefined}>
            <span>
              S<u>w</u>itch To...
            </span>
            <span>Ctrl+Esc</span>
          </a>
        </div>
      )}
      {dialog === "rules" && (
        <div className="classic-options-overlay">
          <section className="classic-options-dialog" role="dialog" aria-label="Match rules">
            <h2>Online 1v1</h2>
            <p>Classic movement and shooting. White versus orange. First to three wins.</p>
            <p>Both players must agree to a rematch. Menus pause both players; keep both game screens visible.</p>
            <button onClick={() => setDialog(null)}>OK</button>
          </section>
        </div>
      )}
      {dialog && dialog !== "rules" && (
        <ClassicOptionsDialog
          kind={dialog}
          level={level}
          onLevelChange={onLevelChange}
          onClose={() => {
            setDialog(null);
            root.current?.querySelector<HTMLButtonElement>('[aria-label="Options"]')?.focus();
          }}
        />
      )}
      <div hidden={mode === "minimized"}>
        <nav className="classic-menubar" aria-label="Game menu bar">
          {["Game", "Options", "Help"].map((name) => (
            <div className="classic-menu-anchor" key={name}>
              <button
                aria-label={name}
                aria-expanded={menu === name}
                onClick={() => toggleMenu(name)}
              >
                <u>{name[0]}</u>
                {name.slice(1)}
              </button>
              {menu === name && (
                <div className="classic-dropdown">
                  {name === "Game" && (
                    <>
                      <button
                        disabled={online?.busy}
                        onClick={() => {
                          setMenu(null);
                          if (online) online.onReturn(); else onRestart();
                        }}
                      >
                        {online ? "Return to room" : "New game"}
                      </button>
                      <button
                        onClick={() => {
                          setMenu(null);
                          onPause();
                        }}
                      >
                        {paused ? "Resume" : "Pause"}
                      </button>
                      <hr />
                      {online ? <button disabled={online.busy} onClick={online.onLeave}>Leave match</button> : <a href={menuHref}>Exit to main menu</a>}
                    </>
                  )}
                  {name === "Options" && (
                    <>
                      <button
                        onClick={() => {
                          setMenu(null);
                          setDialog(online ? "rules" : "level");
                        }}
                      >
                        {online ? "Match rules..." : <><u>L</u>evel...</>}
                      </button>
                    </>
                  )}
                  {name === "Help" && (
                    <div className="classic-help">
                      Arrows: steer
                      <br />
                      Space / A: fire
                      <br />R / B: reverse
                      <br />P / Start: pause
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}
