import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import type { Direction } from "@/game/classic/engine";
import "./touch-joystick.css";

function joystickDirection(x: number, y: number): Direction | null {
  if (Math.hypot(x, y) < 0.18) return null;
  return Math.abs(x) > Math.abs(y) ? (x < 0 ? "left" : "right") : y < 0 ? "up" : "down";
}

export default function TouchJoystick({
  onChange,
  disabled = false,
}: {
  onChange: (direction: Direction | null) => void;
  disabled?: boolean;
}) {
  const pointer = useRef<number | null>(null);
  const callback = useRef(onChange);
  callback.current = onChange;
  const direction = useRef<Direction | null>(null);
  const [thumb, setThumb] = useState({ x: 0, y: 0 });
  const change = useCallback((next: Direction | null) => {
    if (direction.current === next) return;
    direction.current = next;
    callback.current(next);
  }, []);
  const clear = useCallback(() => {
    pointer.current = null;
    setThumb({ x: 0, y: 0 });
    change(null);
  }, [change]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) clear();
    };
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", hidden);
      callback.current(null);
    };
  }, [clear]);
  useEffect(() => {
    if (disabled) clear();
  }, [disabled, clear]);
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2);
    const y = (event.clientY - bounds.top - bounds.height / 2) / (bounds.height / 2);
    const scale = Math.max(1, Math.hypot(x, y));
    setThumb({ x: (x / scale) * 36, y: (y / scale) * 36 });
    change(joystickDirection(x, y));
  };
  const release = (event: PointerEvent<HTMLDivElement>) => {
    if (pointer.current === event.pointerId) clear();
  };
  return (
    <div
      className="touch-joystick"
      role="group"
      aria-label="Movement joystick"
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (
          disabled ||
          pointer.current !== null ||
          (event.pointerType === "mouse" && event.button !== 0)
        )
          return;
        event.preventDefault();
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        move(event);
      }}
      onPointerMove={(event) => {
        if (pointer.current === event.pointerId) {
          event.preventDefault();
          move(event);
        }
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      {(["up", "left", "down", "right"] as const).map((value) => (
        <button
          type="button"
          key={value}
          className={`joystick-key joystick-${value}`}
          aria-label={`Move ${value}`}
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.code === "Space" || event.code === "Enter") {
              event.preventDefault();
              change(value);
            }
          }}
          onKeyUp={(event) => {
            if (event.code === "Space" || event.code === "Enter") {
              event.preventDefault();
              change(null);
            }
          }}
          onBlur={() => {
            if (pointer.current === null) change(null);
          }}
        >
          {{ up: "▲", down: "▼", left: "◀", right: "▶" }[value]}
        </button>
      ))}
      <span
        className="joystick-thumb"
        aria-hidden="true"
        style={{ transform: `translate(${thumb.x}px, ${thumb.y}px)` }}
      />
    </div>
  );
}
