import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import HangarLobby from './HangarLobby';
import RankedQueue, { type RankedLobbyControls } from './RankedQueue';
import Classic from './Classic';
import { Practice } from '@/routes/practice';
import { connection } from '@/lib/multiplayer';
import { lobbyModes, type LobbyMode } from '@/lib/lobby-modes';

export default function LocalLobby({ mode, onModeChange, onLeave, onBusyChange, onMatchChange }: {
  mode: LobbyMode; onModeChange: (mode: LobbyMode) => void; onLeave: () => void;
  onBusyChange: (busy: boolean) => void; onMatchChange: (playing: boolean) => void;
}) {
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [player, setPlayer] = useState('local');
  const [name, setName] = useState('Your pilot');
  useEffect(() => {
    let active = true;
    void connection().then(async db => {
      const { data } = await db.auth.getSession();
      if (!data.session) return;
      if (active) setPlayer(data.session.user.id);
      const profile = await db.from('profiles').select('display_name').eq('id', data.session.user.id).maybeSingle();
      if (active && profile.data?.display_name) setName(profile.data.display_name);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => { setReady(false); }, [mode]);
  useEffect(() => { onBusyChange(true); return () => onBusyChange(false); }, [onBusyChange]);
  useEffect(() => { onMatchChange(playing); }, [playing, onMatchChange]);
  const returnToLobby = () => { setPlaying(false); setReady(false); };
  if (playing) return createPortal(<div className="online-match-screen" aria-label={`${lobbyModes[mode].name} game screen`}>
    {mode === 'solo' ? <Classic menuHref={import.meta.env.BASE_URL} onReturn={returnToLobby} /> : <Practice onReturn={returnToLobby} />}
  </div>, document.body);
  const lobby = (ranked?: RankedLobbyControls) => <HangarLobby mode={mode} room={{ id: 'local', code: '', host_id: player, status: 'open', phase: 'lobby', members: [{ player_id: player, display_name: name, ready }] }}
    player={player} busy={!!ranked?.busy} connected unavailable={false} readinessAvailable={!ranked || (ranked.eligible && !ranked.waiting)} selfReady={ready} allReady={ranked ? ranked.eligible && (ready || ranked.waiting) : ready && lobbyModes[mode].playable}
    status={ranked?.status ?? (lobbyModes[mode].playable ? 'Ready when you are' : 'This game is coming soon.')} invite=""
    onLeave={onLeave} onReady={() => setReady(value => !value)} onStart={ranked ? (ranked.waiting ? ranked.cancel : ranked.start) : () => { if (ready && (mode === 'solo' || mode === 'practice')) setPlaying(true); }} startLabel={ranked?.waiting ? 'Cancel search' : 'Start match'} onModeChange={ranked?.waiting ? undefined : onModeChange} />;
  return mode === 'ranked' ? <RankedQueue onMatchChange={onMatchChange} renderLobby={lobby} /> : lobby();
}
