import MatchHistory from "./MatchHistory";
import { useEffect, useState } from "react";
import { connection } from "@/lib/multiplayer";
import ClassicLeaderboard from "./ClassicLeaderboard";
import RankedRatings from "./RankedRatings";

export default function Career() {
  const [tab, setTab] = useState<"history" | "scores" | "ranked">("history");
  const [account, setAccount] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    setLoading(true); setError("");
    void connection().then(async db => {
      if (!active) return;
      const subscription = db.auth.onAuthStateChange((_event, session) => {
        if (active) setAccount(session?.user.id ?? null);
      });
      unsubscribe = () => subscription.data.subscription.unsubscribe();
      const { data, error } = await db.auth.getSession();
      if (error) throw error;
      if (active) setAccount(data.session?.user.id ?? null);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load your account."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; unsubscribe?.(); };
  }, [retry]);
  return <div className="career-content">
    <nav className="arena-record-tabs" aria-label="Career sections">
      <button aria-pressed={tab === "history"} onClick={() => setTab("history")}>Match history</button>
      <button aria-pressed={tab === "scores"} onClick={() => setTab("scores")}>Classic scores</button>
      <button aria-pressed={tab === "ranked"} onClick={() => setTab("ranked")}>Ranked ratings</button>
    </nav>
    {tab === "scores" ? <ClassicLeaderboard /> : tab === "ranked" ? <RankedRatings />
      : loading ? <p className="tracker-empty" role="status">Loading your career…</p>
      : error ? <div className="tracker-empty" role="alert"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>Try again</button></div>
      : <MatchHistory key={account ?? "guest"} account={account} />}
  </div>;
}
