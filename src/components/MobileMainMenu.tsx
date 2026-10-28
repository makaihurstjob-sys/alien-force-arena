import DronePreview from "./DronePreview";
import GameSettings from "./GameSettings";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, X, Trophy, Medal, Coins, Settings } from "lucide-react";
import { PlayerProfile } from "./PlayerProfile";
import { MenuPilot } from "./MenuPilot";
import { DesktopArena } from "./DesktopArena";
import "@/routes/desktop-main-menu.css";
import "./leaderboard-shortcut.css";
import "./main-menu-overhaul.css";
import { ShipIcon } from "./ShipIcon";
import RoomEntry from "./RoomEntry";
import { useMenuMusic } from "@/hooks/use-menu-music";
import { lobbyModes, type LobbyMode } from "@/lib/lobby-modes";
import GameChooser from "./GameChooser";
import { animateLobbyExit } from "@/lib/lobby-exit";
import ClassicLeaderboard from "./ClassicLeaderboard";
import Career from "./Career";
import { LoadoutScreen, ShopScreen } from "./MenuCosmetics";
import "./career.css";
import RankedRatings from "./RankedRatings";
import { createClassic, tickClassic } from "@/game/classic/engine";
import { renderClassic } from "@/game/classic/render";
import { createMatch } from "@/game/engine";
import { render } from "@/game/render";
import { ARENA } from "@/game/config";

// An isolated attract-mode simulation: never changes the player's actual game.
function ArenaPreview({
  active,
  arcade,
  practice,
  desktop = false,
}: {
  active: boolean;
  arcade: boolean;
  practice: boolean;
  desktop?: boolean;
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
    if (desktop) {
      state.phase = "playing";
      practiceState.phase = "playing";
    }
    state.invulnerable = 0;
    let frame = 0;
    let last = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.04);
      last = now;
      if (!document.hidden) {
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
          // Decorative preview markers only; real pickups render in-game.
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
  }, [active, arcade, practice, desktop]);
  return <canvas ref={canvas} width={424} height={424} aria-hidden="true" />;
}

function StandingsPreview({ ranked = false }: { ranked?: boolean }) {
  return <span className="standings-preview" aria-hidden="true">
    {ranked ? <Medal /> : <Trophy />}
    <b>{ranked ? "1v1 RATINGS" : "CLASSIC SCORES"}</b>
    <span className="standings-preview-row">{ranked ? "PLAYER / RATING" : "NAME / SCORE"}</span>
    {[1, 2, 3].map(rank => <span className="standings-preview-row" key={rank}><span>{rank}.</span><span>?</span></span>)}
  </span>;
}

export function MobileMainMenu() {
  const chooserTrigger = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState<LobbyMode>("solo");
  const [panel, setPanel] = useState<"career" | "lobby" | "settings" | "leaderboard" | "ratings" | "games" | "loadout" | "shop" | null>(null);
  const [roomBusy, setRoomBusy] = useState(false);
  const [roomPlaying, setRoomPlaying] = useState(false);
  const [inviteCode, setInviteCode] = useState<string>();
  const [lobbyMode, setLobbyMode] = useState<LobbyMode>('solo');
  const enterMode = (mode: LobbyMode) => {
    setSelected(mode); setInviteCode(undefined); setLobbyMode(mode); setPanel('lobby');
  };
  const leaveLobby = () => {
    animateLobbyExit(dialog.current);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setInviteCode(undefined); setPanel(null); setRoomPlaying(false); setRoomBusy(false);
  };
  useEffect(() => {
    const readInvite = () => {
      const player = new URLSearchParams(window.location.hash.slice(1)).get("player");
      if (player && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(player)) {
        setPanel("leaderboard");
        return;
      }
      const code = new URLSearchParams(window.location.hash.slice(1)).get("room");
      if (code && /^[a-z0-9]{6}$/i.test(code)) {
        setInviteCode(code.toUpperCase());
        // The invite link's mode param is just a placeholder for the very first
        // join/create call -- join and get don't validate it, and the server's
        // real room.mode (whatever the room actually is: arcade, duel, etc.)
        // takes over for every call after that. Only legacy Bullet Run links
        // need the literal "bullet" value recognized here.
        setLobbyMode(new URLSearchParams(window.location.hash.slice(1)).get("mode") === "bullet" ? "bullet" : "duel");
        setPanel("lobby");
      }
    };
    readInvite();
    window.addEventListener("hashchange", readInvite);
    return () => window.removeEventListener("hashchange", readInvite);
  }, []);
  const hangar = panel === 'lobby';
  useMenuMusic(!hangar && !roomPlaying);
  const menuPage = panel === 'career' || panel === 'loadout' || panel === 'shop';
  const dialog = useRef<HTMLDialogElement>(null);
  const mode = lobbyModes[selected];
  useEffect(() => {
    if (panel && panel !== "games" && !menuPage && !roomPlaying) dialog.current?.showModal();
    else dialog.current?.close();
    if (roomPlaying) document.querySelector<HTMLCanvasElement>(".online-match-screen canvas")?.focus();
  }, [panel, menuPage, roomPlaying]);

  return (
    <section className={`mobile-main-menu ${menuPage ? "is-menu-page" : ""}`} aria-label="Main menu">
      {!hangar && <PlayerProfile />}
      <div className="desktop-arena" aria-hidden="true">
        <DesktopArena mode={mode.name === "Arcade" ? 1 : mode.name === "Practice" ? 2 : 0} />
      </div>

      <header className="arena-menu-header">
        <h1 className="arena-menu-logo">Alien Force Arena</h1>
        <nav className="arena-menu-nav" aria-label="Main navigation">
          <button aria-current={!panel || panel === "games" ? "page" : undefined} onClick={() => setPanel(null)}>Play</button>
          <button aria-current={panel === "career" ? "page" : undefined} onClick={() => setPanel("career")}>Career</button>
          <button aria-current={panel === "loadout" ? "page" : undefined} onClick={() => setPanel("loadout")}>Loadout</button>
          <button aria-current={panel === "shop" ? "page" : undefined} onClick={() => setPanel("shop")}>Shop</button>
        </nav>
        <span className="arena-wallet" title="Coin balance is not connected" aria-label="Coins: balance unavailable"><Coins size={20} /><span>—</span></span>
      </header>
      {menuPage ? panel === "career" ? <section aria-label="Career"><Career /></section> : panel === "shop" ? <ShopScreen /> : <LoadoutScreen /> : <>
      <div className="arena-menu-center arena-squad-stage">
        <button className="arena-friend-slot" aria-label="Invite a friend to your lobby" onClick={() => enterMode(lobbyModes[selected].max > 1 ? selected : 'arcade')}><span>+</span><strong>Invite friend</strong><small>Create a room · Share the link</small></button>
        <div className="arena-hero-drone"><MenuPilot /><DronePreview /><span className="arena-pilot-status">PILOT READY</span></div>
        <button className="arena-friend-slot" aria-label="Join a friend's lobby" onClick={() => enterMode('arcade')}><span>+</span><strong>Play together</strong><small>Join with a room code</small></button>
      </div>
      <section className="arena-play-dock" aria-label="Selected game">
        <button className="arena-selected-game" aria-label={`Choose game, current game: ${mode.name}`} aria-haspopup="dialog" onClick={(event) => { chooserTrigger.current = event.currentTarget; setPanel("games"); }}>
          <span className="arena-selected-copy"><strong>{mode.name}</strong><span>{mode.description}</span></span>
          <ChevronRight />
        </button>
        <button className="arena-play-button" aria-haspopup="dialog" onClick={(event) => { chooserTrigger.current = event.currentTarget; setPanel("games"); }}>Play<ChevronRight /></button>
      </section>
      <footer>Fight · Adapt · Survive</footer>
      </>}
      {!panel && <button className="leaderboard-shortcut settings-shortcut" aria-label="Open Settings" title="Settings" onClick={() => setPanel("settings")}><Settings aria-hidden="true" /></button>}
      <GameChooser returnFocus={chooserTrigger} open={panel === "games"} mode={selected} onClose={() => setPanel(current => current === "games" ? null : current)} onChoose={enterMode} />
      {!menuPage && panel !== "games" && <dialog
        ref={dialog}
        className={`mobile-menu-dialog ${hangar ? "is-hangar" : ""} ${roomPlaying ? "is-playing" : ""} ${(panel === "leaderboard" || panel === "ratings") ? "classic-tracker-dialog" : ""}`}
        aria-labelledby="mobile-panel-title"
        onCancel={(event) => {
          if (event.target !== event.currentTarget) return;
          if (roomBusy || roomPlaying) event.preventDefault();
          else setPanel(null);
        }}
        onClose={(event) => { if (event.target !== event.currentTarget) return; if (!roomPlaying) {
          setPanel(null);
          if (new URLSearchParams(window.location.hash.slice(1)).has("player"))
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
        } }}
      >
        {hangar && <><PlayerProfile /><div className="hangar-backdrop" aria-hidden="true"><DesktopArena mode={0} /></div><div className="hangar-brand" aria-hidden="true">Alien Force Arena</div></>}
        <div className={`mobile-panel-heading ${hangar ? 'hangar-entry-heading' : ''}`}>
          <h2 id="mobile-panel-title" className={(panel === "leaderboard" || panel === "ratings") ? "sr-only" : undefined}>
            {panel === "leaderboard" ? "Global Leaderboard" : panel === "ratings" ? "Ranked Ratings" : roomPlaying ? "Online 1v1" : panel === "settings"
              ? "Settings"
              : "Game lobby"}
          </h2>
          <button aria-label="Close dialog" disabled={roomBusy || roomPlaying} onClick={() => setPanel(null)}>
            <X />
          </button>
        </div>
        {(panel === "leaderboard" || panel === "ratings") && <nav className="arena-record-tabs" aria-label="Leaderboard type"><button aria-pressed={panel === "leaderboard"} onClick={() => setPanel("leaderboard")}>Adventure scores</button><button aria-pressed={panel === "ratings"} onClick={() => setPanel("ratings")}>Ranked ratings</button></nav>}
        {panel === "leaderboard" ? <ClassicLeaderboard /> : panel === "ratings" ? <RankedRatings /> : panel === "settings" ? (
          <GameSettings onBack={() => setPanel(null)} />
        ) : (
          panel && (
            <RoomEntry
              key={`${lobbyMode}-${inviteCode ?? ""}`}
              initialMode={lobbyMode}
              initialCode={inviteCode}
              onLeave={leaveLobby}
              onBusyChange={setRoomBusy}
              onMatchChange={setRoomPlaying}
            />
          )
        )}
      </dialog>}
    </section>
  );
}
