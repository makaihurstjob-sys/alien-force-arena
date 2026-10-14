import { useEffect, useRef } from "react";
import { connection } from "@/lib/multiplayer";
import { saveDeviceHistory, type HistorySnapshot } from "@/lib/match-history";
export function useMatchHistory(read: () => HistorySnapshot | null, player?: string) {
  const readRef = useRef(read); readRef.current = read;
  useEffect(() => {
    let active = true;
    let owner: string | null = player ?? null;
    let ready = !!player;
    let latest: HistorySnapshot | null = null;
    let lastCheckpoint = 0;
    const finished = new Set<string>();
    if (!ready) void connection().then(db => db.auth.getSession()).then(({data}) => { if (active) { owner = data.session?.user.id ?? null; ready = true; } }).catch(() => { ready = true; });
    const save = (snapshot: HistorySnapshot) => {
      try { saveDeviceHistory(snapshot,owner); } catch { /* Full or disabled storage cannot stop gameplay. */ }
    };
    const collect = (closing = false) => {
      if (!ready) return;
      const snapshot = readRef.current();
      if (latest && snapshot?.id !== latest.id) {
        save({ ...latest, outcome: latest.outcome === "interrupted" ? snapshot ? "restarted" : "left" : latest.outcome });
        latest = null;
        lastCheckpoint = 0;
      }
      if (!snapshot || snapshot.durationMs <= 0) return;
      latest = snapshot;
      if (finished.has(snapshot.id)) return;
      if (closing || snapshot.outcome !== "interrupted" || Date.now() - lastCheckpoint >= 5000) {
        save({ ...snapshot, outcome: closing && snapshot.outcome === "interrupted" ? "left" : snapshot.outcome });
        lastCheckpoint = Date.now();
        if (snapshot.outcome !== "interrupted") finished.add(snapshot.id);
      }
    };
    const timer = window.setInterval(() => collect(),250);
    const close = () => collect(true);
    window.addEventListener("pagehide",close);
    return () => { collect(true); active = false; clearInterval(timer); window.removeEventListener("pagehide",close); };
  }, [player]);
}
