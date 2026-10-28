import { useEffect, useState } from "react";
import { ArrowLeft, Keyboard, RotateCcw, X } from "lucide-react";
import { defaults, keyLabel, loadBindings, saveBindings, type Action } from "@/lib/keybindings";
import "./game-settings.css";

const controls: Record<Action, { label: string; description: string }> = {
  thrust: { label: "Move up / thrust", description: "Move up in Adventure and Arcade, or thrust forward in Practice." },
  reverse: { label: "Move down / reverse", description: "Move down in Adventure and Arcade, or reverse thrust in Practice." },
  left: { label: "Move left", description: "Move left in Adventure and Arcade, or steer left in Practice." },
  right: { label: "Move right", description: "Move right in Adventure and Arcade, or steer right in Practice." },
  fire: { label: "Fire", description: "Fire your weapon. Another shot becomes available when the current shot clears." },
  turnaround: { label: "Turn around", description: "Reverse your ship's heading." },
  dash: { label: "Dash / teleport", description: "Use a dash or teleport when available in Arcade modes." },
  pause: { label: "Pause", description: "Pause or resume in supported game modes." },
};
const actions = Object.keys(controls) as Action[];
type Editing = { action: Action; slot: number };

export default function GameSettings({ onBack }: { onBack?: () => void }) {
  const [bindings, setBindings] = useState(loadBindings);
  const [saved, setSaved] = useState(bindings);
  const [selected, setSelected] = useState<Action>("thrust");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [message, setMessage] = useState("");
  const dirty = actions.some(action => bindings[action].join() !== saved[action].join());

  useEffect(() => {
    if (!editing) return;
    const capture = (event: KeyboardEvent) => {
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.repeat) return;
      if (event.code === "Escape") { setEditing(null); setMessage("Binding cancelled."); return; }
      if (!/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|F([1-9]|1[0-2])|Space|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Enter|Tab|Backspace|Delete|Home|End|PageUp|PageDown|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Minus|Equal|Backquote)$/.test(event.code)) {
        setMessage("Choose a letter, number, arrow, or standard keyboard key."); return;
      }
      const conflict = actions.find(action => bindings[action].some((code, index) =>
        code === event.code && (action !== editing.action || index !== editing.slot)));
      if (conflict) {
        setMessage(`${keyLabel(event.code)} is already assigned to ${controls[conflict].label}. Clear that binding first.`); return;
      }
      const keys = [...bindings[editing.action]];
      keys[editing.slot] = event.code;
      setBindings({ ...bindings, [editing.action]: keys.filter(Boolean) });
      setEditing(null); setMessage("Binding changed. Select Apply to save.");
    };
    window.addEventListener("keydown", capture, true);
    return () => window.removeEventListener("keydown", capture, true);
  }, [editing, bindings]);

  function apply() {
    try {
      saveBindings(bindings); setSaved(bindings); setEditing(null);
      setMessage("Controls saved on this device.");
    } catch { setMessage("Could not save controls. Allow browser storage and try again."); }
  }

  return <section className="game-settings" aria-label="Keyboard controls">
    <header className="controls-heading"><Keyboard size={24} aria-hidden="true" /><div>
      <h3>Keyboard controls</h3><p>Select a binding, then press a key.</p>
    </div></header>
    <div className="controls-layout">
      <div className="keybinding-list" aria-label="Control bindings">
        <div className="keybinding-columns" aria-hidden="true"><span>Action</span><span>Key bindings</span><span /></div>
        {actions.map(action => <div className={`keybinding-row ${selected === action ? "is-selected" : ""}`} key={action}
          onMouseEnter={() => { if (!editing) setSelected(action); }} onFocus={() => setSelected(action)}>
          <span className="keybinding-label">{controls[action].label}</span>
          <div className="binding-slots">
            {Array.from({ length: Math.max(2, bindings[action].length) }, (_, slot) => {
              const listening = editing?.action === action && editing.slot === slot;
              return <button key={slot} type="button" className="binding-key" aria-label={`Change ${controls[action].label}, binding ${slot + 1}`}
                aria-pressed={listening} onClick={() => { setSelected(action); setEditing({ action, slot }); setMessage(""); }}>
                {listening ? <span>Press a key</span> : bindings[action][slot] ? <kbd>{keyLabel(bindings[action][slot]!)}</kbd> : <span className="binding-empty">Unbound</span>}
              </button>;
            })}
          </div>
          <button type="button" className="binding-clear" aria-label={`Clear ${controls[action].label} bindings`}
            disabled={bindings[action].length === 0} onClick={() => {
              setSelected(action); setEditing(null); setBindings({ ...bindings, [action]: [] });
              setMessage("Bindings cleared. Select Apply to save.");
            }}><X size={18} aria-hidden="true" /></button>
        </div>)}
      </div>
      <aside className="binding-details" aria-label="Selected control">
        <Keyboard size={28} aria-hidden="true" /><h4>{controls[selected].label}</h4>
        <p>{controls[selected].description}</p>
        <div className="binding-detail-keys">{bindings[selected].length ? bindings[selected].map(code => <kbd key={code}>{keyLabel(code)}</kbd>) : <span>Unbound</span>}</div>
        {editing && <p className="binding-listening" role="status">Press a key to bind. Escape cancels.</p>}
      </aside>
    </div>
    <div className="controls-footer">
      <p className="controls-status" role="status" aria-live="polite">{message || (dirty ? "Unsaved changes" : "Controls saved on this device")}</p>
      <div className="controls-actions">
        <button type="button" className="controls-apply" disabled={!dirty || !!editing} onClick={apply}>Apply</button>
        <button type="button" onClick={() => {
          setBindings(structuredClone(defaults)); setEditing(null); setMessage("Default controls loaded. Select Apply to save.");
        }}><RotateCcw size={16} aria-hidden="true" />Restore defaults</button>
        {onBack && <button type="button" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />Back</button>}
      </div>
    </div>
  </section>;
}
