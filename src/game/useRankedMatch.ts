import { randomId } from "@/lib/random-id";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { connection } from "@/lib/multiplayer";
import { EMPTY_INPUT, type GameState, type PlayerInput } from "./types";
import { isRankedSnapshot, type RankedPacket, type RankedSnapshot } from "./ranked-online";

export type RankedParticipant = { playerId: string; team: 0 | 1 };

const STALL_AFTER_MS = 3000;

/**
 * The client never simulates a ranked match: it only sends inputs and shows
 * whatever the trusted ranked-server process (scripts/ranked-server.ts)
 * broadcasts on `ranked:{matchId}`. There is no local host fallback, unlike
 * the unranked Classic duel.
 */
export function useRankedMatch(matchId: string | null, player: string | undefined) {
  const [forfeitPending, setForfeitPending] = useState(false);
  const [forfeitError, setForfeitError] = useState("");
  const forfeitInFlight = useRef(false);
  const requestForfeit = async () => {
    if (!matchId || forfeitInFlight.current) return;
    forfeitInFlight.current = true;
    setForfeitPending(true);
    setForfeitError("");
    try {
      const db = await connection();
      const { error } = await db.rpc("ranked_forfeit", { p_match_id: matchId });
      if (error) throw error;
    } catch {
      setForfeitError("Unable to forfeit. Please try again.");
      setForfeitPending(false);
      forfeitInFlight.current = false;
    }
  };
  const pauseRequested = useRef(false);
  const [localPaused, setLocalPaused] = useState(false);
  const requestPause = useCallback((paused: boolean) => {
    pauseRequested.current = paused;
    setLocalPaused(paused);
  }, []);
  const inputRef = useRef<PlayerInput>({ ...EMPTY_INPUT });
  const [view, setView] = useState<RankedSnapshot | null>(null);
  const [participants, setParticipants] = useState<RankedParticipant[] | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("Connecting to the match server...");
  const [stalled, setStalled] = useState(false);
  const [loadError, setLoadError] = useState("");
  const display = useRef<{ previous: GameState | null; current: GameState; at: number } | null>(
    null,
  );

  useEffect(() => {
    setForfeitPending(false);
    setForfeitError("");
    forfeitInFlight.current = false;
    setView(null);
    setParticipants(null);
    setStalled(false);
    setLoadError("");
    setConnectionStatus("Connecting to the match server...");
    display.current = null;
    pauseRequested.current = false;
    setLocalPaused(false);
    if (!matchId || !player) return;
    let disposed = false;
    let channel: RealtimeChannel | undefined;
    let connected = false;
    let current: RankedSnapshot | null = null;
    let lastSnapshotAt = 0;
    let lastSend = 0;
    let lastControls = "";
    let sequence = 0;
    let frame = 0;
    const instance = randomId();

    const send = (payload: RankedPacket) => {
      if (connected && channel)
        void channel.send({ type: "broadcast", event: "pilot", payload }).catch(() => {});
    };
    const pilotPacket = (): RankedPacket => ({
      playerId: player,
      instance,
      sequence: ++sequence,
      active: !document.hidden,
      paused: pauseRequested.current,
      input: !document.hidden ? { ...inputRef.current } : { ...EMPTY_INPUT },
      matchId,
    });
    const clearInput = () => {
      inputRef.current = { ...EMPTY_INPUT };
    };
    const visibility = () => {
      clearInput();
      send(pilotPacket());
    };
    window.addEventListener("blur", clearInput);
    document.addEventListener("visibilitychange", visibility);

    void connection()
      .then(async (db) => {
        if (disposed) return;
        const { data, error } = await db
          .from("match_participants")
          .select("player_id, team")
          .eq("match_id", matchId);
        if (disposed) return;
        if (error || !data || data.length !== 2) {
          setLoadError("Unable to load this match. Please return to matchmaking and try again.");
          return;
        }
        const ids = data.map((row) => row.player_id as string);
        setParticipants(
          data.map((row) => ({ playerId: row.player_id as string, team: row.team as 0 | 1 })),
        );
        channel = db.channel(`ranked:${matchId}`, {
          config: { broadcast: { self: false, ack: false } },
        });
        channel.on("broadcast", { event: "state" }, ({ payload }) => {
          if (!isRankedSnapshot(payload, ids) || payload.matchId !== matchId) return;
          if (current && payload.sequence <= current.sequence) return;
          const now = performance.now();
          display.current = {
            previous: display.current?.current ?? null,
            current: payload.state,
            at: now,
          };
          current = payload;
          lastSnapshotAt = now;
          setView(payload);
        });
        channel.subscribe((status) => {
          if (disposed) return;
          connected = status === "SUBSCRIBED";
          if (!connected)
            setConnectionStatus(
              status === "CHANNEL_ERROR" || status === "TIMED_OUT"
                ? "Lost the connection to the match server. Retrying..."
                : "Connecting to the match server...",
            );
        });
      })
      .catch(() => {
        if (!disposed)
          setLoadError(
            "Unable to reach the match server. Please return to matchmaking and try again.",
          );
      });

    const loop = (now: number) => {
      if (disposed) return;
      frame = requestAnimationFrame(loop);
      const controls = JSON.stringify([inputRef.current, pauseRequested.current, document.hidden]);
      if (connected && (controls !== lastControls || now - lastSend >= 250)) {
        lastSend = now;
        lastControls = controls;
        send(pilotPacket());
      }
      const waitingForFirstSnapshot = connected && !current;
      const stale = !!current && now - lastSnapshotAt > STALL_AFTER_MS;
      setStalled(stale);
      if (connected && current)
        setConnectionStatus(stale ? "Reconnecting to the match server..." : "Connected");
      else if (waitingForFirstSnapshot)
        setConnectionStatus("Waiting for the match server to start the game...");
    };
    frame = requestAnimationFrame(loop);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      clearInput();
      window.removeEventListener("blur", clearInput);
      document.removeEventListener("visibilitychange", visibility);
      if (channel) void connection().then((db) => db.removeChannel(channel!));
    };
  }, [matchId, player]);

  return {
    view,
    participants,
    display,
    inputRef,
    connectionStatus,
    stalled,
    loadError,
    localPaused,
    requestPause,
    requestForfeit,
    forfeitPending,
    forfeitError,
  };
}
