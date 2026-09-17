import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Link2, Users, X, Trophy, Medal } from "lucide-react";
import { PlayerProfile } from "./PlayerProfile";
import { DesktopArena } from "./DesktopArena";
import "@/routes/desktop-main-menu.css";
import { ShipIcon } from "./ShipIcon";
import MultiplayerLobby from "./MultiplayerLobby";
import { createClassic, tickClassic } from "@/game/classic/engine";
import { renderClassic } from "@/game/classic/render";
import { createMatch } from "@/game/engine";
import { render } from "@/game/render";
import { ARENA } from "@/game/config";

const modes = [
  { name: "Classic", description: "Original arena combat", color: "#3ee08a" },
  { name: "Arcade", description: "Power-ups · Wraparound routes", color: "#ffe066" },
  { name: "Practice", description: "Local 1v1 · Training bot", color: "#3ee08a" },
  { name: "Global Leaderboard", description: "Classic ? Top Ten Scores", color: "#69d9ff" },
  { name: "Ranked Ratings", description: "1v1 ? Competitive standings", color: "#d0a0ff" },
] as const;

// An isolated attract-mode simulation: never changes the player's actual game.
function ArenaPreview({
  active,
  arcade,
  practice,
}: {
  active: boolean;
  arcade: boolean;
  practice: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    let state = createClassic();
    const practiceState = createMatch([
      { id: "preview-player", name: "Player", team: 0 },
      { id: "preview-bot", name: "Bot", team: 1 },
    ]);
    state.invulnerable = 0;
    let frame = 0;
    let last = 0;
    const media = window.matchMedia("(max-width: 767px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.04);
      last = now;
      if (media.matches && !document.hidden) {
        if (active && !reduced.matches) {
          tickClassic(state, { direction: null, fire: true }, dt);
          if (state.phase !== "playing") state = createClassic();
        }
        if (practice) {
          ctx.save();
          ctx.scale(424 / ARENA.width, 424 / ARENA.height);
          render(ctx, practiceState, "cross");
          ctx.restore();
        } else renderClassic(ctx, state, false);
        if (arcade) {
          // Concept markers only; Arcade is not playable yet.
          ctx.fillStyle = "#ffe066";
          ctx.font = '28px "Windows Bold", monospace';
          ctx.fillText("+", 100, 155);
          ctx.fillText("↑", 300, 315);
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [active, arcade, practice]);
  return <canvas ref={canvas} width={424} height={424} aria-hidden="true" />;
}

function StandingsPreview({ ranked = false }: { ranked?: boolean }) {
  return <span className="standings-preview" aria-hidden="true">
    {ranked ? <Medal /> : <Trophy />}
    <b>{ranked ? "1v1 RATINGS" : "TOP TEN SCORES"}</b>
    <span className="standings-preview-row">{ranked ? "PLAYER / RATING" : "NAME / SCORE"}</span>
    {[1, 2, 3].map(rank => <span className="standings-preview-row" key={rank}><span>{rank}.</span><span>?</span></span>)}
  </span>;
}

export function MobileMainMenu() {
  const [selected, setSelected] = useState(0);
  const [team, setTeam] = useState(1);
  const [panel, setPanel] = useState<"create" | "join" | "settings" | "leaderboard" | "ratings" | null>(null);
  const [roomBusy, setRoomBusy] = useState(false);
  const [roomPlaying, setRoomPlaying] = useState(false);
  const [inviteCode, setInviteCode] = useState<string>();
  useEffect(() => {
    const readInvite = () => {
      const code = new URLSearchParams(window.location.hash.slice(1)).get("room");
      if (code && /^[a-z0-9]{6}$/i.test(code)) {
        setInviteCode(code.toUpperCase());
        setPanel("join");
      }
    };
    readInvite();
    window.addEventListener("hashchange", readInvite);
    return () => window.removeEventListener("hashchange", readInvite);
  }, []);
  const dialog = useRef<HTMLDialogElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const mode = modes[selected] ?? modes[0];
  const move = (delta: number) =>
    setSelected((value) => (value + delta + modes.length) % modes.length);
  useEffect(() => {
    if (panel && !roomPlaying) dialog.current?.showModal();
    else dialog.current?.close();
    if (roomPlaying) document.querySelector<HTMLCanvasElement>(".online-match-screen canvas")?.focus();
  }, [panel, roomPlaying]);

  return (
    <section className="mobile-main-menu" aria-label="Main menu">
      <PlayerProfile />
      <div className="desktop-arena" aria-hidden="true">
        <DesktopArena mode={selected} />
      </div>
      <header className="desktop-menu-brand">
        <h1>Alien Force Arena</h1>
      </header>
      <div className="desktop-mode-detail" aria-live="polite" key={mode.name}>
        <ShipIcon size={80} />
        <h2>{mode.name}</h2>
        <p>{mode.description}</p>
        {selected >= 3 ? (
          <button className="desktop-play" onClick={() => setPanel(selected === 3 ? "leaderboard" : "ratings")}>View {mode.name}<ChevronRight /></button>
        ) : selected === 1 ? (
          <button className="desktop-play" disabled>
            Coming Soon
          </button>
        ) : (
          <Link className="desktop-play" to={selected === 0 ? "/classic" : "/practice"}>
            Play {mode.name}
            <ChevronRight />
          </Link>
        )}
      </div>
      <nav
        className="desktop-mode-picker"
        aria-label="Desktop game modes"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            move(event.key === "ArrowRight" ? 1 : -1);
          }
        }}
      >
        <button className="desktop-mode-arrow" aria-label="Previous mode" onClick={() => move(-1)}>
          <ChevronLeft />
        </button>
        {modes.map((item, index) => (
          <button
            key={item.name}
            className="desktop-mode-tile"
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
          >
            <span className="desktop-thumbnail">
              {index >= 3 ? <StandingsPreview ranked={index === 4} /> : <DesktopArena mode={index} thumbnail />}
            </span>
            <strong>{item.name}</strong>
            {index === 1 && <small>Coming soon</small>}
          </button>
        ))}
        <button className="desktop-mode-arrow" aria-label="Next mode" onClick={() => move(1)}>
          <ChevronRight />
        </button>
      </nav>
      <span className="desktop-preview-label">Development preview</span>
      <header className="mobile-menu-header">
        <div className="mobile-menu-top">
          <ShipIcon size={34} />

        </div>
        <h1>Alien Force Arena</h1>
        <p>Small arenas. Big battles.</p>
      </header>
      <div
        className="mode-carousel"
        role="region"
        aria-roledescription="carousel"
        aria-label="Game modes"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            move(event.key === "ArrowRight" ? 1 : -1);
          }
        }}
        onTouchStart={(event) => {
          const first = event.touches[0];
          if (first) touch.current = { x: first.clientX, y: first.clientY };
        }}
        onTouchEnd={(event) => {
          const start = touch.current;
          const end = event.changedTouches[0];
          touch.current = null;
          if (!start || !end) return;
          const dx = end.clientX - start.x;
          const dy = end.clientY - start.y;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
        }}
        onTouchCancel={() => {
          touch.current = null;
        }}
      >
        {modes.map((item, index) => {
          const offset = (index - selected + modes.length) % modes.length;
          const position = offset === 0 ? "selected" : offset === 1 ? "next" : offset === modes.length - 1 ? "previous" : "offstage";
          return (
            <button
              key={item.name}
              className={`mode-card ${position}`}
              style={{ "--mode-color": item.color } as React.CSSProperties}
              tabIndex={selected === index ? 0 : -1}
              aria-label={`Select ${item.name}${index === 1 ? ", coming soon" : ""}`}
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
            >
              {index >= 3 ? <StandingsPreview ranked={index === 4} /> : <ArenaPreview
                active={selected === index}
                arcade={index === 1}
                practice={index === 2}
              />}
              <span className="mode-caption">
                <strong>{item.name}</strong>
                <span>{item.description}</span>
                {index === 1 && <em>Coming soon</em>}
              </span>
            </button>
          );
        })}
        <button
          className="carousel-arrow previous-arrow"
          aria-label="Previous game mode"
          onClick={() => move(-1)}
        >
          <ChevronLeft />
        </button>
        <button
          className="carousel-arrow next-arrow"
          aria-label="Next game mode"
          onClick={() => move(1)}
        >
          <ChevronRight />
        </button>
      </div>
      <div className="mode-dots" aria-label="Choose mode">
        {modes.map((item, index) => (
          <button
            key={item.name}
            aria-label={`Show ${item.name}`}
            aria-pressed={index === selected}
            onClick={() => setSelected(index)}
            style={{ background: index === selected ? mode.color : undefined }}
          />
        ))}
      </div>
      <div className="mobile-mode-actions" aria-live="polite">
        {selected >= 3 ? (
          <button className="mobile-play" onClick={() => setPanel(selected === 3 ? "leaderboard" : "ratings")}>View {mode.name}<ChevronRight size={22} /></button>
        ) : selected === 1 ? (
          <>
            <div className="team-options" aria-label="Planned Arcade team size">
              {[1, 2].map((size) => (
                <button key={size} aria-pressed={team === size} onClick={() => setTeam(size)}>
                  {size}v{size}
                </button>
              ))}
            </div>
            <button className="mobile-play" disabled>
              Coming Soon
            </button>
          </>
        ) : (
          <Link className="mobile-play" to={selected === 0 ? "/classic" : "/practice"}>
            Play {mode.name}
            <ChevronRight size={22} />
          </Link>
        )}
      </div>
      <div className="mobile-room-actions">
        <button
          onClick={() => {
            setRoomBusy(true);
            setPanel("create");
          }}
        >
          <Users />
          Create Room
        </button>
        <button onClick={() => setPanel("join")}>
          <Link2 />
          Join Room
        </button>
      </div>
      <footer>Fight · Adapt · Survive</footer>
      <dialog
        ref={dialog}
        className={`mobile-menu-dialog ${roomPlaying ? "is-playing" : ""}`}
        aria-labelledby="mobile-panel-title"
        onCancel={(event) => {
          if (roomBusy || roomPlaying) event.preventDefault();
          else setPanel(null);
        }}
        onClose={() => { if (!roomPlaying) setPanel(null); }}
      >
        <div className="mobile-panel-heading">
          <h2 id="mobile-panel-title">
            {panel === "leaderboard" ? "Global Leaderboard" : panel === "ratings" ? "Ranked Ratings" : roomPlaying ? "Online 1v1" : panel === "settings"
              ? "About the game"
              : panel === "join"
                ? "Join Room"
                : "Create Room"}
          </h2>
          <button aria-label="Close dialog" disabled={roomBusy || roomPlaying} onClick={() => setPanel(null)}>
            <X />
          </button>
        </div>
        {panel === "leaderboard" || panel === "ratings" ? (
          <div className="standings-panel">
            <h3>{panel === "leaderboard" ? "Top Ten Scores" : "1v1 Standings"}</h3>
            <div className="standings-table-scroll">
              <table><thead><tr>{(panel === "leaderboard" ? ["Rank", "Player", "Score", "Level"] : ["Rank", "Player", "Tier", "W?L", "Rating", "Peak"]).map(label => <th key={label}>{label}</th>)}</tr></thead>
              <tbody><tr><td colSpan={panel === "leaderboard" ? 4 : 6}>{panel === "leaderboard" ? "Global score tracking is coming soon." : "Ranked play is coming soon."}</td></tr></tbody></table>
            </div>
            <p>{panel === "leaderboard" ? "This board will show saved Classic high scores. Online score saving is not connected yet." : "This board will show competitive 1v1 ratings and match records. Private friend-code rooms remain unranked."}</p>
            <button className="standings-back" onClick={() => setPanel(null)}>Back to menu</button>
          </div>
        ) : panel === "settings" ? (
          <p>
            Classic is a reconstruction of the original game. Movement, timing and layouts are still
            being tuned. Private 1v1 rooms are playable. Arcade power-ups and wraparound routes are in development.
            Swipe the cards to choose a mode.
          </p>
        ) : (
          panel && (
            <MultiplayerLobby
              key={`${panel}-${inviteCode ?? ""}`}
              entryMode={panel}
              initialCode={inviteCode}
              onBusyChange={setRoomBusy}
              onMatchChange={setRoomPlaying}
            />
          )
        )}
      </dialog>
    </section>
  );
}
