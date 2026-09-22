import { ChevronLeft, ChevronRight, Medal, Search } from "lucide-react";
import { ranks } from "@/lib/ranks";
import RankedExperiment from './RankedExperiment';
import "./classic-leaderboard.css";
import "./ranked-ratings.css";

/** Public standings shell. Enable controls when the ranked read API is available. */
export default function RankedRatings() {
  return <section className="classic-tracker ranked-tracker" aria-label="Ranked ratings">
    <div className="tracker-toolbar">
      <span><Medal size={18} aria-hidden="true" />Competitive · 1v1</span>
      <span className="ranked-season-status">Preseason</span>
    </div>
    <header className="tracker-header">
      <div><span className="tracker-eyebrow">ALIEN FORCE · COMPETITIVE STANDINGS</span>
        <h3>Ranked Ratings</h3>
      </div>
    </header>
    <section className="ranked-progression" aria-labelledby="ranked-progression-title">
      <div className="ranked-progression-heading"><h4 id="ranked-progression-title">Rank progression</h4><span>Lowest → Highest</span></div>
      <ol className="ranked-tier-list">
        {ranks.map((rank) => <li key={rank.id}>
          <span className="ranked-tier-swatch" style={{ backgroundColor: rank.color }} aria-hidden="true" />
          <span className="ranked-tier-name" style={{ color: rank.color }}>{rank.name}</span>
          <span className="ranked-tier-number">{rank.id === 'galactic-legend' ? '#1' : 'I / II / III'}</span>
        </li>)}
      </ol>
    </section>
    <p>Start at Cadet I. Earn 100 points per division, with one grace loss at zero. Galactic Legend requires the #1 spot and 1,500 rating.</p>
    <RankedExperiment />
    <div className="ranked-filters" aria-describedby="ranked-launch-note">
      <label className="ranked-search">Player
        <span><Search size={18} aria-hidden="true" /><input type="search" placeholder="Search players" disabled /></span>
      </label>
      <label>Region<select disabled defaultValue="all"><option value="all">All regions</option></select></label>
      <label>Mode<select disabled defaultValue="1v1"><option value="1v1">1v1</option></select></label>
    </div>
    <div className="tracker-table-scroll" role="region" aria-label="Ranked standings table" tabIndex={0}>
      <table>
        <caption className="sr-only">Competitive standings ordered by season rating, highest first.</caption>
        <thead><tr>{["Rank", "Region", "Player", "Tier", "Wins–Losses", "Season rating", "Peak rating"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody />
      </table>
    </div>
    <div className="ranked-empty-cell">
      <Medal size={32} aria-hidden="true" /><h4>Ranked opens soon</h4>
      <p id="ranked-launch-note">Standings and player search will unlock when ranked matches begin.</p>
    </div>
    <nav className="tracker-pagination" aria-label="Ranked standings pages">
      <button disabled><ChevronLeft size={16} aria-hidden="true" />Previous</button>
      <span>No ranked players yet</span>
      <button disabled>Next<ChevronRight size={16} aria-hidden="true" /></button>
    </nav>
  </section>;
}
