import { useEffect, useRef, useState } from "react";
import { adventureSector, type ClassicState } from "@/game/classic/engine";
import "./adventure-cinematic.css";

type Props = {
  scene: NonNullable<ClassicState["scene"]>;
  level: number;
  color: string;
  previousColor?: string | undefined;
  onFinish: () => void;
};
export default function AdventureCinematic({
  scene,
  level,
  color,
  previousColor,
  onFinish,
}: Props) {
  const [beat, setBeat] = useState(0);
  const nextButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setBeat(0);
    nextButton.current?.focus();
  }, [scene]);
  const story =
    scene === "origin"
      ? [
          [
            "THE LAST PILOT",
            "Before the war, pilot Ari Vega guided supply ships between peaceful worlds. Then the Sentinel network turned every defense drone against the people it was built to protect.",
          ],
          [
            "A PROMISE IN THE DARK",
            "Ari's home vanished behind the drone blockade. One final message escaped: the network is spreading toward the universe's star gates. If it reaches the Core, no world will be safe.",
          ],
          [
            "OPERATION LAST LIGHT",
            "Ari takes the last flyable ship. Break through each sector, destroy its drone commander, and reach the Core before the network consumes the universe. Every open door is one world closer to freedom.",
          ],
        ]
      : scene === "boarding"
        ? [
            [
              "HANGAR 01 · ORIGINAL SHIP",
              "Ari crosses the empty hangar toward the original white ship, Last Light. The cockpit opens. There is no fleet coming to help.",
            ],
            [
              "CLEAR FOR LAUNCH",
              "Harness locked. Engines online. Ari climbs aboard: ‘For everyone still out there.’ First destination: Sol's Last Light. Move to begin level 1.",
            ],
          ]
        : [
            [
              `GATE TRANSIT · LEVEL ${level}`,
              "The commander falls. Last Light slips through the exit door into the next sector's emergency hangar.",
            ],
            [
              "WARNING · REACTOR FAILURE",
              "The battle has taken its toll. The damaged ship shudders to a halt, smoke spilling from its engines. Ari opens the canopy and climbs out before the reactor fails.",
            ],
            [
              "A NEW SHIP · THE SAME PROMISE",
              `A different-colored reserve ship waits across the hangar. Ari runs to it, climbs aboard, and powers up. Next destination: ${adventureSector(level).name}. The mission continues.`,
            ],
          ];
  const finalBeat = beat === story.length - 1;
  const replacement = scene === "transfer" && beat === 2;
  const shipArt = (
    <svg viewBox="0 0 120 130" fill="none">
      <path
        d="M60 5 74 44 109 84 109 105 76 93 69 114 51 114 44 93 11 105 11 84 46 44Z"
        fill="currentColor"
        stroke="#d5edff"
        strokeWidth="2"
      />
      <path d="m60 24 9 36-9 17-9-17Z" fill="#103f63" stroke="#7ce9ff" strokeWidth="2" />
      <path d="M26 87h18m32 0h18M49 102h22" stroke="#294f69" strokeWidth="5" />
      <path d="M52 115 60 130 68 115" fill="#79e8ff" />
    </svg>
  );
  return (
    <div
      className={`adventure-film scene-${scene} beat-${beat}`}
      role="dialog"
      aria-modal="true"
      aria-label="Adventure story cinematic"
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onFinish();
        if (e.key === "Tab") {
          const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
          if (e.shiftKey && document.activeElement === buttons[0]) {
            e.preventDefault();
            buttons.at(-1)?.focus();
          } else if (!e.shiftKey && document.activeElement === buttons.at(-1)) {
            e.preventDefault();
            buttons[0]?.focus();
          }
        }
      }}
    >
      <div className="film-frame">
        <div className="film-kicker">
          ALIEN FORCE / ADVENTURE{" "}
          <span>
            {beat + 1} / {story.length}
          </span>
        </div>
        <div className="film-stage" key={`${scene}-${beat}`} aria-hidden="true">
          <div className="film-planet" />
          <div className="film-gate" />
          <div
            className={`film-ship ${scene === "transfer" && beat === 1 ? "damaged" : ""}`}
            style={{ color: scene === "transfer" ? previousColor : color }}
          >
            {shipArt}
            <i />
          </div>
          {scene !== "origin" && (
            <>
              <div className="film-floor" />
              <div className={`film-pilot ${replacement ? "to-new-ship" : ""}`}>
                <b />
                <i />
                <span />
                <span />
              </div>
            </>
          )}
          {scene === "transfer" && beat > 0 && (
            <div className="film-reserve" style={{ color }}>
              {shipArt}
            </div>
          )}
          <div className="film-scene-label">
            {scene === "origin"
              ? "SENTINEL BLOCKADE"
              : scene === "boarding"
                ? "LAST LIGHT / HANGAR 01"
                : replacement
                  ? "RESERVE CRAFT / READY"
                  : "EMERGENCY DOCK"}
          </div>
        </div>
        <div className="film-copy" aria-live="polite">
          <h2>{story[beat]?.[0]}</h2>
          <p>{story[beat]?.[1]}</p>
        </div>
        <div className="film-actions">
          <button onClick={onFinish}>Skip {scene === "origin" ? "story" : "cinematic"}</button>
          <button ref={nextButton} onClick={() => (finalBeat ? onFinish() : setBeat(beat + 1))}>
            {finalBeat ? (scene === "origin" ? "Meet your ship →" : "Launch →") : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}
