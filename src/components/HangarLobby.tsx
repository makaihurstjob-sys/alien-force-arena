import DronePreview from "./DronePreview";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import RankedProgress from "./RankedProgress";
import { Crown } from "lucide-react";
import GameChooser from "./GameChooser";
import { useLobbyRadio } from "@/hooks/use-lobby-radio";
import type { BulletLobby } from "@/lib/bullet-lobby";
import "./hangar-lobby.css";
import { lobbyModes, type LobbyMode } from "@/lib/lobby-modes";

export default function HangarLobby({
  onJoinRoom,
  room,
  player,
  busy,
  connected,
  unavailable,
  readinessAvailable,
  selfReady,
  allReady,
  status,
  onLeave,
  onReady,
  onStart,
  invite,
  mode = "bullet",
  onModeChange,
  searchStartedAt,
  startLabel = "Start match",
  allowMemberStart = false,
}: {
  onJoinRoom?: (() => void) | undefined;
  searchStartedAt?: string | undefined;
  startLabel?: string;
  allowMemberStart?: boolean;
  room: BulletLobby;
  player: string;
  busy: boolean;
  connected: boolean;
  unavailable: boolean;
  readinessAvailable: boolean;
  selfReady: boolean;
  allReady: boolean;
  status: string;
  onLeave: () => void;
  onReady: () => void;
  onStart: () => void;
  invite: string;
  mode?: LobbyMode;
  onModeChange?: ((mode: LobbyMode) => void) | undefined;
}) {
  const radio = useLobbyRadio();
  const [searchNow, setSearchNow] = useState(Date.now);
  const searchStart = searchStartedAt ? Date.parse(searchStartedAt) : NaN;
  useEffect(() => {
    if (!Number.isFinite(searchStart)) return;
    setSearchNow(Date.now());
    const timer = setInterval(() => setSearchNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [searchStart]);
  const elapsedSeconds = Math.max(0, Math.floor((searchNow - searchStart) / 1000));
  const trigger = useRef<HTMLButtonElement>(null);
  const inviteInput = useRef<HTMLInputElement>(null);
  const [selecting, setSelecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      inviteInput.current?.focus();
      inviteInput.current?.select();
    }
  };
  const game = lobbyModes[mode];
  const canInvite = !!invite && room.members.length < game.max;
  const open = room.status === "open";
  const ready = room.members.filter((m) => m.ready).length;
  const members = [room.members.find(m => m.player_id === player), ...room.members.filter(m => m.player_id !== player)].filter(m => !!m);
  return (
    <section className={`hangar-lobby squad-hangar ${game.max === 1 ? "is-solo" : ""}`} aria-label={`${game.name} lobby`}>
      <div className="hangar-tabs" aria-label="Game and room details">
        <button
          ref={trigger}
          className="hangar-game-selector"
          aria-haspopup="dialog"
          aria-expanded={selecting}
          onClick={() => setSelecting(true)}
        >
          {game.name} <span aria-hidden="true">⌄</span>
        </button>
        <span>{game.description}</span>
        {mode !== "ranked" && <span>
          {room.members.length}/{game.max} pilots
        </span>}
        <strong>{room.code ? `Room ${room.code}` : "Local lobby"}</strong>
        {onJoinRoom && <button type="button" aria-haspopup="dialog" onClick={onJoinRoom} disabled={busy || !open}>Join Room</button>}
        {invite && (
          <button onClick={() => void copy()} disabled={!open || unavailable}>
            {copied ? "Invite copied" : "Copy invite"}
          </button>
        )}
        <button type="button" className="hangar-music" onClick={radio.toggleMuted} aria-pressed={!radio.muted}>
          Music {radio.muted ? "off" : "on"}
        </button>
      </div>
      <p className="hangar-connection" role="status">
        <span>{open ? (unavailable ? "Reconnecting to room…" : status) : "The host closed this room."}</span>
        {mode === "ranked" && open && Number.isFinite(searchStart) && (
          <span className="hangar-search-time" aria-label="Elapsed search time" aria-live="off">
            {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, "0")}
          </span>
        )}
      </p>
      {copied && <p role="status" className="hangar-copy-status">Invite copied. Send it to your friend so they can join this room.</p>}
      {mode === "arcade" && <p className="hangar-team-hint">2–4 pilots · Alternating join order assigns White and Orange teams. Friendly fire off. Only teammates see each other’s tags.</p>}
      <ul
        className="hangar-slots"
        style={{ "--slot-count": game.max } as React.CSSProperties}
        aria-label="Room pilots"
      >
        {Array.from({ length: game.max }, (_, i) => {
          // Keep your own drone in the center without changing the server's team order.
          const member = members[i];
          return (
            <li
              className={`hangar-slot ${member ? "" : "is-empty"} ${member?.player_id === player ? "is-self" : ""}`}
              key={member?.player_id ?? `empty-${i}`}
            >
              <div className="hangar-dock">
                {member ? <DronePreview compact={member.player_id !== player} color={member.player_id === player ? '#50ffd0' : '#81b9ff'} /> : <button className="hangar-add-friend" disabled={!open || unavailable || !canInvite} onClick={() => void copy()} aria-label="Invite friend to this slot">+</button>}
              </div>
              <div className="hangar-plaque">
                {member ? (
                  <>
                    <div
                      className={`hangar-pilot-name ${mode === "ranked" && member.player_id === player ? "has-ranked-progress" : ""}`}
                    >
                      {member.player_id === room.host_id && (
                        <Crown
                          className="hangar-host-crown"
                          role="img"
                          aria-label="Host"
                          size={18}
                          fill="currentColor"
                        />
                      )}
                      <strong title={member.display_name}>{member.display_name}{member.player_id === player ? " · You" : ""}{mode === "arcade" && <small className="hangar-team-label">{room.members.findIndex(m => m.player_id === member.player_id) % 2 === 0 ? "White team" : "Orange team"}</small>}</strong>
                      {mode === "ranked" && member.player_id === player && (
                        <RankedProgress player={player} compact ratingOnly />
                      )}
                    </div>
                    <button
                      className={`hangar-readiness ${member.ready ? "is-ready" : ""}`}
                      aria-label={
                        member.player_id === player
                          ? selfReady
                            ? "Cancel ready"
                            : "Ready up"
                          : `${member.display_name}: ${member.ready ? "Ready" : "Not ready"}`
                      }
                      aria-pressed={member.ready}
                      disabled={
                        member.player_id !== player ||
                        busy ||
                        !open ||
                        unavailable ||
                        !readinessAvailable ||
                        !connected ||
                        !game.playable
                      }
                      onClick={member.player_id === player ? onReady : undefined}
                    >
                      {member.ready ? "Ready" : "Not ready"}
                    </button>
                  </>
                ) : (
                  <>
                    <strong>{game.max === 1 ? "Solo mode" : "Open slot"}</strong>
                    <button
                      disabled={!open || unavailable || !canInvite}
                      onClick={() => void copy()}
                    >
                      {canInvite ? "+ Invite" : game.max === 1 ? "1 pilot" : "Unavailable"}
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <footer className="hangar-footer" aria-label="Room sharing and match controls">
        {invite && (
          <div className="hangar-invite">
            <figure className="hangar-invite-qr">
              <QRCodeSVG
                value={invite}
                size={144}
                level="M"
                marginSize={4}
                bgColor="#d5e9db"
                fgColor="#102421"
                title="Scan to join this room"
              />
              <figcaption>Scan to join on mobile</figcaption>
            </figure>
            <label>
              Invite link
              <input
                ref={inviteInput}
                readOnly
                value={invite}
                onFocus={(e) => e.currentTarget.select()}
              />
            </label>
          </div>
        )}
        <div className="hangar-actions">
          <button aria-label="Leave room" disabled={busy} onClick={onLeave}>
            ← Leave room
          </button>
          {mode !== "ranked" && <strong>
            {ready}/{room.members.length} pilots ready
          </strong>}
          {room.host_id === player || allowMemberStart ? (
            <button
              aria-label={game.playable ? startLabel : "Coming soon"}
              className="hangar-start"
              disabled={busy || !open || unavailable || !allReady || !connected || !game.playable}
              onClick={onStart}
            >
              {game.playable ? startLabel : "Coming soon"}
            </button>
          ) : (
            <span>Waiting for the host to start…</span>
          )}
          <span>
            {mode === "ranked"
              ? allReady
                ? "Ready to start"
                : "Ready up to start"
              : !game.playable
                ? "This game is coming soon."
                : !readinessAvailable && open
                  ? "Room readiness setup is pending."
                  : !open
                    ? "Room closed"
                    : room.members.length < game.min
                      ? "Invite another pilot to start."
                      : allReady
                        ? "All pilots ready"
                        : "Waiting for all pilots"}
          </span>
        </div>
      </footer>
      <GameChooser
        returnFocus={trigger}
        open={selecting}
        mode={mode}
        onClose={() => setSelecting(false)}
        onChoose={(key) => {
          setSelecting(false);
          if (key !== mode) onModeChange?.(key);
        }}
        disabled={(key) => busy || !open || unavailable ||
          (key !== mode && (!onModeChange || room.host_id !== player || room.members.length > lobbyModes[key].max))}
        hint={(key) => key === mode ? "Current game"
          : room.members.length > lobbyModes[key].max ? "Too many pilots"
          : !onModeChange ? "Leave this room to change games"
          : room.host_id !== player ? "Host chooses the game"
          : !lobbyModes[key].playable ? "Coming soon" : "Select game"}
      />
    </section>
  );
}
