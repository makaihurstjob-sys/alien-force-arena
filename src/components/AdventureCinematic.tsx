import { useEffect, useRef, useState } from "react";
import { adventureStory, type FilmScene } from "./adventure-story";
import AdventureFilmArt from "./AdventureFilmArt";
import "./adventure-cinematic.css";

type Props = {
  scene: FilmScene;
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
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  const story = adventureStory(scene, level);
  const [beat, setBeat] = useState(0);
  const [progress, setProgress] = useState(0);
  const next = useRef<HTMLButtonElement>(null);
  const finish = useRef(onFinish);
  finish.current = onFinish;
  const current = story[Math.min(beat, story.length - 1)]!;
  const finalBeat = beat >= story.length - 1;
  const confirmation = finalBeat && scene !== "origin";
  useEffect(() => {
    setBeat(0);
    setProgress(0);
    next.current?.focus();
  }, [scene, level]);
  useEffect(() => {
    setProgress(0);
    if (!current.duration) return;
    let frame = 0,
      elapsed = 0,
      last: number | null = null,
      painted = 0;
    const tick = (now: number) => {
      if (document.hidden) last = null;
      else {
        if (last !== null) elapsed += Math.min(100, now - last);
        last = now;
        if (elapsed >= current.duration) {
          if (finalBeat) finish.current();
          else setBeat((value) => value + 1);
          return;
        }
        if (now - painted >= 100) {
          setProgress(elapsed / current.duration);
          painted = now;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [scene, beat, current.duration, finalBeat]);
  const continueStory = () => {
    if (finalBeat) finish.current();
    else setBeat((value) => value + 1);
  };
  // Skipping narration still lands on the mission confirmation; it never starts combat.
  const skip = () => {
    if (scene === "origin") finish.current();
    else setBeat(story.length - 1);
  };
  return (
    <div
      className="adventure-film"
      role="dialog"
      aria-modal="true"
      aria-label="Adventure story cinematic"
      data-scene={scene}
      data-beat={beat}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape" && !confirmation) {
          event.preventDefault();
          skip();
        }
        if (event.key === "Tab") {
          const buttons = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
          );
          if (event.shiftKey && document.activeElement === buttons[0]) {
            event.preventDefault();
            buttons.at(-1)?.focus();
          } else if (!event.shiftKey && document.activeElement === buttons.at(-1)) {
            event.preventDefault();
            buttons[0]?.focus();
          }
        }
      }}
    >
      <section className="film-frame">
        <header className="film-kicker">
          <span>
            ALIEN FORCE ARENA <b>/ ADVENTURE</b>
          </span>
          <span>
            {scene === "origin"
              ? "PROLOGUE"
              : scene === "boarding"
                ? "MISSION 001"
                : `SECTOR TRANSIT / ${level}`}
          </span>
        </header>
        <div className="film-stage" key={`${scene}-${beat}`}>
          <AdventureFilmArt art={current.art} color={color} previousColor={previousColor} />
          <div className="film-letterbox" aria-hidden="true" />
        </div>
        <div className="film-copy" aria-live="polite" aria-atomic="true">
          <span className="film-eyebrow">
            {confirmation ? "YOUR MISSION AWAITS" : "ARI VEGA / OPERATION LAST LIGHT"}
          </span>
          <h2>{current.title}</h2>
          <p>{current.text}</p>
        </div>
        <div className="film-chapters" aria-label={`Scene ${beat + 1} of ${story.length}`}>
          {story.map((_, index) => (
            <span key={index} className={index < beat ? "is-complete" : ""}>
              <i
                style={{
                  transform: `scaleX(${index < beat ? 1 : index === beat ? (confirmation ? 1 : progress) : 0})`,
                }}
              />
            </span>
          ))}
        </div>
        <footer className="film-actions">
          {confirmation ? (
            <button className="film-secondary" onClick={() => setBeat(0)}>
              Replay scene
            </button>
          ) : (
            <button className="film-secondary" onClick={skip}>
              Skip narration
            </button>
          )}
          <button ref={next} className="film-primary" onClick={continueStory}>
            {confirmation
              ? scene === "boarding"
                ? "Start Protecting"
                : "Continue Mission"
              : finalBeat
                ? "Board Last Light"
                : "Next scene"}
            <span aria-hidden="true"> ↗</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
