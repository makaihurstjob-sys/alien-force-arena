import { useCallback, useState } from 'react';
import { Link } from '@tanstack/react-router';
import BulletRun from './BulletRun';
import MultiplayerLobby from './MultiplayerLobby';
import { ShipIcon } from './ShipIcon';
import './room-entry.css';

export default function RoomEntry({ entryMode, initialCode, initialMode, onBusyChange, onMatchChange, onLeave }: {
  entryMode: 'create' | 'join'; initialCode?: string | undefined; initialMode?: 'solo' | 'bullet' | undefined;
  onLeave?: () => void;
  onBusyChange: (busy: boolean) => void; onMatchChange: (playing: boolean) => void;
}) {
  const [mode, setMode] = useState<'solo' | 'duel' | 'bullet' | null>(initialCode ? 'duel' : initialMode ?? null);
  const [bulletBusy, setBulletBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const handleBulletBusy = useCallback((busy: boolean) => { setBulletBusy(busy); onBusyChange(busy); }, [onBusyChange]);
  if (mode === 'bullet') return <section className="shared-room-entry"><button hidden={bulletBusy} onClick={() => setMode(null)}>Choose mode</button><BulletRun embedded onBusyChange={handleBulletBusy} onLeave={onLeave} /></section>;
  if (mode === 'duel') return <MultiplayerLobby entryMode={entryMode} initialCode={initialCode}
    onBusyChange={onBusyChange} onMatchChange={onMatchChange} />;
  if (mode === 'solo') return <section className="shared-room-entry">
    <button onClick={() => { setMode(null); setReady(false); }}>← Choose mode</button>
    <h3>Classic · Solo room</h3><div className="room-pilot"><ShipIcon size={80} /><strong>Your pilot</strong>
      <p>{ready ? 'Ready for takeoff' : 'Get ready before entering the arena.'}</p></div>
    <button onClick={() => setReady(!ready)}>{ready ? 'Cancel ready' : 'Ready up'}</button>
    {ready ? <Link className="room-launch" to="/classic">Start Classic</Link> : <button disabled>Start Classic</button>}
  </section>;
  return <section className="shared-room-entry" aria-label="Choose room mode">
    <p>Choose your arena. Get your pilots together before launch.</p>
    <div className="room-mode-options">
      {entryMode === 'create' && <button onClick={() => setMode('solo')}><strong>Classic</strong><span>Solo survival · 1 pilot</span></button>}
      <button onClick={() => setMode('duel')}><strong>Classic 1v1</strong><span>Competitive duel · 2 pilots</span></button>
      <button onClick={() => setMode('bullet')}><strong>Bullet Run</strong><span>Free for all · 2–24 pilots</span></button>
      <button disabled><strong>Classic 2vE</strong><span>Cooperative survival · Coming later</span></button>
    </div>
  </section>;
}
