import { useEffect, useState } from "react";
import { connection } from "@/lib/multiplayer";
import { ROUNDS_PREFERENCE_KEY } from "@/lib/ranked-matchmaking";
import {
  RankedQueueSession,
  rankedQueueAction,
  type QueueAction,
  type RankedQueueState,
} from "@/lib/ranked-queue";
import RankedMatchView from "./RankedMatchView";

export default function RankedQueue() {
  const [player, setPlayer] = useState<string | null>(null);
  const [authError, setAuthError] = useState("");
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void connection()
      .then((db) => {
        if (!active) return;
        const { data } = db.auth.onAuthStateChange((_event, session) => {
          if (active)
            setPlayer(
              session?.user.identities?.some((i) => i.provider === "discord")
                ? session.user.id
                : null,
            );
        });
        unsubscribe = () => data.subscription.unsubscribe();
      })
      .catch((error) => {
        if (active) setAuthError(error.message);
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);
  return player ? (
    <QueueControls key={player} player={player} />
  ) : (
    <section className="ranked-settings">
      <h4>Ranked matchmaking</h4>
      <p>{authError || "Sign in with Discord through your player profile to join Ranked."}</p>
    </section>
  );
}

function QueueControls({ player }: { player: string }) {
  const [state, setState] = useState<RankedQueueState>({ status: "idle" });
  const [rounds, setRounds] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [session, setSession] = useState<RankedQueueSession | null>(null);
  useEffect(() => {
    try {
      setRounds(localStorage.getItem(ROUNDS_PREFERENCE_KEY) === "true");
    } catch {
      /* Storage optional. */
    }
    let active = true;
    let initial = true;
    let timer: ReturnType<typeof setTimeout>;
    const queue = new RankedQueueSession(rankedQueueAction, setState);
    setSession(queue);
    const poll = async () => {
      try {
        await queue.action("poll");
        if (active) setError("");
      } catch (cause) {
        if (active)
          setError(cause instanceof Error ? cause.message : "Connection interrupted. Retrying…");
      } finally {
        if (active) {
          if (initial) {
            setBusy(false);
            initial = false;
          }
          timer = setTimeout(poll, 5000);
        }
      }
    };
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
      queue.stop();
    };
  }, []);
  async function act(action: QueueAction) {
    if (!session || busy) return;
    setBusy(true);
    setError("");
    try {
      await session.action(action, rounds);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to reach matchmaking. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (state.status === "matched") {
    return (
      <RankedMatchView
        matchId={state.match_id}
        player={player}
        onExit={() => {
          void session?.action("poll");
        }}
      />
    );
  }
  return (
    <section className="ranked-settings" aria-label="Ranked matchmaking">
      <h4>Ranked matchmaking</h4>
      <label>
        <input
          type="checkbox"
          checked={rounds}
          disabled={busy || state.status !== "idle"}
          onChange={(event) => {
            setRounds(event.target.checked);
            try {
              localStorage.setItem(ROUNDS_PREFERENCE_KEY, String(event.target.checked));
            } catch {
              /* Storage optional. */
            }
          }}
        />{" "}
        Rounds
      </label>
      <p>
        Prefer rounds, with stocks allowed after 10 seconds. Off chooses mostly stocks with
        occasional rounds.
      </p>
      <p role="status">
        {state.status === "waiting"
          ? "Searching for an opponent near your rank…"
          : "Ready to search."}
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="ranked-experiment-actions">
        {state.status === "idle" && (
          <button disabled={busy} onClick={() => void act("join")}>
            Find match
          </button>
        )}
        {state.status === "waiting" && (
          <button disabled={busy} onClick={() => void act("leave")}>
            Cancel search
          </button>
        )}
      </div>
    </section>
  );
}
