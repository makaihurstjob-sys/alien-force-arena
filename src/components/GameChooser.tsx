import { useEffect, useId, useRef, type RefObject } from "react";
import { X } from "lucide-react";
import { DesktopArena } from "./DesktopArena";
import { lobbyModes, type LobbyMode } from "@/lib/lobby-modes";
import "./hangar-lobby.css";

type Props = {
  open: boolean;
  mode: LobbyMode;
  onClose: () => void;
  onChoose: (mode: LobbyMode) => void;
  disabled?: (mode: LobbyMode) => boolean;
  hint?: (mode: LobbyMode) => string;
  returnFocus?: RefObject<HTMLButtonElement | null>;
};

export default function GameChooser({ open, mode, onClose, onChoose, disabled, hint, returnFocus }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  return <dialog ref={dialog} className="hangar-selector" aria-labelledby={title}
    onCancel={onClose} onClose={() => { returnFocus?.current?.focus(); onClose(); }}>
    <header>
      <h2 id={title}>Choose game</h2>
      <button type="button" aria-label="Close game selector" onClick={onClose}><X aria-hidden="true" size={20} /></button>
    </header>
    <div className="hangar-game-cards">
      {(Object.entries(lobbyModes) as [LobbyMode, (typeof lobbyModes)[LobbyMode]][]).map(([key, item]) => (
        <button type="button" key={key} disabled={disabled?.(key)} aria-pressed={key === mode}
          onClick={() => onChoose(key)}>
          <div className="hangar-thumbnail">
            <DesktopArena mode={key === "arcade" ? 1 : key === "practice" ? 2 : 0} thumbnail />
          </div>
          <strong>{item.name}</strong>
          <span>{item.description}{key !== "ranked" && ` \u00b7 ${item.max} ${item.max === 1 ? "pilot" : "pilots"}`}</span>
          <small>{hint?.(key) ?? "Select game"}</small>
        </button>
      ))}
    </div>
  </dialog>;
}
