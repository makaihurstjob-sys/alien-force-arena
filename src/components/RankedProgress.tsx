import { useEffect, useState } from "react";
import { connection } from "@/lib/multiplayer";
import { rankAt } from "@/lib/ranked-rules";

type Record = { rating: number; peak: number; wins: number; losses: number; draws: number };
export default function RankedProgress({
  player,
  compact = false,
}: {
  player?: string | undefined;
  compact?: boolean;
}) {
  const [record, setRecord] = useState<Record | null>(null);
  const [status, setStatus] = useState("Loading rank...");
  useEffect(() => {
    let active = true;
    setRecord(null);
    void connection()
      .then(async (db) => {
        const { data: session } = await db.auth.getSession();
        const id = player ?? session.session?.user.id;
        if (
          !id ||
          !session.session?.user.identities?.some((identity) => identity.provider === "discord")
        ) {
          if (active) setStatus("Sign in with Discord to see your rank.");
          return;
        }
        const { data, error } = await db
          .from("ranked_players")
          .select("rating,peak,wins,losses,draws")
          .eq("player_id", id)
          .maybeSingle();
        if (!active) return;
        if (error) setStatus("Unable to load your rank. Reopen the lobby to retry.");
        else if (data) setRecord(data);
        else setStatus("Your first Ranked match starts at Cadet I, 0 points.");
      })
      .catch(() => {
        if (active) setStatus("Unable to load your rank.");
      });
    return () => {
      active = false;
    };
  }, [player]);
  if (!record)
    return (
      <span className={compact ? "hangar-rank-progress" : undefined} role="status">
        {status}
      </span>
    );
  const rank = rankAt(record.rating);
  return (
    <span
      className={compact ? "hangar-rank-progress" : undefined}
      aria-label="Your Ranked progress"
      style={{ color: rank.color }}
    >
      <strong>{rank.label}</strong> - {record.rating} points
      {!compact && (
        <>
          {" "}
          - {record.wins}W / {record.losses}L / {record.draws}D - Peak {record.peak}
        </>
      )}
    </span>
  );
}
