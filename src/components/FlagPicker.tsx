import { useState } from "react";
import { Check, Globe2 } from "lucide-react";
import { flags, flagImage, flagNames } from "@/lib/flags";

export function PlayerFlag({ code }: { code: string | null | undefined }) {
  if (!code || !flagNames.has(code)) return null;
  return <img className="player-flag" src={flagImage(code)} alt={flagNames.get(code)} title={flagNames.get(code)} />;
}

export function FlagPicker({ value, onChange, disabled }: {
  value: string | null; onChange: (value: string | null) => void; disabled: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const visible = flags.filter(flag => `${flag.name} ${flag.code}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="profile-flag-picker">
    <label id="profile-flag-label">Flag you represent</label>
    <button type="button" className="profile-option profile-flag-current" disabled={disabled}
      aria-expanded={expanded} aria-controls="profile-flag-options" aria-labelledby="profile-flag-label profile-flag-value"
      onClick={() => setExpanded(!expanded)}>
      {value ? <PlayerFlag code={value} /> : <Globe2 size={24} aria-hidden="true" />}
      <span id="profile-flag-value">{value ? flagNames.get(value) : "No flag selected"}</span><span>Change</span>
    </button>
    {expanded && <div id="profile-flag-options">
      <input className="profile-option" type="search" aria-label="Search flags" placeholder="Search country, territory or code" value={search}
        disabled={disabled} onChange={event => setSearch(event.target.value)} />
      <p className="profile-flag-count">{visible.length} flags available</p>
      <div className="profile-flag-list" role="group" aria-label="Available flags">
        <button type="button" disabled={disabled} aria-pressed={value === null} onClick={() => { onChange(null); setExpanded(false); }}>
          <Globe2 size={24} aria-hidden="true" /><span>No flag</span>{value === null && <Check size={18} aria-hidden="true" />}
        </button>
        {visible.map(flag => <button key={flag.code} type="button" disabled={disabled} aria-label={flag.name} aria-pressed={value === flag.code}
          onClick={() => { onChange(flag.code); setExpanded(false); setSearch(""); }}>
          <PlayerFlag code={flag.code} /><span>{flag.name}</span>{value === flag.code && <Check size={18} aria-hidden="true" />}
        </button>)}
        {!visible.length && <p>No matching flags. Try a country name or two-letter code.</p>}
      </div>
    </div>}
    <small>Shown on your public player card and leaderboard entry.</small>
  </div>;
}
