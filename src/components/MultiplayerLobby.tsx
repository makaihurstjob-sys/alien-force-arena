import { useEffect, useRef, useState } from "react";
import { lobbyAction, lobbyPlayerId, multiplayerConfigured, type Lobby } from "@/lib/multiplayer";

export default function MultiplayerLobby() {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [code, setCode] = useState(() => sessionStorage.getItem("alien-force-room") ?? "");
  const [player, setPlayer] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function run(action: "create" | "join" | "ready" | "leave") {
    setBusy(true);
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
        setLobby(next);
        setCode(next?.code ?? "");
        setPlayer(id);
      }
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Unable to connect. Try again.");
    } finally {
      if (mounted.current) setBusy(false);
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
  return (
    <div className="classic-lobby">
      <p>Private 1v1 room · Unranked</p>
      {!multiplayerConfigured && <p role="status">Online rooms are not connected yet.</p>}
      {error && <p role="alert">{error}</p>}
      {!lobby ? (
        <>
          <button disabled={busy || !multiplayerConfigured} onClick={() => void run("create")}>
            Create room
          </button>
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
        </>
      ) : (
        <>
          <p>
            Room code: <strong>{lobby.code}</strong>
          </p>
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
        </>
      )}
      <p className="classic-lobby-note">
        Room setup preview. Online matches and ranked play are coming next.
      </p>
    </div>
  );
}
