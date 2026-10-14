import { useEffect, useState } from "react";
import { defaults, keyLabel, loadBindings, saveBindings, type Action } from "@/lib/keybindings";
import "./game-settings.css";
const labels: Record<Action, string> = { thrust: "Move up / thrust", reverse: "Move down / reverse", left: "Move left", right: "Move right", fire: "Fire", turnaround: "Turn around", dash: "Dash / teleport (Arcade)", pause: "Pause" };
export default function GameSettings() {
  const [bindings, setBindings] = useState(loadBindings);
  const [editing, setEditing] = useState<Action | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!editing) return;
    const capture = (event: KeyboardEvent) => {
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.repeat) return;
      if (event.code === "Escape") { setEditing(null); return; }
      if (!/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Enter|Tab|Backspace|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Minus|Equal|Backquote)$/.test(event.code)) { setMessage("Choose a letter, number, arrow, or standard keyboard key."); return; }
      const conflict = (Object.keys(bindings) as Action[]).find(action => action !== editing && bindings[action].includes(event.code));
      if (conflict) { setMessage(`${keyLabel(event.code)} is already assigned to ${labels[conflict]}. Change that binding first.`); return; }
      const next = { ...bindings, [editing]: [event.code] };
      try { saveBindings(next); setBindings(next); setMessage("Keybind saved on this device."); setEditing(null); }
      catch { setMessage("Could not save settings. Allow browser storage and try again."); }
    };
    window.addEventListener("keydown", capture, true);
    return () => window.removeEventListener("keydown", capture, true);
  }, [editing, bindings]);
  return <section className="game-settings" aria-label="Keyboard controls">
    <p>Change your in-game keyboard controls. Settings are saved on this browser.</p>
    <p>Choose a control, then press a key. Escape cancels.</p>
    <div className="keybinding-list">{(Object.keys(labels) as Action[]).map(action => <div className="keybinding-row" key={action}><span>{labels[action]}</span><button aria-label={`Change ${labels[action]}`} aria-pressed={editing === action} onClick={() => { setEditing(action); setMessage(""); }}>{editing === action ? "Press a key?" : bindings[action].map(keyLabel).join(" / ")}</button></div>)}</div>
    <p role="status">{message}</p>
    <button onClick={() => { try { const next = structuredClone(defaults); saveBindings(next); setBindings(next); setEditing(null); setMessage("Default controls restored."); } catch { setMessage("Could not save settings. Allow browser storage and try again."); } }}>Reset to defaults</button>
    <p>Pause is available in supported modes. Touch controls stay the same.</p>
  </section>;
}
