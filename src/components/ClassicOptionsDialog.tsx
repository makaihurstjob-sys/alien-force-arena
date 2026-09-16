import { useEffect, useRef, useState } from "react";
import MultiplayerLobby from "./MultiplayerLobby";

export default function ClassicOptionsDialog({
  kind,
  level,
  onLevelChange,
  onClose,
}: {
  kind: "level" | "multiplayer";
  level: number;
  onLevelChange: (level: number) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(String(level));
  useEffect(() => {
    dialog.current?.show();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="classic-options-dialog"
      aria-labelledby="options-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      {kind === "level" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const next = Number(value);
            if (Number.isInteger(next) && next >= 1 && next <= 999) {
              onLevelChange(next);
              onClose();
            }
          }}
        >
          <label id="options-dialog-title" htmlFor="playing-level">
            Current Playing Level
          </label>
          <input
            id="playing-level"
            className="classic-level-input"
            type="number"
            min="1"
            max="999"
            step="1"
            required
            autoFocus
            value={value}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setValue(e.target.value)}
          />
          <div className="classic-dialog-actions">
            <button type="submit">OK</button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <h2 id="options-dialog-title">Multiplayer</h2>
          <MultiplayerLobby />
          <div className="classic-dialog-actions">
            <button onClick={onClose}>Close</button>
          </div>
        </>
      )}
    </dialog>
  );
}
