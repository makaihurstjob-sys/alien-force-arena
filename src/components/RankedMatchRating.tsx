import { useEffect, useState } from "react";
import { connection } from "@/lib/multiplayer";
import { rankAt } from "@/lib/ranked-rules";

type Rating = { rating_before: number; rating_after: number; outcome: string };
export default function RankedMatchRating({
  matchId,
  player,
}: {
  matchId: string;
  player: string;
}) {
  const [rating, setRating] = useState<Rating | null>(null);
  const [status, setStatus] = useState("Saving your Ranked result...");
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    setRating(null);
    const poll = async () => {
      try {
        const db = await connection();
        const { data, error } = await db
          .from("match_participants")
          .select("rating_before,rating_after,outcome")
          .eq("match_id", matchId)
          .eq("player_id", player)
          .maybeSingle();
        if (!active) return;
        if (error) throw error;
        if (data?.rating_after !== null && data?.rating_after !== undefined && data.outcome) {
          setRating(data as Rating);
          return;
        }
        setStatus("Waiting for the server to save your points...");
      } catch {
        if (active) setStatus("Unable to verify your points yet. Retrying...");
      }
      if (active) timer = setTimeout(poll, 1000);
    };
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [matchId, player]);
  if (!rating) return <p role="status">{status}</p>;
  const delta = rating.rating_after - rating.rating_before;
  const before = rankAt(rating.rating_before);
  const after = rankAt(rating.rating_after);
  return (
    <div aria-label="Ranked points earned" aria-live="polite">
      <p>
        <strong>
          {delta > 0 ? "+" : ""}
          {delta} points
        </strong>{" "}
        - {rating.rating_before} to {rating.rating_after}
      </p>
      <p style={{ color: after.color }}>
        <strong>{after.label}</strong>
      </p>
      {before.label !== after.label && (
        <p>
          {delta > 0 ? "Promoted" : "Rank changed"}: {before.label} to {after.label}
        </p>
      )}
      {delta === 0 && rating.outcome !== "draw" && <p>Your rating floor protected your points.</p>}
      {rating.outcome === "draw" && <p>Draw: your points stay unchanged.</p>}
    </div>
  );
}
