import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Link } from '@tanstack/react-router';
import { connection, lobbyPlayerId, multiplayerConfigured } from '@/lib/multiplayer';
import { bulletLobby, type BulletLobby } from '@/lib/bullet-lobby';
import { BULLET_RUN, createState, idleInput, obstacles, step, weapon, type Input, type State } from '@/game/bullet-run';
import './bullet-run.css';
import { ShipIcon } from './ShipIcon';
import HangarLobby from './HangarLobby';

const keys: Record<string, keyof Pick<Input, 'up' | 'down' | 'left' | 'right' | 'fire'>> = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right', Space: 'fire',
};
function draw(ctx: CanvasRenderingContext2D, state: State, self: string) {
  ctx.fillStyle = '#101a21'; ctx.fillRect(0, 0, BULLET_RUN.width, BULLET_RUN.height);
  ctx.strokeStyle = '#203340'; ctx.lineWidth = 1;
  for (let x = 0; x < BULLET_RUN.width; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, BULLET_RUN.height); ctx.stroke(); }
  for (let y = 0; y < BULLET_RUN.height; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(BULLET_RUN.width, y); ctx.stroke(); }
  for (const o of obstacles) { ctx.fillStyle = '#55626a'; ctx.fillRect(o.x, o.y, o.w, o.h); ctx.strokeStyle = '#ffb84f'; ctx.strokeRect(o.x, o.y, o.w, o.h); }
  for (const b of state.bullets) { ctx.fillStyle = b.sniper ? '#fff6aa' : '#ff6852'; ctx.beginPath(); ctx.arc(b.x, b.y, b.sniper ? 5 : 3, 0, Math.PI * 2); ctx.fill(); }
  for (const p of state.pilots) {
    if (p.respawn) continue;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
    ctx.fillStyle = p.id === self ? '#4fffb8' : '#ff6464'; ctx.beginPath(); ctx.moveTo(19, 0); ctx.lineTo(-12, -12); ctx.lineTo(-8, 0); ctx.lineTo(-12, 12); ctx.closePath(); ctx.fill();
    if (p.shield) { ctx.strokeStyle = '#94e8ff'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore(); ctx.font = '13px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(p.name.slice(0, 20), p.x, p.y - 23);
  }
}
function validInput(v: unknown): v is Input {
  return !!v && typeof v === 'object' && ['up','down','left','right','fire'].every(k => typeof (v as Record<string,unknown>)[k] === 'boolean') &&
    Number.isFinite((v as Input).aimX) && Number.isFinite((v as Input).aimY) && Math.abs((v as Input).aimX) <= 1 && Math.abs((v as Input).aimY) <= 1;
}
function validState(v: unknown, roster: string[]): v is State {
  if (!v || typeof v !== 'object') return false;
  const s = v as State;
  return Number.isSafeInteger(s.tick) && s.tick >= 0 && Array.isArray(s.pilots) && s.pilots.length <= 24 &&
    s.pilots.every(p => roster.includes(p.id) && typeof p.name === 'string' && p.name.length < 40 &&
      [p.x,p.y,p.angle,p.kills,p.deaths,p.respawn,p.shield,p.cooldown,p.sniperCooldown].every(Number.isFinite)) &&
    Array.isArray(s.bullets) && s.bullets.length <= 400 && s.bullets.every(b => roster.includes(b.owner) &&
      [b.x,b.y,b.vx,b.vy,b.life].every(Number.isFinite));
}
export default function BulletRun({ embedded = false, onBusyChange, onLeave }: { embedded?: boolean; onBusyChange?: (busy: boolean) => void; onLeave?: (() => void) | undefined } = {}) {
  const [room, setRoom] = useState<BulletLobby | null>(null);
  const [code, setCode] = useState('');
  const [player, setPlayer] = useState('');
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [roomUnavailable, setRoomUnavailable] = useState(false);
  const requestEpoch = useRef(0);
  const mutationPending = useRef(false);
  useEffect(() => { onBusyChange?.(busy || !!room); }, [busy, !!room, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  const roomRef = useRef(room); roomRef.current = room;
  const stateRef = useRef(state); stateRef.current = state;
  const input = useRef<Input>({ ...idleInput });
  const peers = useRef(new Map<string, { input: Input; at: number }>());
  const channel = useRef<RealtimeChannel | null>(null);
  const connected = useRef(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const link = room ? `${window.location.origin}${import.meta.env.BASE_URL}bullet-run#room=${room.code}` : '';
  const act = useCallback(async (action: 'create' | 'join' | 'leave') => {
    requestEpoch.current++; mutationPending.current = true;
    setBusy(true); setError('');
    try {
      const next = await bulletLobby(action, action === 'join' ? code : roomRef.current?.code);
      setRoom(next); setState(null); setRoomUnavailable(false); setStatus('');
      const id = await lobbyPlayerId(); if (id) setPlayer(id);
      if (action === 'leave') { window.history.replaceState(null, '', embedded ? window.location.pathname + window.location.search : `${import.meta.env.BASE_URL}bullet-run`); setCode(''); onLeave?.(); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not connect to Bullet Run.'); }
    finally { requestEpoch.current++; mutationPending.current = false; setBusy(false); }
  }, [code, embedded, onLeave]);
  useEffect(() => {
    const invite = new URLSearchParams(window.location.hash.slice(1)).get('room');
    if (invite && /^[A-Z0-9]{6}$/i.test(invite)) setCode(invite.toUpperCase());
  }, []);
  useEffect(() => {
    if (!room || room.status !== 'open' || !player) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      const epoch = requestEpoch.current;
      try {
        const next = await bulletLobby('get', room.code);
        if (!cancelled && !mutationPending.current && epoch === requestEpoch.current) {
          roomRef.current = next; setRoom(next); setRoomUnavailable(false); setError('');
          if (next?.phase !== 'playing') { stateRef.current = null; setState(null); }
          if (next?.status !== 'open') { setState(null); setStatus('The host closed this room.'); }
        }
      } catch { if (!cancelled && !mutationPending.current && epoch === requestEpoch.current) { setRoomUnavailable(true); setError('Room connection interrupted. Reconnecting…'); } }
      if (!cancelled) timer = setTimeout(refresh, 2500);
    };
    timer = setTimeout(refresh, 2500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [room?.id, room?.status, player]);
  useEffect(() => {
    if (!room || room.status !== 'open' || !player || roomUnavailable) return;
    let disposed = false, frame = 0, lastTick = 0, lastSend = 0, sequence = -1;
    let sequenceMatch: string | null | undefined;
    const host = room.host_id === player;
    const instance = crypto.randomUUID();
    const send = (event: string, payload: unknown) => {
      if (connected.current && channel.current) void channel.current.send({ type: 'broadcast', event, payload }).catch(() => {});
    };
    void connection().then(db => {
      if (disposed) return;
      const ch = db.channel(`bullet-run:${room.id}`, { config: { broadcast: { self: false, ack: false } } });
      channel.current = ch;
      ch.on('broadcast', { event: 'input' }, ({ payload }) => {
        if (!host || !roomRef.current?.members.some(m => m.player_id === payload?.playerId) || !validInput(payload?.input)) return;
        peers.current.set(payload.playerId, { input: payload.input, at: performance.now() });
      });
      ch.on('broadcast', { event: 'start' }, ({ payload }) => {
        if (disposed || roomRef.current?.status !== 'open' || host || payload?.hostId !== room.host_id || roomRef.current?.phase !== 'playing' || payload?.matchId !== roomRef.current.match_id || !roomRef.current.match_roster?.includes(player) || !validState(payload?.state, roomRef.current?.match_roster ?? [])) return;
        sequenceMatch = payload.matchId; sequence = payload.state.tick; setState(payload.state);
      });
      ch.on('broadcast', { event: 'snapshot' }, ({ payload }) => {
        if (disposed || roomRef.current?.status !== 'open' || host || payload?.hostId !== room.host_id || roomRef.current?.phase !== 'playing' || payload?.matchId !== roomRef.current.match_id || !roomRef.current.match_roster?.includes(player) || !validState(payload?.state, roomRef.current?.match_roster ?? [])) return;
        if (sequenceMatch !== payload.matchId) { sequence = -1; sequenceMatch = payload.matchId; }
        if (payload.state.tick <= sequence) return;
        sequenceMatch = payload.matchId; sequence = payload.state.tick; setState(payload.state);
      });
      ch.subscribe(status => { if (disposed) return; connected.current = status === 'SUBSCRIBED'; setStatus(connected.current ? 'Arena connected' : 'Connecting to arena...'); });
    }).catch(() => setError('Could not connect to the arena.'));
    const loop = (now: number) => {
      if (disposed) return;
      frame = requestAnimationFrame(loop);
      if (!connected.current || document.hidden) return;
      if (now - lastSend >= 65) {
        lastSend = now;
        if (host) peers.current.set(player, { input: { ...input.current }, at: now });
        else send('input', { playerId: player, input: { ...input.current }, instance });
      }
      if (host && stateRef.current && now - lastTick >= BULLET_RUN.tickMs) {
        const current = stateRef.current;
        if (roomRef.current?.status !== 'open' || roomRef.current.phase !== 'playing') return;
        const active = new Set(roomRef.current.members.map(m => m.player_id));
        current.pilots = current.pilots.filter(p => active.has(p.id));
        current.bullets = current.bullets.filter(b => active.has(b.owner));
        const inputs = Object.fromEntries(current.pilots.map(p => [p.id, now - (peers.current.get(p.id)?.at ?? 0) < 500 ? peers.current.get(p.id)!.input : idleInput]));
        step(current, inputs, Math.min(now - lastTick, 100)); lastTick = now;
        setState({ ...current, pilots: [...current.pilots], bullets: [...current.bullets] });
        if (current.tick % 3 === 0) send('snapshot', { hostId: player, matchId: roomRef.current.match_id, state: current });
      }
    };
    frame = requestAnimationFrame(loop);
    return () => { disposed = true; cancelAnimationFrame(frame); connected.current = false; peers.current.clear(); void channel.current?.unsubscribe(); channel.current = null; };
  }, [room?.id, room?.status, player, roomUnavailable]);
  const readinessAvailable = room?.phase === 'lobby' && room.members.every(m => typeof m.ready === 'boolean');
  const allReady = room?.phase === 'lobby' && room.members.length >= 2 && room.members.every(m => m.ready === true);
  const selfReady = room?.members.find(m => m.player_id === player)?.ready === true;
  const setReady = async () => {
    if (!room || busy || roomUnavailable || room.status !== 'open') return;
    requestEpoch.current++; mutationPending.current = true;
    setBusy(true); setError('');
    try {
      const next = await bulletLobby(selfReady ? 'unready' : 'ready', room.code);
      if (roomRef.current?.id === room.id) setRoom(next);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update readiness.'); }
    finally { requestEpoch.current++; mutationPending.current = false; setBusy(false); }
  };
  const returnToRoom = async () => {
    if (!room || busy || room.host_id !== player || roomUnavailable) return;
    requestEpoch.current++; mutationPending.current = true;
    setBusy(true); setError('');
    try {
      const next = await bulletLobby('return', room.code);
      roomRef.current = next; setRoom(next); stateRef.current = null; setState(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not return to the room.'); }
    finally { requestEpoch.current++; mutationPending.current = false; setBusy(false); }
  };
  const start = async () => {
    if (!room || busy || room.status !== 'open' || roomUnavailable || room.host_id !== player || !allReady || !connected.current) return;
    requestEpoch.current++; mutationPending.current = true;
    setBusy(true); setError('');
    try {
      const approved = await bulletLobby('launch', room.code);
      if (!approved || roomRef.current?.id !== room.id || roomRef.current.status !== 'open' || !connected.current) return;
      if (approved.status !== 'open' || approved.host_id !== player || approved.phase !== 'playing' || !approved.match_id || !approved.match_roster || approved.match_roster.length < 2) throw new Error('Every pilot must be ready.');
      roomRef.current = approved; setRoom(approved);
      const next = createState(approved.members.filter(m => approved.match_roster!.includes(m.player_id)).map(m => ({ id: m.player_id, name: m.display_name })));
      stateRef.current = next; setState(next);
      if (channel.current) void channel.current.send({ type: 'broadcast', event: 'start', payload: { hostId: player, matchId: approved.match_id, state: next } });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start the match.'); }
    finally { requestEpoch.current++; mutationPending.current = false; setBusy(false); }
  };
  useEffect(() => {
    if (!state || roomUnavailable || room?.status !== 'open') return;
    const onDown = (e: KeyboardEvent) => { const key = keys[e.code]; if (key && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); input.current[key] = true; } };
    const onUp = (e: KeyboardEvent) => { const key = keys[e.code]; if (key) input.current[key] = false; };
    const clear = () => { input.current = { ...idleInput }; };
    window.addEventListener('keydown', onDown); window.addEventListener('keyup', onUp); window.addEventListener('blur', clear);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); window.removeEventListener('blur', clear); clear(); };
  }, [!!state, roomUnavailable, room?.status]);
  useEffect(() => {
    if (!state || roomUnavailable || room?.status !== 'open') return;
    let frame = 0;
    const render = () => { const ctx = canvas.current?.getContext('2d'); if (ctx && stateRef.current) draw(ctx, stateRef.current, player); frame = requestAnimationFrame(render); };
    frame = requestAnimationFrame(render); return () => cancelAnimationFrame(frame);
  }, [!!state, player, roomUnavailable, room?.status]);
  const aim = (clientX: number, clientY: number) => {
    const rect = canvas.current?.getBoundingClientRect(); const pilot = stateRef.current?.pilots.find(p => p.id === player);
    if (!rect || !pilot) return;
    const x = (clientX - rect.left) * BULLET_RUN.width / rect.width - pilot.x;
    const y = (clientY - rect.top) * BULLET_RUN.height / rect.height - pilot.y;
    const length = Math.hypot(x, y) || 1;
    input.current.aimX = x / length; input.current.aimY = y / length;
  };
  const you = state?.pilots.find(p => p.id === player);
  return <main className={`bullet-page ${embedded ? "bullet-embedded" : ""}`}>
    <header hidden={embedded && !!room}>{!embedded && <Link to="/">← Main menu</Link>}<h1>Bullet Run</h1><p>Up to 6 pilots · Free for all</p></header>
    {error && <p role="alert" className="bullet-error">{error}</p>}
    {!multiplayerConfigured && <p role="status">Online play requires the arena connection.</p>}
    {!room ? <section className="bullet-lobby"><h2>Enter the arena</h2>
      <button disabled={busy || !multiplayerConfigured} onClick={() => void act('create')}>Create Bullet Run room</button>
      <form onSubmit={e => { e.preventDefault(); void act('join'); }}><label htmlFor="bullet-code">Room code</label>
        <input id="bullet-code" value={code} maxLength={6} minLength={6} required pattern="[A-Za-z0-9]{6}" onChange={e => setCode(e.target.value.toUpperCase())} />
        <button disabled={busy || !multiplayerConfigured}>Join room</button></form></section> : <>
      {embedded && room.phase !== 'playing' && !state ? <HangarLobby room={room} player={player} busy={busy} connected={connected.current} unavailable={roomUnavailable} readinessAvailable={!!readinessAvailable} selfReady={selfReady} allReady={!!allReady} status={status} onLeave={() => void act('leave')} onReady={() => void setReady()} onStart={() => void start()} invite={link} /> : <section className="bullet-lobby"><strong>Room {room.code}</strong> · {room.members.length}/6 players
        <button onClick={() => void act('leave')} disabled={busy}>Leave room</button>
        <p role="status">{room.status === 'closed' ? 'The host closed this room.' : roomUnavailable ? 'Waiting for the room connection to recover.' : status}</p>
        {room.status === 'closed' && <p>Leave this room to create or join another one.</p>}
        {room.phase !== 'playing' && !state && room.status === 'open' && !roomUnavailable && <><label htmlFor="bullet-link">Invite link</label><input id="bullet-link" readOnly value={link} onFocus={e => e.currentTarget.select()} />
          <button onClick={() => void navigator.clipboard.writeText(link)}>Copy invite</button>
          <ul className="bullet-pilot-lineup" aria-label="Room pilots">
            {room.members.map(m => <li key={m.player_id} className={m.player_id === player ? 'is-you' : undefined}>
              <ShipIcon size={64} />
              <strong>{m.display_name}</strong>
              <span>{m.player_id === room.host_id ? 'Host' : 'Guest'}{m.player_id === player ? ' · You' : ''}</span>
              <span>{m.ready === true ? 'Ready' : 'Not ready'}</span>
            </li>)}
          </ul>
          {!readinessAvailable && <p>Room readiness setup is pending.</p>}
          <button disabled={busy || !readinessAvailable || !connected.current} onClick={() => void setReady()}>{selfReady ? 'Cancel ready' : 'Ready up'}</button>
          <p>{room.members.filter(m => m.ready === true).length}/{room.members.length} pilots ready</p>
          {room.members.length < 2 && <p>Invite another pilot to start. Bullet Run needs at least two players.</p>}
          {room.host_id === player ? <button disabled={busy || !allReady || !connected.current} onClick={() => void start()}>Start match</button> : <p>Waiting for the host to start...</p>}</>}
        {room.phase === 'playing' && room.status === 'open' && !roomUnavailable && <>{!state && <p>{room.match_roster?.includes(player) ? 'Waiting for the host arena...' : 'Round in progress. You will join the next round.'}</p>}{room.host_id === player && <button onClick={() => void returnToRoom()} disabled={busy}>Return everyone to room</button>}</>}
      </section>}
      {state && room.status === 'open' && !roomUnavailable && <section className="bullet-match"><div className="bullet-hud"><span>Kills: {you?.kills ?? 0}</span><span>Deaths: {you?.deaths ?? 0}</span>
        <span>Weapon: {weapon(you?.kills ?? 0).stage} × {weapon(you?.kills ?? 0).count}</span>
        {you && you.kills >= 11 && <span>Sniper: {Math.ceil(you.sniperCooldown / 1000)}s</span>}</div>
        <canvas ref={canvas} width={BULLET_RUN.width} height={BULLET_RUN.height} aria-label="Bullet Run arena"
          onPointerMove={e => aim(e.clientX, e.clientY)} onPointerDown={e => { aim(e.clientX, e.clientY); input.current.fire = true; }}
          onPointerUp={() => { input.current.fire = false; }} onPointerLeave={() => { input.current.fire = false; }} />
        <div className="bullet-touch-controls" aria-label="Touch game controls">
          {(['up','left','down','right','fire'] as const).map(control => <button key={control}
            onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); input.current[control] = true; }}
            onPointerUp={() => { input.current[control] = false; }} onPointerCancel={() => { input.current[control] = false; }}>
            {({ up: '↑', left: '←', down: '↓', right: '→', fire: 'FIRE' })[control]}
          </button>)}
        </div>
        <p role="status">{you?.respawn ? `Respawning in ${Math.ceil(you.respawn / 1000)}...` : state.lastKill || 'Battle in progress'}</p>
        <p>Move: WASD or arrows · Aim: mouse · Shoot: click or Space · New weapons unlock with kills</p>
        <ol>{[...state.pilots].sort((a,b) => b.kills - a.kills).map(p => <li key={p.id}>{p.name}: {p.kills} kills</li>)}</ol>
      </section>}
    </>}
  </main>;
}
