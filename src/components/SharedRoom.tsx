import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gameLobby, type GameLobby, type RoomAction } from "@/lib/game-lobby";
import { lobbyPlayerId } from "@/lib/multiplayer";
import { lobbyModes, type LobbyMode } from "@/lib/lobby-modes";
import { useOnlineDuel } from "@/game/useOnlineDuel";
import { useOnlinePowerDuel } from "@/game/classic/useOnlinePowerDuel";
import type { BulletLobby } from "@/lib/bullet-lobby";
import RankedQueue from "./RankedQueue";
import HangarLobby from "./HangarLobby";
import BulletRun from "./BulletRun";
import Classic from "./Classic";
import { Practice } from "@/routes/practice";
import { OnlineDuel } from "./OnlineDuel";
import { OnlineArcadeDuel } from "./OnlineArcadeDuel";

export default function SharedRoom({
  initialCode,
  initialMode,
  onLeave,
  onBusyChange,
  onMatchChange,
}: {
  initialCode?: string | undefined;
  initialMode: LobbyMode;
  onLeave: () => void;
  onBusyChange: (busy: boolean) => void;
  onMatchChange: (playing: boolean) => void;
}) {
  const [rankedPlaying, setRankedPlaying] = useState(false);
  const [rankedActive, setRankedActive] = useState(false);
  const [room, setRoom] = useState<GameLobby | null>(null);
  const [player, setPlayer] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const started = useRef(false);
  const epoch = useRef(0);
  const pending = useRef(false);
  const mounted = useRef(true);
  const current = useRef(room);
  current.current = room;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    onBusyChange(busy || !!room);
    return () => onBusyChange(false);
  }, [busy, !!room, onBusyChange]);
  const playing =
    !!room && room.mode !== "bullet" && room.phase === "playing" && room.status === "open";
  useEffect(() => {
    onMatchChange(playing || rankedPlaying);
    return () => onMatchChange(false);
  }, [playing, rankedPlaying, onMatchChange]);

  async function mutate(action: RoomAction, mode = current.current?.mode ?? initialMode) {
    if (pending.current) return;
    pending.current = true;
    epoch.current++;
    setBusy(true);
    setError("");
    try {
      let next = await gameLobby(action, current.current?.code ?? initialCode ?? "", mode);
      const id = await lobbyPlayerId();
      if (
        action === "create" &&
        next &&
        next.mode !== initialMode &&
        next.host_id === id &&
        next.phase === "lobby"
      ) {
        next = await gameLobby("mode", next.code, initialMode);
      }
      if (!mounted.current) return;
      if (action === "leave") {
        onLeave();
        return;
      }
      current.current = next;
      setRoom(next);
      setPlayer(id ?? "");
      setUnavailable(false);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "Unable to update the room.");
    } finally {
      pending.current = false;
      epoch.current++;
      if (mounted.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      void mutate(initialCode ? "join" : "create", initialMode);
    }
  }, []);
  useEffect(() => {
    if (!room || room.status !== "open") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      const version = epoch.current;
      try {
        const next = await gameLobby("get", room!.code);
        if (!cancelled && !pending.current && version === epoch.current) {
          current.current = next;
          setRoom(next);
          setUnavailable(false);
        }
      } catch {
        if (!cancelled) setUnavailable(true);
      }
      if (!cancelled) timer = setTimeout(poll, 1000);
    }
    timer = setTimeout(poll, 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [room?.id, room?.status]);

  // A distinct transport per approved match prevents packets from a previous mode
  // or round from being accepted after the room changes games.
  const duelRoom =
    room?.mode === "duel" && playing
      ? {
          ...room,
          id: `${room.id}:${room.match_id}`,
          members: room.members.map((member, team) => ({ ...member, team, is_ready: true })),
        }
      : null;
  const duel = useOnlineDuel(duelRoom, player);
  const arcadeRoom =
    room?.mode === "arcade" && playing
      ? {
          ...room,
          id: `${room.id}:${room.match_id}`,
          members: room.members.map((member, team) => ({ ...member, team, is_ready: true })),
        }
      : null;
  const arcadeDuel = useOnlinePowerDuel(arcadeRoom, player);
  const launched = useRef<string | null>(null);
  useEffect(() => {
    if (!playing) {
      launched.current = null;
      return;
    }
    if (
      room?.mode === "duel" &&
      room.host_id === player &&
      duel.canStart &&
      !duel.view &&
      launched.current !== room.match_id
    ) {
      launched.current = room.match_id ?? null;
      duel.start();
    }
    if (
      room?.mode === "arcade" &&
      room.host_id === player &&
      arcadeDuel.canStart &&
      !arcadeDuel.view &&
      launched.current !== room.match_id
    ) {
      launched.current = room.match_id ?? null;
      arcadeDuel.start();
    }
  }, [
    playing,
    room?.match_id,
    room?.mode,
    room?.host_id,
    player,
    duel.canStart,
    !!duel.view,
    arcadeDuel.canStart,
    !!arcadeDuel.view,
  ]);

  if (!room)
    return (
      <section className="bullet-lobby" aria-label="Connecting to lobby">
        <p role="status">{busy ? "Connecting to lobby..." : error}</p>
        {!busy && (
          <button onClick={() => void mutate(initialCode ? "join" : "create", initialMode)}>
            Try again
          </button>
        )}
        <button disabled={busy} onClick={onLeave}>
          Back to home
        </button>
      </section>
    );
  const leave = () => void mutate("leave");
  const changeMode = (mode: LobbyMode) => void mutate("mode", mode);
  const returnToRoom = () => void mutate("return");
  const updateBulletRoom = (next: BulletLobby | null) => {
    epoch.current++;
    const updated = next ? { ...next, mode: "bullet" as const } : null;
    current.current = updated;
    setRoom(updated);
  };
  const requestBullet: typeof gameLobby = async (action, code, mode) => {
    if (pending.current) throw new Error("Wait for the current room update.");
    pending.current = true;
    epoch.current++;
    try {
      return await gameLobby(action, code, mode);
    } finally {
      pending.current = false;
      epoch.current++;
    }
  };
  if (room.mode === "bullet")
    return (
      <>
        {error && <p role="alert">{error}</p>}
        <BulletRun
          embedded
          onLeave={onLeave}
          shared={{
            room,
            player,
            setRoom: updateBulletRoom,
            onModeChange: changeMode,
            busy,
            request: requestBullet,
          }}
        />
      </>
    );
  if (playing)
    return createPortal(
      <main className="online-match-screen">
        {error && <p role="alert">{error}</p>}
        {room.mode === "solo" ? (
          <Classic onReturn={returnToRoom} />
        ) : room.mode === "practice" ? (
          <Practice onReturn={returnToRoom} />
        ) : duel.view ? (
          <OnlineDuel
            duel={duel}
            player={player}
            busy={busy}
            onReturn={returnToRoom}
            onLeave={leave}
          />
        ) : arcadeDuel.view ? (
          <OnlineArcadeDuel
            duel={arcadeDuel}
            player={player}
            busy={busy}
            onReturn={returnToRoom}
            onLeave={leave}
          />
        ) : (
          <section>
            <p role="status">Connecting to the other pilot...</p>
            <button disabled={busy} onClick={returnToRoom}>
              Return to room
            </button>
            <button disabled={busy} onClick={leave}>
              Leave room
            </button>
          </section>
        )}
      </main>,
      document.body,
    );
  const mode = lobbyModes[room.mode];
  const selfReady = room.members.some((member) => member.player_id === player && member.ready);
  return (
    <>
      {error && <p role="alert">{error}</p>}
      {room.mode === "ranked" && room.status === "open" && (
        <RankedQueue onMatchChange={setRankedPlaying} onActivityChange={setRankedActive} />
      )}
      <HangarLobby
        room={room}
        mode={room.mode}
        player={player}
        busy={busy || rankedActive}
        connected={!unavailable}
        unavailable={unavailable}
        readinessAvailable
        selfReady={selfReady}
        allReady={
          room.members.length >= mode.min &&
          room.members.length <= mode.max &&
          room.members.every((member) => member.ready)
        }
        status={unavailable ? "Reconnecting to room..." : "Ready when you are"}
        invite={`${window.location.origin}${import.meta.env.BASE_URL}#room=${room.code}&mode=shared`}
        onLeave={leave}
        onModeChange={changeMode}
        onReady={() => void mutate(selfReady ? "unready" : "ready")}
        onStart={() => void mutate("launch")}
      />
    </>
  );
}
