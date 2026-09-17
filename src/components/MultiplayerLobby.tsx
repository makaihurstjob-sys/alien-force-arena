import { createPortal } from "react-dom";
﻿import { useEffect, useRef, useState } from "react";
import { lobbyAction, lobbyPlayerId, multiplayerConfigured, type Lobby } from "@/lib/multiplayer";
import { useOnlineDuel } from "@/game/useOnlineDuel";
import { OnlineDuel } from "./OnlineDuel";

export default function MultiplayerLobby({
  entryMode,
  initialCode,
  onBusyChange,
  onMatchChange,
}: {
  entryMode?: "create" | "join";
  initialCode?: string | undefined;
  onBusyChange?: (busy: boolean) => void;
  onMatchChange?: (playing: boolean) => void;
} = {}) {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [code, setCode] = useState(
    () => initialCode ?? sessionStorage.getItem("alien-force-room") ?? "",
  );
  const [player, setPlayer] = useState<string>();
  const duel = useOnlineDuel(lobby, player);
  const wasPlaying = useRef(false);
  useEffect(() => {
    const playing = !!duel.view;
    onMatchChange?.(playing);
    if (wasPlaying.current && !playing && lobby?.status === "open") {
      inFlight.current = true;
      setBusy(true);
      onBusyChange?.(true);
      void lobbyAction("ready", lobby.code, false).then(next => {
        if (mounted.current) setLobby(next);
      }).catch(e => {
        if (mounted.current) setError(e instanceof Error ? e.message : "Unable to reset readiness.");
      }).finally(() => {
        inFlight.current = false;
        onBusyChange?.(false);
        if (mounted.current) setBusy(false);
      });
    }
    wasPlaying.current = playing;
  }, [!!duel.view]);
  const [busy, setBusy] = useState(entryMode === "create");
  const started = useRef(false);
  const inFlight = useRef(false);
  const [copiedButton, setCopiedButton] = useState<"copy" | "share" | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [shareStatus, setShareStatus] = useState("");
  const [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(copiedTimer.current);
    };
  }, []);
  async function run(action: "create" | "join" | "ready" | "leave") {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    try {
      const next = await lobbyAction(
        action,
        lobby?.code ?? code,
        !lobby?.members.find((m) => m.player_id === player)?.is_ready,
      );
      sessionStorage.setItem("alien-force-room", next?.code ?? "");
      const id = await lobbyPlayerId();
      if (mounted.current) {
        if (action === "leave") duel.reset();
        setLobby(next);
        setCode(next?.code ?? "");
        setPlayer(id);
      }
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Unable to connect. Try again.");
    } finally {
      inFlight.current = false;
      onBusyChange?.(false);
      if (mounted.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (entryMode === "create" && !started.current) {
      started.current = true;
      void run("create");
    }
  }, [entryMode]);
  const roomLink = lobby ? `${window.location.origin}${import.meta.env.BASE_URL}#room=${encodeURIComponent(lobby.code)}` : "";
  async function shareRoom(copyOnly = false) {
    setShareStatus("");
    setCopiedButton(null);
    clearTimeout(copiedTimer.current);
    try {
      if (!copyOnly && navigator.share)
        await navigator.share({ title: "Join my Alien Force room", url: roomLink });
      else {
        await navigator.clipboard.writeText(roomLink);
        if (!mounted.current) return;
        setCopiedButton(copyOnly ? "copy" : "share");
        copiedTimer.current = setTimeout(() => setCopiedButton(null), 2200);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setShareStatus("Select and copy the room link below.");
    }
  }
  useEffect(() => {
    if (!lobby || busy) return;
    let cancelled = false;
    // Lobby-only polling. Simulation frames will use a separate game transport.
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const next = await lobbyAction("get", lobby!.code);
        if (!cancelled) {
          setLobby(next);
          setError("");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Connection interrupted.");
      }
      if (!cancelled) timer = setTimeout(refresh, 2000);
    }
    timer = setTimeout(refresh, 2000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [lobby?.code, busy]);
  if (duel.view && player) return createPortal(<main className="online-match-screen" aria-label="Online game screen">
    {error && <p role="alert">{error}</p>}
    <OnlineDuel duel={duel} player={player} busy={busy}
      onReturn={duel.reset} onLeave={() => void run("leave")} />
  </main>, document.body);
  return (
    <div className="classic-lobby">
      <p>Private 1v1 room · Unranked</p>
      {!multiplayerConfigured && <p role="status">Online rooms are not connected yet.</p>}
      {error && <p role="alert">{error}</p>}
      {busy && !lobby ? (
        <div className="room-loading" role="status">
          <span className="room-loading-ring" aria-hidden="true" />
          <span>{entryMode === "create" ? "Creating your room..." : "Joining room..."}</span>
        </div>
      ) : !lobby ? (
        <>
          {entryMode !== "join" && (
            <button disabled={busy || !multiplayerConfigured} onClick={() => void run("create")}>
              {entryMode === "create" ? "Try again" : "Create room"}
            </button>
          )}
          {entryMode !== "create" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run("join");
              }}
            >
              <label htmlFor="room-code">Room code</label>
              <input
                id="room-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                minLength={6}
                pattern="[A-Za-z0-9]{6}"
                required
                autoComplete="off"
              />
              <button disabled={busy || !multiplayerConfigured}>Join room</button>
            </form>
          )}
        </>
      ) : (
        <>
          <p>
            Room code: <strong>{lobby.code}</strong>
          </p>
          {lobby.status === "open" && (
            <div className="room-sharing">
              <label htmlFor="share-room-link">Room link</label>
              <input
                id="share-room-link"
                readOnly
                value={roomLink}
                onFocus={(event) => event.currentTarget.select()}
              />
              <div>
                {(["share", "copy"] as const).map((action) => (
                  <button
                    key={action}
                    className={`room-copy-button ${copiedButton === action ? "is-copied" : ""}`}
                    aria-label={copiedButton === action ? "Link copied" : action === "copy" ? "Copy link" : "Share room"}
                    onClick={() => void shareRoom(action === "copy")}
                  >
                    <span className="room-copy-label">{action === "copy" ? "Copy link" : "Share room"}</span>
                    {copiedButton === action && <svg className="room-copy-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l4 4L19 6" /></svg>}
                  </button>
                ))}
              </div>
              {shareStatus && <p role="status">{shareStatus}</p>}
            </div>
          )}
          <p role="status">
            {lobby.status === "closed"
              ? "The host closed this room."
              : `${lobby.members.length}/2 players`}
          </p>
          <ul>
            {lobby.members.map((m) => (
              <li key={m.player_id}>
                {m.display_name}
                {m.player_id === player ? " (you)" : ""} · {m.is_ready ? "Ready" : "Not ready"}
              </li>
            ))}
          </ul>
          <button disabled={busy || lobby.status !== "open"} onClick={() => void run("ready")}>
            {lobby.members.find((m) => m.player_id === player)?.is_ready ? "Not ready" : "Ready"}
          </button>
          <button disabled={busy} onClick={() => void run("leave")}>
            Leave room
          </button>
          {lobby.status === "open" && <>
            <p role="status">{duel.connectionStatus}</p>
            {player === lobby.host_id ? <button disabled={busy || !duel.canStart} onClick={duel.start}>
              Start match
            </button> : <p>Both players ready up, then the host starts the match.</p>}
          </>}
        </>
      )}
      <p className="classic-lobby-note">
        First to 3 rounds. One hit wins a round. One shot in flight at a time.
      </p>
    </div>
  );
}
