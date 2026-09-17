import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { connection, type Lobby } from "@/lib/multiplayer";
import { TICK_MS } from "./config";
import { EMPTY_INPUT, type GameState, type PlayerInput } from "./types";
import {
  DuelHost,
  isDuelSnapshot,
  isPilotPacket,
  PEER_TIMEOUT_MS,
  type DuelSnapshot,
  type PilotPacket,
} from "./online";

export function useOnlineDuel(lobby: Lobby | null, player: string | undefined) {
  const inputRef = useRef<PlayerInput>({ ...EMPTY_INPUT });
  const latestLobby = useRef(lobby);
  latestLobby.current = lobby;
  const roomId = lobby?.id;
  const hostId = lobby?.host_id;
  const [view, setView] = useState<DuelSnapshot | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("Connecting to arena...");
  const [canStart, setCanStart] = useState(false);
  const [voted, setVoted] = useState(false);
  const [stalled, setStalled] = useState(false);
  const display = useRef<{ previous: GameState | null; current: GameState; at: number } | null>(
    null,
  );
  const actions = useRef({ start: () => {}, rematch: () => {}, reset: () => {} });

  useEffect(() => {
    setView(null);
    setVoted(false);
    setCanStart(false);
    setStalled(false);
    display.current = null;
    if (!roomId || !hostId || !player) return;
    let disposed = false;
    let channel: RealtimeChannel | undefined;
    let connected = false;
    let host: DuelHost | null = null;
    let current: DuelSnapshot | null = null;
    let remote: { packet: PilotPacket; at: number } | null = null;
    let vote = false;
    let returnFrom: string | null = null;
    let sequence = 0;
    let lastSnapshotAt = 0;
    let lastFrame = performance.now();
    let accumulated = 0;
    let lastSend = 0;
    let frame = 0;
    let duplicate = false;
    const instance = crypto.randomUUID();
    const isHost = hostId === player;
    const retiredMatches = new Set<string>();
    const snapshotSequences = new Map<string, number>();
    const active = () => !document.hidden;
    const opponentId = () =>
      latestLobby.current?.members.find((m) => m.player_id !== player)?.player_id;
    const send = (event: string, payload: unknown) => {
      // Never fall back to HTTP for simulation frames while disconnected.
      if (connected && channel)
        void channel.send({ type: "broadcast", event, payload }).catch(() => {});
    };
    const show = (snapshot: DuelSnapshot, now: number) => {
      if (current?.matchId !== snapshot.matchId) {
        returnFrom = null;
        vote = false;
        setVoted(false);
        inputRef.current = { ...EMPTY_INPUT };
        display.current = null;
      }
      current = snapshot;
      display.current = {
        previous: display.current?.current ?? null,
        current: snapshot.state,
        at: now,
      };
      setView(snapshot);
    };
    const reset = () => {
      if (current) {
        retiredMatches.add(current.matchId);
        returnFrom = current.matchId;
      }
      host = null;
      current = null;
      display.current = null;
      inputRef.current = { ...EMPTY_INPUT };
      vote = false;
      setVoted(false);
      setView(null);
      setStalled(false);
    };
    const readyToStart = (now: number) => {
      const room = latestLobby.current;
      return (
        !!room &&
        room.status === "open" &&
        room.members.length === 2 &&
        room.members.every((m) => m.is_ready) &&
        connected &&
        !duplicate &&
        active() &&
        !!remote &&
        remote.packet.playerId === opponentId() &&
        remote.packet.active &&
        now - remote.at < PEER_TIMEOUT_MS
      );
    };
    const start = () => {
      if (!isHost || !readyToStart(performance.now())) return;
      const room = latestLobby.current!;
      host = new DuelHost(
        crypto.randomUUID(),
        room.members.map((m) => ({
          id: m.player_id,
          name: m.team === 0 ? "GREEN" : "RED",
          team: m.team === 0 ? 0 : 1,
        })),
      );
      show(host.snapshot(), performance.now());
      send("state", { hostId: player, snapshot: current });
    };
    actions.current = {
      start,
      rematch: () => {
        if (current?.state.matchWinner !== null && current && !current.ended) {
          vote = true;
          setVoted(true);
        }
      },
      reset: () => {
        if (current) send("return", { playerId: player, matchId: current.matchId });
        reset();
      },
    };
    const clearInput = () => {
      inputRef.current = { ...EMPTY_INPUT };
    };
    const pilotPacket = (): PilotPacket => ({
      playerId: player,
      instance,
      sequence: ++sequence,
      active: active() && !duplicate,
      input: active() && !duplicate ? { ...inputRef.current } : { ...EMPTY_INPUT },
      matchId: current?.matchId ?? null,
      rematch: vote,
      returnFrom,
    });
    const visibility = () => {
      clearInput();
      const packet = pilotPacket();
      host?.receive(packet, performance.now());
      send("pilot", packet);
      if (host && document.hidden) {
        host.advance(performance.now(), false);
        send("state", { hostId: player, snapshot: host.snapshot() });
      }
    };
    window.addEventListener("blur", clearInput);
    document.addEventListener("visibilitychange", visibility);

    void connection()
      .then((db) => {
        if (disposed) return;
        // The unguessable room UUID is returned only to room members by the lobby RPC.
        // This is an unranked, peer-trusted prototype, not a ranked security boundary.
        channel = db.channel(`duel-v1:${roomId}`, {
          config: { broadcast: { self: false, ack: false }, presence: { key: player } },
        });
        channel.on("presence", { event: "sync" }, () => {
          const own = channel?.presenceState()[player] ?? [];
          duplicate = own.length > 1;
        });
        channel.on("broadcast", { event: "pilot" }, ({ payload }) => {
          if (!isPilotPacket(payload) || payload.playerId !== opponentId()) return;
          if (
            remote?.packet.instance === payload.instance &&
            remote.packet.sequence >= payload.sequence
          )
            return;
          // Repeat return-to-room intent through the heartbeat too, so losing the
          // one-off return message during a network interruption cannot strand a peer.
          if (current && payload.returnFrom === current.matchId) reset();
          remote = { packet: payload, at: performance.now() };
          host?.receive(payload, remote.at);
        });
        channel.on("broadcast", { event: "state" }, ({ payload }) => {
          if (isHost || payload?.hostId !== hostId) return;
          const snapshot = payload.snapshot;
          const ids = latestLobby.current?.members.map((m) => m.player_id) ?? [];
          if (!isDuelSnapshot(snapshot, ids) || retiredMatches.has(snapshot.matchId)) return;
          if (snapshot.sequence <= (snapshotSequences.get(snapshot.matchId) ?? -1)) return;
          if (current && current.matchId !== snapshot.matchId) retiredMatches.add(current.matchId);
          snapshotSequences.set(snapshot.matchId, snapshot.sequence);
          lastSnapshotAt = performance.now();
          show(snapshot, lastSnapshotAt);
        });
        channel.on("broadcast", { event: "return" }, ({ payload }) => {
          if (payload?.playerId === opponentId() && payload.matchId === current?.matchId) reset();
        });
        channel.subscribe((status) => {
          if (disposed) return;
          connected = status === "SUBSCRIBED";
          if (connected) void channel?.track({ instance });
          setConnectionStatus(
            connected ? "Waiting for the other player" : "Reconnecting to arena...",
          );
        });
      })
      .catch(() => {
        if (!disposed)
          setConnectionStatus("Arena connection failed. Close and reopen the room to retry.");
      });

    const loop = (now: number) => {
      if (disposed) return;
      frame = requestAnimationFrame(loop);
      const room = latestLobby.current;
      const validRoster =
        room?.status === "open" &&
        (!host || host.players.every((p) => room.members.some((m) => m.player_id === p.id)));
      if (host && !validRoster) host.ended = "A player left the room. This match has ended.";
      if (!isHost && current && room?.status !== "open") {
        if (!current.ended)
          show({ ...current, ended: "The host closed the room. This match has ended." }, now);
      }
      const elapsed = Math.min(now - lastFrame, 100);
      lastFrame = now;
      if (host) {
        host.receive(pilotPacket(), now);
        accumulated += elapsed;
        while (accumulated >= TICK_MS) {
          host.advance(now, connected && !duplicate);
          accumulated -= TICK_MS;
        }
        if (
          host.state.matchWinner !== null &&
          !host.ended &&
          !host.paused &&
          host.rematchVotes.length === 2
        )
          start();
      } else accumulated = 0;
      const interval = current ? 50 : 250;
      if (now - lastSend < interval) return;
      lastSend = now;
      send("pilot", pilotPacket());
      if (host) {
        const snapshot = host.snapshot();
        show(snapshot, now);
        send("state", { hostId: player, snapshot });
      }
      const remoteLive = !!remote && remote.packet.active && now - remote.at < PEER_TIMEOUT_MS;
      setCanStart(readyToStart(now));
      setConnectionStatus(
        duplicate
          ? "This room is open in another tab. Close the extra room tab to continue."
          : !connected
            ? "Reconnecting to arena..."
            : remoteLive
              ? "Both players connected"
              : "Waiting for the other player",
      );
      setStalled(
        duplicate || !connected || (!isHost && !!current && now - lastSnapshotAt > PEER_TIMEOUT_MS),
      );
    };
    frame = requestAnimationFrame(loop);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      clearInput();
      window.removeEventListener("blur", clearInput);
      document.removeEventListener("visibilitychange", visibility);
      if (channel) void connection().then((db) => db.removeChannel(channel!));
      actions.current = { start: () => {}, rematch: () => {}, reset: () => {} };
    };
  }, [roomId, hostId, player]);

  return {
    view,
    display,
    inputRef,
    connectionStatus,
    canStart,
    stalled,
    voted,
    start: () => actions.current.start(),
    rematch: () => actions.current.rematch(),
    reset: () => actions.current.reset(),
  };
}
