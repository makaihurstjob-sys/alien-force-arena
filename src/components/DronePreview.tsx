import { useRef, useState } from "react";
import "./drone-preview.css";

// A lightweight CSS 3D model: layered hull, raised cockpit and twin engine pods.
// Pointer events support mouse and touch without a WebGL download on mobile.
export default function DronePreview({
  compact = false,
  color = "#50ffd0",
}: {
  compact?: boolean;
  color?: string;
}) {
  const [view, setView] = useState({ pitch: 52, yaw: -25 });
  const drag = useRef<{ id: number; x: number; y: number; pitch: number; yaw: number } | null>(
    null,
  );
  return (
    <div className={`drone-preview ${compact ? "is-compact" : ""}`}>
      <div
        className="drone-orbit"
        role="img"
        tabIndex={0}
        aria-label="3D drone preview. Drag with your mouse or finger to rotate. Arrow keys rotate; Home resets."
        onKeyDown={(event) => {
          if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home"].includes(event.key))
            return;
          event.preventDefault();
          setView((v) =>
            event.key === "Home"
              ? { pitch: 52, yaw: -25 }
              : {
                  pitch: Math.max(
                    -70,
                    Math.min(
                      75,
                      v.pitch +
                        (event.key === "ArrowUp" ? -10 : event.key === "ArrowDown" ? 10 : 0),
                    ),
                  ),
                  yaw:
                    v.yaw + (event.key === "ArrowLeft" ? -15 : event.key === "ArrowRight" ? 15 : 0),
                },
          );
        }}
        onPointerDown={(event) => {
          if (drag.current || (event.pointerType === "mouse" && event.button !== 0)) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, ...view };
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start || start.id !== event.pointerId) return;
          setView({
            yaw: start.yaw + (event.clientX - start.x) * 0.7,
            pitch: Math.max(-70, Math.min(75, start.pitch - (event.clientY - start.y) * 0.5)),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
      >
        <div className="drone-platform" />
        <div
          className="drone-model"
          style={
            {
              transform: `rotateX(${view.pitch}deg) rotateZ(${view.yaw}deg)`,
              "--drone-color": color,
            } as React.CSSProperties
          }
        >
          {Array.from({ length: 8 }, (_, index) => (
            <span
              key={index}
              className="drone-hull"
              style={{ transform: `translateZ(${index * 2}px)` }}
            />
          ))}
          <span className="drone-wing left" />
          <span className="drone-wing right" />
          <span className="drone-cockpit" />
          <span className="drone-spine" />
          <span className="drone-engine left" />
          <span className="drone-engine right" />
        </div>
      </div>
      {!compact && <small className="drone-instructions">Drag to rotate · Mouse or touch</small>}
    </div>
  );
}
