import { useEffect, useRef, useState } from "react";
import "./join-room-dialog.css";

const letters: Record<string, string> = { "2": "ABC", "3": "DEF", "4": "GHI", "5": "JKL", "6": "MNO", "7": "PQRS", "8": "TUV", "9": "WXYZ" };

export default function JoinRoomDialog({ open, code, onCode, busy, error, onJoin, onClose }: {
  open: boolean; code: string; onCode: (value: string) => void; busy: boolean;
  error: string; onJoin: () => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const held = useRef(false);
  const [letterKey, setLetterKey] = useState<string | null>(null);
  const letterPanel = useRef<HTMLDivElement>(null);
  function stopHold() { clearTimeout(timer.current); }
  function append(value: string) { onCode((code + value).slice(0, 6)); setLetterKey(null); }
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else { dialog.current?.close(); setLetterKey(null); }
    return stopHold;
  }, [open]);
  useEffect(() => { if (letterKey) letterPanel.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, [letterKey]);
  return <dialog ref={dialog} className="join-room-dialog" aria-labelledby="join-room-title" onCancel={event => {
    event.preventDefault();
    if (busy) return;
    if (letterKey) setLetterKey(null); else onClose();
  }}>
    <header><h2 id="join-room-title">Join Game Room</h2><button type="button" aria-label="Close join room" disabled={busy} onClick={onClose}>×</button></header>
    <form onSubmit={event => { event.preventDefault(); if (!busy && /^[A-Z0-9]{6}$/.test(code)) onJoin(); }}>
      <label htmlFor="hangar-join-code">Room code</label>
      <input autoFocus id="hangar-join-code" value={code} maxLength={6} minLength={6} required pattern="[A-Z0-9]{6}" autoComplete="off" autoCapitalize="characters" spellCheck={false} inputMode="none" disabled={busy} placeholder="______" onChange={event => onCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} />
      <p className="join-keypad-help">Tap a number. Hold 2–9 to choose a letter.<br />You can also type or paste your code.</p>
      <div className="join-keypad-area">
      <div className="join-keypad">
        {"123456789".split("").map(key => <button key={key} type="button" disabled={busy || code.length === 6} aria-label={letters[key] ? `${key}, hold for ${letters[key]}` : key} onPointerDown={event => {
          if (event.button !== 0) return;
          stopHold(); held.current = false;
          if (letters[key]) timer.current = setTimeout(() => { held.current = true; setLetterKey(key); }, 450);
        }} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={() => { stopHold(); held.current = true; }} onContextMenu={event => event.preventDefault()} onKeyDown={event => {
          if (event.key === "ArrowDown" && letters[key]) { event.preventDefault(); setLetterKey(key); }
          if (event.key === "Enter" || event.key === " ") held.current = false;
        }} onClick={() => { stopHold(); if (!held.current) append(key); held.current = false; }}>
          <strong>{key}</strong><small>{letters[key] || "\u00a0"}</small>
        </button>)}
        <button type="button" aria-label="Backspace code" disabled={busy || !code} onClick={() => { setLetterKey(null); onCode(code.slice(0, -1)); }}>⌫</button>
        <button type="button" disabled={busy || code.length === 6} onClick={() => append("0")}><strong>0</strong></button>
        <button className="join-submit" type="submit" disabled={busy || code.length !== 6}>{busy ? "Joining…" : "Join"}</button>
      </div>
      {letterKey && <div className="join-letter-picker" ref={letterPanel} role="group" aria-label={`Letters on ${letterKey}`}><span>Choose a letter</span>{letters[letterKey]!.split("").map(letter => <button type="button" key={letter} disabled={busy} onClick={() => append(letter)}>{letter}</button>)}<button type="button" aria-label="Cancel letter selection" onClick={() => setLetterKey(null)}>×</button></div>}
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  </dialog>;
}
