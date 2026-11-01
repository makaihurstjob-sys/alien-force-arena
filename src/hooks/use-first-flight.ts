import { useEffect, useRef, useState } from "react";
import { connection } from "@/lib/multiplayer";
import { getAccountHistory, readDeviceHistory } from "@/lib/match-history";
import { completeTraining, trainingComplete } from "@/lib/training-progress";
export function useFirstFlight(enabled: boolean) {
  const [status, setStatus] = useState<"checking" | "required" | "ready">("checking");
  const owner = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const decide = async () => {
      let id: string | null = null;
      try {
        const db = await connection();
        const { data } = await db.auth.getSession();
        id = data.session?.user.id ?? null;
      } catch {
        /* First-time offline guests can still learn. */
      }
      owner.current = id;
      if (trainingComplete(id) || trainingComplete(null) || readDeviceHistory(id).length > 0) {
        if (!cancelled) setStatus("ready");
        return;
      }
      try {
        const pending = JSON.parse(localStorage.getItem("alien-force-pending-classic-v1") ?? "[]");
        if (
          Array.isArray(pending) &&
          pending.some((row) => row && row.player_id === id && row.duration_ms > 0)
        ) {
          if (!cancelled) setStatus("ready");
          return;
        }
      } catch {
        // Missing or blocked local storage leaves the history checks below available.
      }
      if (id) {
        try {
          const saved = await getAccountHistory(id, 1);
          // An unavailable history service is not proof that an existing pilot is new.
          if (saved.rows.length || saved.warnings.length) {
            if (!cancelled) setStatus("ready");
            return;
          }
        } catch {
          if (!cancelled) setStatus("ready");
          return;
        }
      }
      if (!cancelled) setStatus("required");
    };
    void decide();
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return {
    status,
    finish: () => {
      completeTraining(owner.current);
      setStatus("ready");
    },
  };
}
