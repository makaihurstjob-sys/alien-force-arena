import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { connection } from "@/lib/multiplayer";
import RankBadge from "./RankBadge";
import { ranks } from "@/lib/ranks";
import { rankAt } from "@/lib/ranked-rules";

type Record = { rating: number; peak: number; wins: number; losses: number; draws: number };
export default function RankedProgress({
  player,
  compact = false,
  ratingOnly = false,
  showcase = false,
  preview = "pilot",
}: {
  player?: string | undefined;
  compact?: boolean;
  ratingOnly?: boolean;
  showcase?: boolean;
  preview?: string;
}) {
  const [record, setRecord] = useState<Record | null>(null);
  const [status, setStatus] = useState("Loading rank...");
  useEffect(() => {
    let active = true;
    let request = 0;
    let unsubscribe: (() => void) | undefined;
    setRecord(null);
    setStatus("Loading rank...");
    void connection().then(async db => {
      if (!active) return;
      const load = async (user: User | null) => {
        if (!active) return;
        const current = ++request;
        setRecord(null);
        setStatus("Loading rank...");
        const id = player ?? user?.id;
        if (!id || !user?.identities?.some(identity => identity.provider === "discord")) {
          setStatus("Sign in with Discord to see your rank.");
          return;
        }
        try {
          const { data, error } = await db.from("ranked_players").select("rating,peak,wins,losses,draws").eq("player_id", id).maybeSingle();
          if (!active || current !== request) return;
          if (error) throw error;
          setRecord(data ?? { rating: 0, peak: 0, wins: 0, losses: 0, draws: 0 });
        } catch {
          if (active && current === request) setStatus("Unable to load your rank. Reopen Career to retry.");
        }
      };
      const subscription = db.auth.onAuthStateChange((_event, session) => {
        // Query outside the auth callback so Supabase can release its auth lock.
        setTimeout(() => { void load(session?.user ?? null); }, 0);
      });
      unsubscribe = () => subscription.data.subscription.unsubscribe();
      const { data, error } = await db.auth.getSession();
      if (error) throw error;
      await load(data.session?.user ?? null);
    }).catch(() => { if (active) setStatus("Unable to load your rank."); });
    return () => { active = false; ++request; unsubscribe?.(); };
  }, [player]);
  if (showcase) {
    const rank = record ? rankAt(record.rating) : ranks.find(rank => rank.id === preview) ?? ranks[2];
    return <section className="ranked-showcase" aria-label="Your Ranked progress">
      <span className="ranked-showcase-eyebrow">{record ? "YOUR CURRENT RANK" : "RANK BADGE PREVIEW"}</span>
      <RankBadge id={rank.id} name={rank.name} className="rank-badge-large" />
      <h4 style={{ color: rank.color }}>{record ? rankAt(record.rating).label : rank.name}</h4>
      {record ? <>
        <p className="ranked-showcase-points">{record.rating} rating points</p>
        <div className="ranked-division-progress" role="progressbar" aria-label="Division progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rankAt(record.rating).progress}><span style={{ width: `${rankAt(record.rating).progress}%`, background: rank.color }} /></div>
        <p>{rankAt(record.rating).progress} / 100 division points</p>
        <div className="ranked-showcase-stats"><span>{record.wins} wins</span><span>{record.losses} losses</span><span>{record.draws} draws</span><span>Peak {record.peak}</span></div>
      </> : <p role="status">{status}</p>}
    </section>;
  }
  if (!record)
    return (
      <span className={compact ? "hangar-rank-progress" : undefined} role="status">
        {ratingOnly ? <span aria-label={status} title={status}>?</span> : status}
      </span>
    );
  const rank = rankAt(record.rating);
  return (
    <span
      className={compact ? "hangar-rank-progress" : undefined}
      aria-label="Your Ranked progress"
      style={{ color: rank.color }}
    >
      <RankBadge id={rank.id} name={rank.name} className="rank-badge-small" />
      {ratingOnly ? (
        <span aria-label={`${record.rating} rating points`}>{record.rating}</span>
      ) : (<> <strong>{rank.label}</strong> - {record.rating} points</>)}
      {!compact && (
        <>
          {" "}
          - {record.wins}W / {record.losses}L / {record.draws}D - Peak {record.peak}
        </>
      )}
    </span>
  );
}
