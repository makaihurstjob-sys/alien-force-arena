import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { ClassicState } from "./classic/engine";
import { classicPlayer, snapshotRun, submitClassicRun, type RunOutcome, type RunSubmission } from "@/lib/classic-records";

const storageKey = "alien-force-pending-classic-v1";
function readPending(): RunSubmission[] {
  try { return JSON.parse(localStorage.getItem(storageKey) ?? "[]") as RunSubmission[]; }
  catch { return []; }
}
function remember(run: RunSubmission) {
  try {
    const runs = readPending().filter(item => item.id !== run.id);
    localStorage.setItem(storageKey, JSON.stringify([...runs, run]));
  } catch { /* The in-memory queue remains usable when storage is unavailable. */ }
}
function forget(id: string) {
  try { localStorage.setItem(storageKey, JSON.stringify(readPending().filter(run => run.id !== id))); }
  catch { /* A duplicate retry is harmless: inserts are idempotent. */ }
}
export function useClassicRecords(game: RefObject<ClassicState>) {
  const identity = useRef<Promise<string> | null>(null);
  const processed = useRef(new WeakSet<ClassicState>());
  const pending = useRef(new Map<string, RunSubmission>());
  const waiting = useRef(new Map<string, { state: ClassicState; outcome: RunOutcome }>());
  const flushing = useRef(false);
  const mounted = useRef(false);
  const [message, setMessage] = useState("Completed Classic runs and gameplay stats are public.");
  const [failed, setFailed] = useState(false);
  const [playerId, setPlayerId] = useState<string>();
  const player = useCallback(() => {
    if (!identity.current) identity.current = classicPlayer().catch(error => { identity.current = null; throw error; });
    return identity.current;
  }, []);
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      const id = await player();
      for (const [key, item] of waiting.current) {
        const run = snapshotRun(item.state, item.outcome, id, key);
        pending.current.set(key, run); remember(run); waiting.current.delete(key);
      }
      for (const run of readPending()) if (run.player_id === id) pending.current.set(run.id, run);
      if (!pending.current.size) return;
      if (mounted.current) { setMessage("Saving Classic history…"); setFailed(false); }
      for (const [key, run] of pending.current) {
        await submitClassicRun(run);
        pending.current.delete(key); forget(key);
      }
      if (mounted.current) setMessage("Classic history saved to your public player card.");
    } catch (error) {
      if (mounted.current) {
        setFailed(true);
        setMessage(`History not saved yet. ${error instanceof Error ? error.message : "Please retry."}`);
      }
    } finally { flushing.current = false; }
  }, [player]);
  const finish = useCallback(async (outcome: RunOutcome) => {
    const state = game.current;
    if (!state || state.elapsed <= 0 || processed.current.has(state)) return;
    processed.current.add(state);
    // Freeze the run before awaiting authentication; a restart replaces game.current.
    const id = crypto.randomUUID();
    waiting.current.set(id, { state: { ...state }, outcome });
    await flush();
  }, [game, player, flush]);
  useEffect(() => {
    mounted.current = true;
    void player().then(id => { if (mounted.current) setPlayerId(id); }).catch(() => {});
    void flush();
    const timer = window.setInterval(() => {
      if (game.current?.phase === "game_over") void finish("game_over");
    }, 250);
    const online = () => { void flush(); };
    window.addEventListener("online", online);
    return () => { mounted.current = false; clearInterval(timer); window.removeEventListener("online", online); };
  }, [game, finish, flush, player]);
  return { finish, message, failed, playerId, retry: () => { void flush(); } };
}
