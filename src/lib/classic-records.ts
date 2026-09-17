import { connection } from "./multiplayer";
import type { ClassicState } from "@/game/classic/engine";

export type RunOutcome = "game_over" | "restarted" | "abandoned";
export type ClassicRun = {
  id: string; player_id: string; recorded_at: string; outcome: RunOutcome;
  start_level: number; level: number; score: number; duration_ms: number;
  shots: number; hits: number; crashes: number; shot_deaths: number;
  lives_remaining: number; levels_cleared: number;
};
export type RunSubmission = Omit<ClassicRun, "recorded_at">;
export type LeaderboardEntry = {
  flag_code?: string | null;
  rank: number; player_id: string; display_name: string; run_id: string;
  score: number; level: number; shots: number; hits: number; crashes: number;
  duration_ms: number; recorded_at: string; accuracy: number | null;
};
export type PlayerStats = {
  flag_code?: string | null;
  player_id: string; display_name: string; runs: number; completed_runs: number;
  best_score: number | null; shots: number; hits: number; crashes: number;
  shot_deaths: number; duration_ms: number; levels_cleared: number; accuracy: number | null;
};
export function snapshotRun(state: ClassicState, outcome: RunOutcome, playerId: string, id: string): RunSubmission {
  return { id, player_id: playerId, outcome: state.phase === "game_over" ? "game_over" : outcome,
    start_level: state.startLevel, level: state.level, score: state.score,
    duration_ms: Math.max(1, Math.round(state.elapsed * 1000)), shots: state.shotsFired,
    hits: state.hits, crashes: state.crashes, shot_deaths: state.shotDeaths,
    lives_remaining: state.lives, levels_cleared: state.levelsCleared };
}
export async function classicPlayer(): Promise<string> {
  const db = await connection();
  const { data, error } = await db.auth.getSession();
  if (error) throw error;
  let user = data.session?.user;
  if (!user) {
    const result = await db.auth.signInAnonymously();
    if (result.error) throw result.error;
    user = result.data.user ?? undefined;
  }
  if (!user) throw new Error("Sign in to save your Classic history.");
  const profile = await db.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (profile.error) throw profile.error;
  if (!profile.data) {
    const created = await db.from("profiles").upsert({ id: user.id,
      display_name: `Pilot-${user.id.replaceAll("-", "").slice(0, 18)}` },
    { onConflict: "id", ignoreDuplicates: true });
    if (created.error) throw created.error;
  }
  return user.id;
}
export async function submitClassicRun(run: RunSubmission) {
  const db = await connection();
  const session = await db.auth.getSession();
  if (session.error) throw session.error;
  if (session.data.session?.user.id !== run.player_id)
    throw new Error("Sign back into the player account that started this run to save it.");
  const { error } = await db.from("classic_runs").upsert(run, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}
export async function getClassicLeaderboard(page = 0) {
  const { data, error } = await (await connection()).from("classic_leaderboard")
    .select("*").order("rank").range(page * 25, page * 25 + 25);
  if (error) throw new Error(error.message);
  return data as LeaderboardEntry[];
}
export async function getClassicPlayer(id: string) {
  const { data, error } = await (await connection()).from("classic_player_stats")
    .select("*").eq("player_id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("This player could not be found.");
  return data as PlayerStats;
}
export async function getClassicHistory(id: string, page = 0) {
  const { data, error } = await (await connection()).from("classic_runs").select("*")
    .eq("player_id", id).order("recorded_at", { ascending: false }).order("id")
    .range(page * 20, page * 20 + 20);
  if (error) throw new Error(error.message);
  return data as ClassicRun[];
}
