import { useEffect, useRef, useState } from "react";
import { Trophy, Crosshair, Clock3, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { ShipIcon } from "./ShipIcon";
import { PlayerFlag } from "./FlagPicker";
import { getClassicLeaderboard, getClassicPlayer, getClassicHistory,
  type LeaderboardEntry, type PlayerStats, type ClassicRun } from "@/lib/classic-records";
import "./classic-leaderboard.css";

const number = (value: number) => Number(value).toLocaleString();
const accuracy = (value: number | null) => value === null ? "—" : `${Number(value).toFixed(1)}%`;
export function duration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
const resultLabel = { game_over: "Completed", restarted: "Restarted", abandoned: "Left game" };
function playerFromHash() {
  const value = new URLSearchParams(window.location.hash.slice(1)).get("player");
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null;
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="tracker-metric"><dt>{label}</dt><dd>{value}</dd></div>;
}
function RunRow({ run }: { run: ClassicRun }) {
  const eligible = run.start_level === 1 && run.outcome === "game_over";
  return <details className={`tracker-run ${eligible ? "eligible" : ""}`}>
    <summary>
      <div className="tracker-run-title"><span className="tracker-ship"><ShipIcon size={32} /></span>
        <div><small>{new Date(run.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Classic</small>
          <strong>{resultLabel[run.outcome]}</strong><span className="tracker-badge">{run.start_level !== 1 ? `Custom start · Level ${run.start_level}` : eligible ? "Leaderboard run" : "History only"}</span></div>
      </div>
      <dl className="tracker-run-stats">
        <Metric label="Score" value={number(run.score)} />
        <Metric label="Level" value={run.level} />
        <Metric label="Accuracy" value={accuracy(run.shots ? 100 * run.hits / run.shots : null)} />
        <Metric label="Shots" value={number(run.shots)} />
        <Metric label="Crashes" value={run.crashes} />
      </dl>
      <span className="tracker-expand">Details <ChevronRight size={16} /></span>
    </summary>
    <div className="tracker-run-details"><dl>
      <Metric label="Active play time" value={duration(run.duration_ms)} />
      <Metric label="Enemies destroyed" value={number(run.hits)} />
      <Metric label="Shots without a hit" value={number(run.shots - run.hits)} />
      <Metric label="Levels cleared" value={run.levels_cleared} />
      <Metric label="Deaths from shots" value={run.shot_deaths} />
      <Metric label="Lives remaining" value={run.lives_remaining} />
    </dl><p>Crashes count ship collisions that cost a life. Accuracy is enemy hits ÷ shots fired. Active time excludes pauses and countdowns.</p></div>
  </details>;
}
export default function ClassicLeaderboard() {
  const [player, setPlayer] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [profile, setProfile] = useState<PlayerStats | null>(null);
  const [history, setHistory] = useState<ClassicRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const read = () => { setPlayer(playerFromHash()); setPage(0); };
    read(); window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setProfile(null); setHistory([]); setBoard([]); setCopied(false);
    const load = async () => {
      if (player) {
        const [stats, runs] = await Promise.all([getClassicPlayer(player), getClassicHistory(player, page)]);
        if (active) { setProfile(stats); setHistory(runs); }
      } else {
        const rows = await getClassicLeaderboard(page);
        if (active) setBoard(rows);
      }
    };
    void load().catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load records."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [player, page, revision]);
  const selectPlayer = (id: string | null) => {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${id ? `#player=${id}` : ""}`);
    setPlayer(id); setPage(0); heading.current?.focus();
  };
  const visibleRuns = history.slice(0, 20);
  const dates = [...new Set(visibleRuns.map(run => new Date(run.recorded_at).toLocaleDateString()))];
  return <section className="classic-tracker" aria-label="Classic score tracker">
    <div className="tracker-toolbar">
      {player ? <button onClick={() => selectPlayer(null)}><ChevronLeft size={17} />Leaderboard</button> : <span><Trophy size={18} />Classic · All time</span>}
      <button aria-label="Refresh records" disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={17} />Refresh</button>
    </div>
    <header className="tracker-header">
      <div><span className="tracker-eyebrow">ALIEN FORCE · COMMUNITY SCORES</span>
        <h3 ref={heading} tabIndex={-1}>{player && <PlayerFlag code={profile?.flag_code} />} {player ? profile?.display_name ?? "Player card" : "Global Leaderboard"}</h3>
        <p>{player ? "Public Classic stats and game history" : "One player. One best run. See the story behind every score."}</p>
      </div>
      {player && <button className="tracker-share" onClick={() => {
        void navigator.clipboard.writeText(window.location.href).then(() => setCopied(true)).catch(() => setError("Could not copy the link. Copy the address from your browser."));
      }}>{copied ? "Link copied" : "Copy player link"}</button>}
    </header>
    <p className="tracker-note">Browser-reported scores · Not independently verified. Only completed runs starting at level 1 enter the leaderboard.</p>
    {loading ? <p role="status" className="tracker-empty">Loading records…</p> : error ? <div role="alert" className="tracker-empty"><p>{error}</p><button onClick={() => setRevision(value => value + 1)}>Try again</button></div> : player && profile ? <>
      <dl className="tracker-overview">
        <Metric label="Best leaderboard score" value={profile.best_score === null ? "—" : number(profile.best_score)} />
        <Metric label="Runs played" value={number(profile.runs)} />
        <Metric label="Accuracy" value={accuracy(profile.accuracy)} />
        <Metric label="Shots fired" value={number(profile.shots)} />
        <Metric label="Enemies destroyed" value={number(profile.hits)} />
        <Metric label="Crashes" value={number(profile.crashes)} />
        <Metric label="Levels cleared" value={number(profile.levels_cleared)} />
        <Metric label="Active play time" value={duration(profile.duration_ms)} />
      </dl>
      <div className="tracker-history-heading"><h4>Game history</h4><span><Clock3 size={15} />Newest first</span></div>
      <p className="tracker-note">Totals include all saved runs, including restarts and custom starting levels. Accuracy uses total hits and total shots.</p>
      {!history.length && <p className="tracker-empty">No saved Classic games yet.</p>}
      {dates.map(date => <section key={date} className="tracker-day" aria-label={`Games on ${date}`}>
        <h5>{date}</h5>{visibleRuns.filter(run => new Date(run.recorded_at).toLocaleDateString() === date).map(run => <RunRow key={run.id} run={run} />)}
      </section>)}
    </> : <>
      {!board.length ? <div className="tracker-empty"><Crosshair size={32} /><h4>The first score is waiting.</h4><p>Finish a Classic game from level 1 to appear here. Choose a display name from your player profile.</p></div> : <div className="tracker-table-scroll"><table>
        <caption className="sr-only">Classic best scores. Select a player to view their public card.</caption>
        <thead><tr><th>Rank</th><th>Player</th><th>Best score</th><th>Level</th><th>Accuracy</th><th>Shots</th><th>Crashes</th></tr></thead>
        <tbody>{board.slice(0, 25).map(row => <tr key={row.player_id}>
          <td className="tracker-rank">#{row.rank}</td><td><button className="tracker-player-link" onClick={() => selectPlayer(row.player_id)}><PlayerFlag code={row.flag_code} />{row.display_name}<ChevronRight size={15} /></button></td>
          <td className="tracker-score">{number(row.score)}</td><td>{row.level}</td><td>{accuracy(row.accuracy)}</td><td>{number(row.shots)}</td><td>{row.crashes}</td>
        </tr>)}</tbody>
      </table></div>}
      <p className="tracker-note">Ties: highest level, then earliest submitted run. Accuracy, shots and crashes describe the listed best run.</p>
    </>}
    {!loading && !error && <nav className="tracker-pagination" aria-label={player ? "Game history pages" : "Leaderboard pages"}>
      <button disabled={page === 0} onClick={() => setPage(value => value - 1)}><ChevronLeft size={16} />Previous</button>
      <span>Page {page + 1}</span>
      <button disabled={player ? history.length <= 20 : board.length <= 25} onClick={() => setPage(value => value + 1)}>Next<ChevronRight size={16} /></button>
    </nav>}
  </section>;
}
