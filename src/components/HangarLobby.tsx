import { useEffect, useRef, useState } from "react";
import { Crown } from "lucide-react";
import { DesktopArena } from "./DesktopArena";
import { ShipIcon } from "./ShipIcon";
import type { BulletLobby } from "@/lib/bullet-lobby";
import "./hangar-lobby.css";
import { lobbyModes, type LobbyMode } from "@/lib/lobby-modes";

export function visibleHangarSlots(players: number) {
  return Math.max(4, Math.min(6, players + 1), players);
}

export default function HangarLobby({
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
  startLabel = "Start match",
  allowMemberStart = false,
}: {
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
  const selector = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState("");
  const [selecting, setSelecting] = useState(false);
  useEffect(() => {
    if (selecting) selector.current?.showModal();
    else selector.current?.close();
  }, [selecting]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied("Invite copied");
    } catch {
      setCopied("Copy the invite link below.");
    }
  };
  const game = lobbyModes[mode];
  const canInvite = !!invite && room.members.length < game.max;
  const open = room.status === "open";
  const ready = room.members.filter((m) => m.ready).length;
  return (
    <section className="hangar-lobby" aria-label={`${game.name} lobby`}>
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
        <span>
          {room.members.length}/{game.max} pilots
        </span>
        <strong>{room.code ? `Room ${room.code}` : "Local lobby"}</strong>
        {invite && (
          <button onClick={() => void copy()} disabled={!open || unavailable}>
            Copy invite
          </button>
        )}
      </div>
      <p className="hangar-connection" role="status">
        {open ? (unavailable ? "Reconnecting to room…" : status) : "The host closed this room."}
      </p>
      <ul
        className="hangar-slots"
        style={{ "--slot-count": visibleHangarSlots(room.members.length) } as React.CSSProperties}
        aria-label="Room pilots"
      >
        {Array.from({ length: visibleHangarSlots(room.members.length) }, (_, i) => {
          const member = room.members[i];
          return (
            <li
              className={`hangar-slot ${member ? "" : "is-empty"}`}
              key={member?.player_id ?? `empty-${i}`}
            >
              <div className="hangar-dock">
                <div style={{ filter: `hue-rotate(${i * 65}deg)` }}>
                  <ShipIcon size={96} />
                </div>
                {!member && (
                  <span className="hangar-plus" aria-hidden="true">
                    +
                  </span>
                )}
              </div>
              <div className="hangar-plaque">
                {member ? (
                  <>
                    <div className="hangar-pilot-name">
                      {member.player_id === room.host_id && (
                        <Crown
                          className="hangar-host-crown"
                          role="img"
                          aria-label="Host"
                          size={18}
                          fill="currentColor"
                        />
                      )}
                      <strong title={member.display_name}>{member.display_name}</strong>
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
      {copied && (
        <div className="hangar-invite">
          <p role="status">{copied}</p>
          <label>
            Invite link
            <input readOnly value={invite} onFocus={(e) => e.currentTarget.select()} />
          </label>
        </div>
      )}
      <div className="hangar-actions">
        <button aria-label="Leave room" disabled={busy} onClick={onLeave}>
          ← Leave room
        </button>
        <strong>
          {ready}/{room.members.length} pilots ready
        </strong>
        {room.host_id === player || allowMemberStart ? (
          <button
            aria-label={game.playable ? startLabel : "Coming soon"}
            className="hangar-start"
            disabled={busy || !open || unavailable || !allReady || !connected || !game.playable}
            onClick={onStart}
          >
            {game.playable ? "▶ Start match" : "Coming soon"}
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
      <dialog
        ref={selector}
        className="hangar-selector"
        aria-labelledby="hangar-selector-title"
        onCancel={() => setSelecting(false)}
        onClose={() => {
          setSelecting(false);
          trigger.current?.focus();
        }}
      >
        <header>
          <h2 id="hangar-selector-title">Choose game</h2>
          <button aria-label="Close game selector" onClick={() => setSelecting(false)}>
            ×
          </button>
        </header>
        <div className="hangar-game-cards">
          {(Object.entries(lobbyModes) as [LobbyMode, (typeof lobbyModes)[LobbyMode]][]).map(
            ([key, item]) => (
              <button
                key={key}
                disabled={
                  busy ||
                  !open ||
                  unavailable ||
                  (key !== mode &&
                    (!onModeChange || room.host_id !== player || room.members.length > item.max))
                }
                aria-pressed={key === mode}
                onClick={() => {
                  setSelecting(false);
                  if (key !== mode) onModeChange?.(key);
                }}
              >
                <div className="hangar-thumbnail">
                  <DesktopArena
                    mode={key === "arcade" ? 1 : key === "practice" ? 2 : 0}
                    thumbnail
                  />
                </div>
                <strong>{item.name}</strong>
                <span>
                  {item.description} · {item.max} {item.max === 1 ? "pilot" : "pilots"}
                </span>
                <small>
                  {key === mode
                    ? "Current game"
                    : room.members.length > item.max
                      ? "Too many pilots"
                      : !onModeChange
                        ? "Leave this room to change games"
                        : room.host_id !== player
                          ? "Host chooses the game"
                          : !item.playable
                            ? "Coming soon"
                            : "Select game"}
                </small>
              </button>
            ),
          )}
        </div>
        <p>Choose a game or close to return to your lobby.</p>
      </dialog>
    </section>
  );
}
