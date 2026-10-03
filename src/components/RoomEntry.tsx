import { useCallback, useEffect, useState } from "react";
import SharedRoom from "./SharedRoom";
import { connection } from "@/lib/multiplayer";
import { sharedRoomsAvailable } from "@/lib/game-lobby";
import BulletRun from "./BulletRun";
import MultiplayerLobby from "./MultiplayerLobby";
import LocalLobby from "./LocalLobby";
import type { LobbyMode } from "@/lib/lobby-modes";
import "./room-entry.css";

export default function RoomEntry({
  initialCode,
  initialMode = "solo",
  onBusyChange,
  onMatchChange,
  onLeave,
}: {
  initialCode?: string | undefined;
  initialMode?: LobbyMode | undefined;
  onLeave: () => void;
  onBusyChange: (busy: boolean) => void;
  onMatchChange: (playing: boolean) => void;
}) {
  const [entryCode, setEntryCode] = useState(initialCode);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [revision, setRevision] = useState(0);
  const matchChanged = useCallback(
    (value: boolean) => {
      setPlaying(value);
      onMatchChange(value);
    },
    [onMatchChange],
  );
  async function joinRoom() {
    if (joining) return;
    setJoining(true);
    setJoinError("");
    try {
      const db = await connection();
      const { data, error } = await db.rpc("game_lobby_join_room", {
        p_code: joinCode.trim().toUpperCase(),
      });
      if (error) throw error;
      setEntryCode(data.code);
      setRevision((value) => value + 1);
      setShowJoin(false);
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#room=${data.code}&mode=shared`,
      );
    } catch (cause) {
      setJoinError(cause instanceof Error ? cause.message : "Unable to join room.");
    } finally {
      setJoining(false);
    }
  }
  const [mode, setMode] = useState<LobbyMode>(initialMode);
  const [shared, setShared] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void sharedRoomsAvailable()
      .then((value) => {
        if (active) setShared(value);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Unable to connect.");
      });
    return () => {
      active = false;
    };
  }, []);
  if (shared === null) return <p role="status">{error || "Connecting to room service..."}</p>;
  if (shared)
    return (
      <section className="shared-room-entry">
        {!playing && (
          <div className="room-join-controls">
            <button disabled={joining} onClick={() => setShowJoin((value) => !value)}>
              Join Room
            </button>
            {showJoin && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void joinRoom();
                }}
              >
                <label htmlFor="hangar-join-code">Room code</label>
                <input
                  id="hangar-join-code"
                  value={joinCode}
                  maxLength={6}
                  minLength={6}
                  required
                  pattern="[A-Za-z0-9]{6}"
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                />
                <button disabled={joining}>{joining ? "Joining..." : "Join room"}</button>
                <p>Joining another room leaves this one. If you host it, this room will close.</p>
              </form>
            )}
            {joinError && <p role="alert">{joinError}</p>}
          </div>
        )}
        <SharedRoom
          key={revision}
          initialCode={entryCode}
          initialMode={initialMode}
          onLeave={onLeave}
          onBusyChange={onBusyChange}
          onMatchChange={matchChanged}
        />
      </section>
    );
  return (
    <section className="shared-room-entry">
      {mode === "bullet" ? (
        <BulletRun
          embedded
          autoEnter
          initialCode={initialCode}
          onBusyChange={onBusyChange}
          onLeave={onLeave}
        />
      ) : mode === "duel" ? (
        <MultiplayerLobby
          embedded
          entryMode={initialCode ? "join" : "create"}
          initialCode={initialCode}
          onBusyChange={onBusyChange}
          onMatchChange={onMatchChange}
          onLeave={onLeave}
        />
      ) : (
        <LocalLobby
          mode={mode}
          onModeChange={setMode}
          onLeave={onLeave}
          onBusyChange={onBusyChange}
          onMatchChange={onMatchChange}
        />
      )}
    </section>
  );
}
