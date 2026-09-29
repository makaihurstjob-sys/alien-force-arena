import { useEffect, useState } from 'react';
import SharedRoom from './SharedRoom';
import { sharedRoomsAvailable } from '@/lib/game-lobby';
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
  const [shared, setShared] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void sharedRoomsAvailable().then(value => { if (active) setShared(value); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Unable to connect.'); });
    return () => { active = false; };
  }, []);
  if (shared === null) return <p role="status">{error || 'Connecting to room service...'}</p>;
  if (shared) return <section className="shared-room-entry"><SharedRoom initialCode={initialCode} initialMode={initialMode}
    onLeave={onLeave} onBusyChange={onBusyChange} onMatchChange={onMatchChange} /></section>;
  return <section className="shared-room-entry">
    {mode === 'bullet' ? <BulletRun embedded autoEnter initialCode={initialCode} onBusyChange={onBusyChange} onLeave={onLeave} />
      : mode === 'duel' ? <MultiplayerLobby embedded entryMode={initialCode ? 'join' : 'create'} initialCode={initialCode} onBusyChange={onBusyChange} onMatchChange={onMatchChange} onLeave={onLeave} />
      : <LocalLobby mode={mode} onModeChange={setMode} onLeave={onLeave} onBusyChange={onBusyChange} onMatchChange={onMatchChange} />}
  </section>;
}
