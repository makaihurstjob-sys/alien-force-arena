import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { getAccountHistory, historyModes, readDeviceHistory, sortHistory, type HistoryMode, type HistoryRecord } from "@/lib/match-history";
import "./classic-leaderboard.css";
import "./match-history.css";
const results = { win: "Victory", loss: "Defeat", draw: "Draw", completed: "Completed", restarted: "Restarted", left: "Left game", interrupted: "Unfinished", disconnect: "Disconnected" };
function time(ms: number) { const seconds = Math.floor(ms / 1000); return `${Math.floor(seconds/60)}m ${seconds%60}s`; }
function HistoryRow({ row }: { row: HistoryRecord }) {
  return <details className={`tracker-run history-${row.outcome}`}><summary>
    <div className="tracker-run-title"><div><small>{new Date(row.recordedAt).toLocaleString()} &middot; {historyModes[row.mode]}</small><strong>{results[row.outcome]}</strong><span className="tracker-badge">{row.source === "account" ? "Account history" : "Saved on this browser"}</span></div></div>
    <div className="history-row-metrics">{row.score !== undefined && <span>{row.mode === "classic" ? `Score ${row.score}` : `${row.score} - ${row.opponentScore ?? 0}`}</span>}{row.kills !== undefined && <span>{row.kills} kills / {row.deaths ?? 0} deaths</span>}{row.ratingAfter !== undefined && <span>{row.ratingAfter-row.ratingBefore! >= 0 ? "+" : ""}{row.ratingAfter-row.ratingBefore!} rating</span>}<span>{time(row.durationMs)}</span></div>
    <span className="tracker-expand">Details <ChevronRight size={16} /></span>
  </summary><div className="tracker-run-details"><dl>
    {row.opponent && <div><dt>Opponent</dt><dd>{row.opponent}</dd></div>}
    {row.level !== undefined && <div><dt>Level reached</dt><dd>{row.level}</dd></div>}
    {row.shots !== undefined && <div><dt>Shots fired</dt><dd>{row.shots}</dd></div>}
    {row.hits !== undefined && <div><dt>Hits</dt><dd>{row.hits}</dd></div>}
    {!!row.shots && row.hits !== undefined && <div><dt>Accuracy</dt><dd>{(row.hits/row.shots*100).toFixed(1)}%</dd></div>}
    {row.ratingAfter !== undefined && <div><dt>Rating</dt><dd>{row.ratingBefore} to {row.ratingAfter}</dd></div>}
    {row.details?.map(detail => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}
  </dl></div></details>;
}
export default function MatchHistory({ account }: { account: string | null }) {
  const [mode,setMode] = useState<HistoryMode | "all">("all");
  const [page,setPage] = useState(0); const [revision,setRevision] = useState(0);
  const [rows,setRows] = useState<HistoryRecord[]>([]); const [warnings,setWarnings] = useState<string[]>([]); const [loading,setLoading] = useState(true);
  // Fetch an expanding prefix from each server source before globally sorting it.
  const [limit,setLimit] = useState(100);
  useEffect(() => {
    let active = true; setLoading(true); setWarnings([]); setRows([]);
    const load = async () => {
      const local = readDeviceHistory(account);
      if (!account) { if (active) setRows(sortHistory(local)); return; }
      try {
        const remote = await getAccountHistory(account,limit);
        if (active) { setRows(sortHistory([...local,...remote.rows])); setWarnings(remote.warnings); }
      } catch { if (active) { setRows(sortHistory(local)); setWarnings(["Account history could not be loaded. Your browser history is shown below."]); } }
    };
    void load().finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [account,revision,limit]);
  useEffect(() => { setPage(0); }, [account]);
  const filtered = rows.filter(row => mode === "all" || row.mode === mode);
  const visible = filtered.slice(page*20,page*20+20);
  return <section className="classic-tracker match-history" aria-label="All game match history">
    <div className="tracker-toolbar"><h3>Match history</h3><button disabled={loading} onClick={() => setRevision(value=>value+1)}><RefreshCw size={16} />Refresh history</button></div>
    <label className="history-filter">Game mode<select aria-label="Game mode" value={mode} onChange={event=>{setMode(event.target.value as HistoryMode | "all");setPage(0);}}><option value="all">All modes</option>{Object.entries(historyModes).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
    {loading ? <p role="status" className="tracker-empty">Loading match history...</p> : <>
      {!!warnings.length && <div className="tracker-empty" role="alert">{warnings.map(warning=><p key={warning}>{warning}</p>)}<button onClick={()=>setRevision(value=>value+1)}>Retry account history</button></div>}
      {!visible.length && <p className="tracker-empty">{warnings.length ? "No games are available from the sources that loaded. Retry account history." : mode === "all" ? "No saved games yet. Play any mode to start your history." : `No saved ${historyModes[mode]} games yet.`}</p>}
      {visible.map(row=><HistoryRow key={`${row.mode}:${row.id}`} row={row} />)}
      <nav className="tracker-pagination" aria-label="Match history pages"><button disabled={page===0} onClick={()=>setPage(value=>value-1)}><ChevronLeft size={16} />Previous</button><span>Page {page+1}</span><button disabled={filtered.length <= (page+1)*20} onClick={()=>setPage(value=>value+1)}>Next<ChevronRight size={16} /></button></nav>
      {account && rows.filter(row=>row.source==='account').length >= limit && <button onClick={()=>setLimit(value=>value+100)}>Load older account games</button>}
    </>}
  </section>;
}
