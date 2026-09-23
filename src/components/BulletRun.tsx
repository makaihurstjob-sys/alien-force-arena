import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Link } from '@tanstack/react-router';
import { connection, lobbyPlayerId, multiplayerConfigured } from '@/lib/multiplayer';
import { bulletLobby, type BulletLobby } from '@/lib/bullet-lobby';
import { BULLET_RUN, createState, idleInput, obstacles, step, weapon, type Input, type State } from '@/game/bullet-run';
import './bullet-run.css';

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
export default function BulletRun() {
  const [room, setRoom] = useState<BulletLobby | null>(null);
  const [code, setCode] = useState('');
  const [player, setPlayer] = useState('');
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const roomRef = useRef(room); roomRef.current = room;
  const stateRef = useRef(state); stateRef.current = state;
  const input = useRef<Input>({ ...idleInput });
  const peers = useRef(new Map<string, { input: Input; at: number }>());
  const channel = useRef<RealtimeChannel | null>(null);
  const connected = useRef(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const link = room ? `${window.location.origin}${import.meta.env.BASE_URL}bullet-run#room=${room.code}` : '';
  const act = useCallback(async (action: 'create' | 'join' | 'leave') => {
    setBusy(true); setError('');
    try {
      const next = await bulletLobby(action, action === 'join' ? code : roomRef.current?.code);
      setRoom(next); setState(null);
      const id = await lobbyPlayerId(); if (id) setPlayer(id);
      if (action === 'leave') { window.history.replaceState(null, '', `${import.meta.env.BASE_URL}bullet-run`); setCode(''); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not connect to Bullet Run.'); }
    finally { setBusy(false); }
  }, [code]);
  useEffect(() => {
    const invite = new URLSearchParams(window.location.hash.slice(1)).get('room');
    if (invite && /^[A-Z0-9]{6}$/i.test(invite)) setCode(invite.toUpperCase());
  }, []);
  useEffect(() => {
    if (!room || !player) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const next = await bulletLobby('get', room.code);
        if (!cancelled) {
          setRoom(next);
          if (next?.status !== 'open') { setState(null); setStatus('The host closed this room.'); }
        }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Room connection lost.'); }
      if (!cancelled) timer = setTimeout(refresh, 2500);
    };
    timer = setTimeout(refresh, 2500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [room?.id, player]);
  useEffect(() => {
    if (!room || !player) return;
    let disposed = false, frame = 0, lastTick = 0, lastSend = 0, sequence = -1;
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
        if (host || payload?.hostId !== room.host_id || !validState(payload?.state, roomRef.current?.members.map(m => m.player_id) ?? [])) return;
        sequence = payload.state.tick; setState(payload.state);
      });
      ch.on('broadcast', { event: 'snapshot' }, ({ payload }) => {
        if (host || payload?.hostId !== room.host_id || !validState(payload?.state, roomRef.current?.members.map(m => m.player_id) ?? [])) return;
        if (payload.state.tick <= sequence) return;
        sequence = payload.state.tick; setState(payload.state);
      });
      ch.subscribe(status => { connected.current = status === 'SUBSCRIBED'; setStatus(connected.current ? 'Arena connected' : 'Connecting to arena...'); });
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
        if (roomRef.current?.status !== 'open') return;
        const active = new Set(roomRef.current.members.map(m => m.player_id));
        current.pilots = current.pilots.filter(p => active.has(p.id));
        current.bullets = current.bullets.filter(b => active.has(b.owner));
        const inputs = Object.fromEntries(current.pilots.map(p => [p.id, now - (peers.current.get(p.id)?.at ?? 0) < 500 ? peers.current.get(p.id)!.input : idleInput]));
        step(current, inputs, Math.min(now - lastTick, 100)); lastTick = now;
        setState({ ...current, pilots: [...current.pilots], bullets: [...current.bullets] });
        if (current.tick % 3 === 0) send('snapshot', { hostId: player, state: current });
      }
    };
    frame = requestAnimationFrame(loop);
    return () => { disposed = true; cancelAnimationFrame(frame); connected.current = false; peers.current.clear(); void channel.current?.unsubscribe(); channel.current = null; };
  }, [room?.id, player]);
  const start = () => {
    if (!room || room.host_id !== player || room.members.length < 2 || !connected.current) return;
    const next = createState(room.members.map(m => ({ id: m.player_id, name: m.display_name })));
    stateRef.current = next; setState(next);
    if (channel.current) void channel.current.send({ type: 'broadcast', event: 'start', payload: { hostId: player, state: next } });
  };
  useEffect(() => {
    if (!state) return;
    const onDown = (e: KeyboardEvent) => { const key = keys[e.code]; if (key && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); input.current[key] = true; } };
    const onUp = (e: KeyboardEvent) => { const key = keys[e.code]; if (key) input.current[key] = false; };
    const clear = () => { input.current = { ...idleInput }; };
    window.addEventListener('keydown', onDown); window.addEventListener('keyup', onUp); window.addEventListener('blur', clear);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); window.removeEventListener('blur', clear); clear(); };
  }, [!!state]);
  useEffect(() => {
    if (!state) return;
    let frame = 0;
    const render = () => { const ctx = canvas.current?.getContext('2d'); if (ctx && stateRef.current) draw(ctx, stateRef.current, player); frame = requestAnimationFrame(render); };
    frame = requestAnimationFrame(render); return () => cancelAnimationFrame(frame);
  }, [!!state, player]);
  const aim = (clientX: number, clientY: number) => {
    const rect = canvas.current?.getBoundingClientRect(); const pilot = stateRef.current?.pilots.find(p => p.id === player);
    if (!rect || !pilot) return;
    const x = (clientX - rect.left) * BULLET_RUN.width / rect.width - pilot.x;
    const y = (clientY - rect.top) * BULLET_RUN.height / rect.height - pilot.y;
    const length = Math.hypot(x, y) || 1;
    input.current.aimX = x / length; input.current.aimY = y / length;
  };
  const you = state?.pilots.find(p => p.id === player);
  return <main className="bullet-page">
    <header><Link to="/">← Main menu</Link><h1>Bullet Run</h1><p>Up to 24 pilots · Free for all</p></header>
    {error && <p role="alert" className="bullet-error">{error}</p>}
    {!multiplayerConfigured && <p role="status">Online play requires the arena connection.</p>}
    {!room ? <section className="bullet-lobby"><h2>Enter the arena</h2>
      <button disabled={busy || !multiplayerConfigured} onClick={() => void act('create')}>Create Bullet Run room</button>
      <form onSubmit={e => { e.preventDefault(); void act('join'); }}><label htmlFor="bullet-code">Room code</label>
        <input id="bullet-code" value={code} maxLength={6} minLength={6} required pattern="[A-Za-z0-9]{6}" onChange={e => setCode(e.target.value.toUpperCase())} />
        <button disabled={busy || !multiplayerConfigured}>Join room</button></form></section> : <>
      <section className="bullet-lobby"><strong>Room {room.code}</strong> · {room.members.length}/24 players
        <button onClick={() => void act('leave')} disabled={busy}>Leave room</button>
        <p role="status">{status}</p>
        {!state && <><label htmlFor="bullet-link">Invite link</label><input id="bullet-link" readOnly value={link} onFocus={e => e.currentTarget.select()} />
          <button onClick={() => void navigator.clipboard.writeText(link)}>Copy invite</button>
          <p>{room.members.map(m => m.display_name).join(' · ')}</p>
          {room.host_id === player ? <button disabled={room.members.length < 2 || !connected.current} onClick={start}>Start match</button> : <p>Waiting for the host to start...</p>}</>}
        {state && room.host_id === player && <button onClick={start} disabled={busy || room.members.length < 2}>Restart with current players</button>}
      </section>
      {state && <section className="bullet-match"><div className="bullet-hud"><span>Kills: {you?.kills ?? 0}</span><span>Deaths: {you?.deaths ?? 0}</span>
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
