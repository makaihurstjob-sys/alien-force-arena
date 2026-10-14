import { randomId } from "./random-id";
import { connection } from "./multiplayer";
import type { ClassicRun } from "./classic-records";
import type { GameState } from "@/game/types";
export const historyModes = { classic: "Classic", versus: "Versus", ranked: "Ranked", arcade: "Arcade", "arcade-practice": "Arcade Practice", bullet: "Bullet Run", practice: "Practice" } as const;
export type HistoryMode = keyof typeof historyModes;
export type HistoryOutcome = "win" | "loss" | "draw" | "completed" | "restarted" | "left" | "interrupted" | "disconnect";
export type HistoryRecord = {
  id: string; owner: string | null; mode: HistoryMode; recordedAt: string;
  outcome: HistoryOutcome; durationMs: number; source: "account" | "device";
  score?: number | undefined; opponentScore?: number | undefined; opponent?: string | undefined;
  shots?: number | undefined; hits?: number | undefined; level?: number | undefined;
  kills?: number | undefined; deaths?: number | undefined; ratingBefore?: number | undefined; ratingAfter?: number | undefined;
  details?: { label: string; value: string | number }[] | undefined;
};
export type HistorySnapshot = Omit<HistoryRecord, "owner" | "recordedAt" | "source">;
export const historyStorageKey = "alien-force-match-history-v1";
const objectIds = new WeakMap<object, string>();
export function gameHistoryId(state: object) {
  let id = objectIds.get(state); if (!id) { id = randomId(); objectIds.set(state, id); } return id;
}
export function readDeviceHistory(owner: string | null): HistoryRecord[] {
  try {
    const rows: unknown = JSON.parse(localStorage.getItem(historyStorageKey) ?? "[]");
    if (!Array.isArray(rows)) return [];
    return rows.filter((row): row is HistoryRecord => !!row && typeof row.id === "string" && row.owner === owner && typeof row.mode === "string" && Object.hasOwn(historyModes,row.mode) && typeof row.recordedAt === "string" && Number.isFinite(Date.parse(row.recordedAt)) && Number.isFinite(row.durationMs) && row.durationMs >= 0 && ["win", "loss", "draw", "completed", "restarted", "left", "interrupted", "disconnect"].includes(row.outcome));
  } catch { return []; }
}
export function saveDeviceHistory(snapshot: HistorySnapshot, owner: string | null) {
  let rows: HistoryRecord[];
  try { const saved: unknown = JSON.parse(localStorage.getItem(historyStorageKey) ?? "[]"); rows = Array.isArray(saved) ? saved : []; } catch { rows = []; }
  const previous = rows.find(row => row?.id === snapshot.id && row.owner === owner);
  // A teardown or late checkpoint must never replace a finished match result.
  if (previous && ["win", "loss", "draw", "completed"].includes(previous.outcome) && ["left", "restarted", "interrupted"].includes(snapshot.outcome)) return;
  const record: HistoryRecord = { ...snapshot, owner, recordedAt: previous && ["win", "loss", "draw", "completed", "disconnect"].includes(previous.outcome) ? previous.recordedAt : new Date().toISOString(), source: "device" };
  rows = rows.filter(row => row?.id !== snapshot.id || row.owner !== owner);
  localStorage.setItem(historyStorageKey, JSON.stringify([record, ...rows].slice(0, 500)));
  window.dispatchEvent(new Event("alien-force-history"));
}
export function duelHistory(state: GameState, mode: HistoryMode, player: string, id = gameHistoryId(state), ended = false): HistorySnapshot | null {
  const you = state.ships.find(ship => ship.id === player); if (!you) return null;
  const opponent = state.ships.find(ship => ship.id !== player);
  return { id, mode, outcome: state.matchWinner === null ? ended ? "left" : "interrupted" : state.matchWinner === you.team ? "win" : "loss",
    durationMs: Math.round(state.tick * 1000 / 60), score: state.score[you.team], opponentScore: state.score[you.team === 0 ? 1 : 0],
    opponent: opponent?.name, shots: you.shots, hits: you.hits, details: [{ label: "Rounds", value: state.round }] };
}
export function classicHistory(run: ClassicRun): HistoryRecord {
  return { id: `classic:${run.id}`, owner: run.player_id, mode: "classic", source: "account", recordedAt: run.recorded_at,
    outcome: run.outcome === "game_over" ? "completed" : run.outcome === "abandoned" ? "left" : "restarted", durationMs: run.duration_ms,
    score: run.score, shots: run.shots, hits: run.hits, level: run.level,
    details: [{ label: "Starting level", value: run.start_level }, { label: "Levels cleared", value: run.levels_cleared }, { label: "Crashes", value: run.crashes }, { label: "Deaths from shots", value: run.shot_deaths }, { label: "Lives remaining", value: run.lives_remaining }] };
}
type ServerMatch = { id: string; mode: string; started_at: string; ended_at: string; status: string; match_participants: { player_id: string; outcome: string | null; team: number; rating_before: number; rating_after: number | null; shots: number; hits: number }[] };
export function serverHistory(match: ServerMatch, owner: string): HistoryRecord | null {
  const part = match.match_participants.find(part => part.player_id === owner); if (!part) return null;
  const mode = part.rating_after !== null ? "ranked" : "versus";
  return { id: `${mode}:${match.id}`, owner, mode, source: "account", recordedAt: match.ended_at,
    outcome: part.outcome === "win" || part.outcome === "loss" || part.outcome === "draw" || part.outcome === "disconnect" ? part.outcome : "interrupted",
    durationMs: Math.max(0, Date.parse(match.ended_at) - Date.parse(match.started_at)), shots: part.shots > 0 ? part.shots : undefined, hits: part.shots > 0 ? part.hits : undefined,
    ratingBefore: mode === "ranked" ? part.rating_before : undefined, ratingAfter: mode === "ranked" ? part.rating_after ?? undefined : undefined };
}
export function sortHistory(rows: HistoryRecord[]) {
  const unique = new Map<string, HistoryRecord>();
  // Account records win over a local duplicate for the same mode and match ID.
  for (const row of rows) { const key = `${row.mode}:${row.id.replace(/^[^:]+:/, "")}`; const previous = unique.get(key); if (!previous || row.source === "account") unique.set(key, row); }
  return [...unique.values()].sort((a,b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt) || a.id.localeCompare(b.id));
}
export async function getAccountHistory(owner: string, limit: number) {
  const db = await connection();
  const results = await Promise.allSettled([
    db.from("classic_runs").select("*").eq("player_id",owner).order("recorded_at",{ ascending:false }).order("id").limit(limit),
    db.from("matches").select("id,mode,status,started_at,ended_at,match_participants!inner(player_id,outcome,team,rating_before,rating_after,shots,hits)").eq("match_participants.player_id",owner).in("status",["completed","abandoned"]).not("started_at","is",null).not("ended_at","is",null).order("ended_at",{ ascending:false }).order("id").limit(limit),
  ]);
  const rows: HistoryRecord[] = []; const warnings: string[] = [];
  results.forEach((result,index) => {
    const label = index === 0 ? "Classic account history" : "Online account history";
    if (result.status === "rejected" || result.value.error) { warnings.push(`${label} could not be loaded. Retry to check again.`); return; }
    if (index === 0) rows.push(...(result.value.data as unknown as ClassicRun[] ?? []).map(classicHistory));
    else for (const match of result.value.data as unknown as ServerMatch[] ?? []) { const row = serverHistory(match,owner); if (row) rows.push(row); }
  });
  return { rows, warnings };
}
