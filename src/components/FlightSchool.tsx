import { useEffect, useRef, useState } from "react";
import { TRAINING_LESSONS, createTraining, stepTraining } from "@/game/training/flight-school";
import { render as renderFlight } from "@/game/render";
import { renderPowerDuel } from "@/game/classic/powerup-duel-render";
import { useKeyboardInput } from "@/game/useGameLoop";
import { EMPTY_INPUT, type PlayerInput } from "@/game/types";
import { keyboardHelp, matches } from "@/lib/keybindings";
import TouchJoystick from "./TouchJoystick";
import "./flight-school.css";

export default function FlightSchool({
  onComplete,
  onReturn,
}: {
  onComplete: () => void;
  onReturn?: () => void;
}) {
  const [welcomed, setWelcomed] = useState(false);
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [passed, setPassed] = useState(false);
  const [voice, setVoice] = useState(false);
  const [power, setPower] = useState("");
  const [viewTick, setViewTick] = useState(0);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  useEffect(() => {
    setVoiceAvailable("speechSynthesis" in window);
  }, []);
  const [initialSession] = useState(() => createTraining());
  const session = useRef(initialSession);
  const canvas = useRef<HTMLCanvasElement>(null);
  const touch = useRef<PlayerInput>({ ...EMPTY_INPUT });
  const { inputRef } = useKeyboardInput(active && !paused && !passed);
  const lesson = TRAINING_LESSONS[index];
  const graduated = index >= TRAINING_LESSONS.length;
  const message = !welcomed
    ? "Welcome to Flight School. I’m AX-7. I’ll teach you how to fly, fight and use every Arcade power-up. You’ll try each action in a safe Practice range."
    : graduated
      ? "Excellent work, pilot. You have earned your wings. Adventure has lane movement and gates; Arcade adds the power-ups you just mastered. Practice is always here when you need it."
      : passed
        ? "Objective verified. Good work! Continue when you’re ready."
        : lesson!.text;
  useEffect(() => {
    if (!voice || !("speechSynthesis" in window)) return;
    const speech = new SpeechSynthesisUtterance(message);
    speech.lang = "en-US";
    speech.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(speech);
    return () => window.speechSynthesis.cancel();
  }, [voice, message]);
  useEffect(() => {
    const clear = () => {
      touch.current = { ...EMPTY_INPUT };
      inputRef.current = { ...EMPTY_INPUT };
      setPaused(true);
    };
    const hide = () => {
      if (document.hidden) clear();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (matches("pause", event.code) && !event.repeat) {
        event.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("blur", clear);
    window.addEventListener("keydown", keyboard);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("blur", clear);
      window.removeEventListener("keydown", keyboard);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [inputRef]);
  useEffect(() => {
    let frame = 0,
      last = performance.now(),
      acc = 0,
      hud = 0;
    const draw = (now: number) => {
      const current = session.current;
      acc += Math.min(now - last, 100);
      last = now;
      while (acc >= 1000 / 60) {
        if (active && !paused && !passed) {
          const input = { ...inputRef.current };
          for (const key of Object.keys(EMPTY_INPUT) as (keyof PlayerInput)[])
            if (touch.current[key]) input[key] = true;
          input.turnaround ||= !!touch.current.turnaround;
          stepTraining(current, input);
          if (current.passed) {
            setPassed(true);
            inputRef.current = { ...EMPTY_INPUT };
            touch.current = { ...EMPTY_INPUT };
            break;
          }
        }
        acc -= 1000 / 60;
      }
      const ctx = canvas.current?.getContext("2d");
      if (ctx && lesson) {
        if (lesson.arena === "flight") renderFlight(ctx, current.flight, "pillars");
        else renderPowerDuel(ctx, current.match, "you");
      }
      if (now - hud > 120) {
        setViewTick(current.match.game.tick);
        setPower(
          current.match.buffs.get("you")?.kind ??
            ((current.match.teleportCharges.get("you") ?? 0) > 0 ? "Teleport charged" : ""),
        );
        hud = now;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [active, paused, passed, index, inputRef, lesson]);
  const reset = (next = index) => {
    session.current = createTraining(next);
    setIndex(next);
    setPassed(false);
    setActive(false);
    setPaused(false);
    setPower("");
    touch.current = { ...EMPTY_INPUT };
    inputRef.current = { ...EMPTY_INPUT };
  };
  const action = (key: "fire" | "turnaround" | "dash") => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      touch.current[key] = true;
    },
    onPointerUp: () => {
      touch.current[key] = false;
    },
    onPointerCancel: () => {
      touch.current[key] = false;
    },
    onLostPointerCapture: () => {
      touch.current[key] = false;
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        touch.current[key] = true;
      }
    },
    onKeyUp: () => {
      touch.current[key] = false;
    },
    onBlur: () => {
      touch.current[key] = false;
    },
  });
  return (
    <main
      className="flight-school"
      aria-label="Practice Flight School"
      data-lesson={lesson?.id ?? "graduated"}
      data-complete={passed}
      data-tick={viewTick}
    >
      <header className="school-header">
        <div>
          <small>ALIEN FORCE ARENA / PRACTICE</small>
          <h1>FLIGHT SCHOOL</h1>
        </div>
        <span>
          {graduated ? "PILOT CERTIFIED" : `${index + 1} / ${TRAINING_LESSONS.length} LESSONS`}
        </span>
      </header>
      <div className="school-layout">
        <section className="school-range" aria-label="Safe practice range">
          {!graduated && (
            <canvas
              ref={canvas}
              width={lesson!.arena === "flight" ? 800 : 424}
              height={lesson!.arena === "flight" ? 600 : 424}
              tabIndex={0}
              aria-label="Tutorial playfield"
            />
          )}
          {(!active || paused || passed || graduated) && (
            <div className="school-range-overlay">
              <strong>
                {graduated
                  ? "WINGS EARNED"
                  : passed
                    ? "OBJECTIVE COMPLETE"
                    : paused
                      ? "TRAINING PAUSED"
                      : welcomed
                        ? "TRAINING RANGE READY"
                        : "WELCOME, PILOT"}
              </strong>
              {paused && (
                <button
                  onClick={() => {
                    setPaused(false);
                    canvas.current?.focus();
                  }}
                >
                  Resume training
                </button>
              )}
            </div>
          )}
          {active && !passed && !paused && (
            <div className="school-range-label">
              SAFE RANGE · {power || "Follow AX-7’s instructions"}
            </div>
          )}
        </section>
        <aside className="school-instructor" aria-label="Instructor AX-7">
          <div className="school-npc" aria-hidden="true">
            <svg viewBox="0 0 180 150">
              <path
                d="m55 70-35 18 10 28 35-8m60-38 35 18-10 28-35-8"
                fill="#325465"
                stroke="#70d9cf"
              />
              <rect
                x="40"
                y="26"
                width="100"
                height="88"
                rx="32"
                fill="#142d42"
                stroke="#81eee0"
                strokeWidth="3"
              />
              <rect x="53" y="51" width="74" height="34" rx="14" fill="#07111e" />
              <path d="M66 67h14m20 0h14M77 96h26" stroke="#8ef4d7" strokeWidth="5" />
              <path d="M90 25V9m-8 0h16" stroke="#85d3e7" strokeWidth="4" />
              <ellipse cx="90" cy="139" rx="42" ry="5" fill="#68eac5" opacity=".2" />
            </svg>
          </div>
          <div className="school-trainer-name">
            <strong>AX-7</strong>
            <span>YOUR FLIGHT INSTRUCTOR</span>
          </div>
          <h2>
            {!welcomed
              ? "Let’s get you ready"
              : graduated
                ? "You’re ready to protect"
                : lesson!.title}
          </h2>
          <p className="school-caption" aria-live="polite">
            {message}
          </p>
          {welcomed && !graduated && (
            <p className={`school-objective ${passed ? "is-complete" : ""}`}>
              <b>{passed ? "✓ VERIFIED" : "YOUR OBJECTIVE"}</b>
              {lesson!.goal}
            </p>
          )}
          <div className="school-buttons">
            {!welcomed ? (
              <button
                onClick={() => {
                  setWelcomed(true);
                  setPaused(false);
                }}
              >
                Begin training
              </button>
            ) : graduated ? (
              <button onClick={onComplete}>Complete training</button>
            ) : passed ? (
              <button
                onClick={() => {
                  if (index + 1 === TRAINING_LESSONS.length) {
                    setIndex(index + 1);
                    setActive(false);
                  } else reset(index + 1);
                }}
              >
                Next lesson
              </button>
            ) : !active ? (
              <button
                onClick={() => {
                  setActive(true);
                  setPaused(false);
                  canvas.current?.focus();
                }}
              >
                Begin lesson
              </button>
            ) : (
              <button onClick={() => reset()}>Retry lesson</button>
            )}
            <button
              className="school-secondary"
              disabled={!voiceAvailable}
              aria-pressed={voice}
              onClick={() => setVoice((v) => !v)}
            >
              Trainer voice {voice ? "on" : "off"}
            </button>
            {onReturn && (
              <button className="school-secondary" onClick={onReturn}>
                Return to Practice
              </button>
            )}
          </div>
          <small className="school-voice-note">
            Captions always available. Voice uses your browser when supported.
          </small>
        </aside>
      </div>
      {!graduated && (
        <section className="school-controls" aria-label="Training controls">
          <TouchJoystick
            disabled={!active || paused || passed}
            onChange={(direction) => {
              touch.current.thrust = direction === "up";
              touch.current.reverse = direction === "down";
              touch.current.left = direction === "left";
              touch.current.right = direction === "right";
            }}
          />
          <div className="school-action-buttons">
            <button disabled={!active || paused || passed} {...action("fire")}>
              FIRE
            </button>
            <button disabled={!active || paused || passed} {...action("turnaround")}>
              TURN AROUND
            </button>
            <button disabled={!active || paused || passed} {...action("dash")}>
              TELEPORT
            </button>
            <button disabled={!active || passed} onClick={() => setPaused((v) => !v)}>
              {paused ? "Resume" : "Pause"}
            </button>
          </div>
          <p>
            {keyboardHelp(true)}{" "}
            {lesson?.arena === "flight"
              ? "Practice: rotate + thrust."
              : "Combat grid: absolute directions and buffered turns."}
          </p>
        </section>
      )}
    </main>
  );
}
