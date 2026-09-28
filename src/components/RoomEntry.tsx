import { useState } from 'react';
import BulletRun from './BulletRun';
import MultiplayerLobby from './MultiplayerLobby';
import LocalLobby from './LocalLobby';
import type { LobbyMode } from '@/lib/lobby-modes';
import './room-entry.css';

export default function RoomEntry({ initialCode, initialMode = 'solo', onBusyChange, onMatchChange, onLeave }: {
  initialCode?: string | undefined; initialMode?: LobbyMode | undefined;
  onLeave: () => void; onBusyChange: (busy: boolean) => void; onMatchChange: (playing: boolean) => void;
}) {
  const [mode, setMode] = useState<LobbyMode>(initialMode);
  return <section className="shared-room-entry">
    {mode === 'bullet' ? <BulletRun embedded autoEnter initialCode={initialCode} onBusyChange={onBusyChange} onLeave={onLeave} />
      : mode === 'duel' ? <MultiplayerLobby embedded entryMode={initialCode ? 'join' : 'create'} initialCode={initialCode} onBusyChange={onBusyChange} onMatchChange={onMatchChange} onLeave={onLeave} />
      : <LocalLobby mode={mode} onModeChange={setMode} onLeave={onLeave} onBusyChange={onBusyChange} onMatchChange={onMatchChange} />}
  </section>;
}
