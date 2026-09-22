import { useEffect, useRef, useState } from 'react';
import { createRankedMatch, stepRankedMatch } from '@/game/classic/ranked-duel';
import { renderClassicDuel } from '@/game/classic/duel-render';
import { EMPTY_INPUT, type PlayerInput } from '@/game/types';
import { RANKED_FORMATS, type RankedFormat } from '@/lib/ranked-rules';
import { ShipIcon } from './ShipIcon';

const players = [{ id: 'white', name: 'White', team: 0 as const }, { id: 'orange', name: 'Orange', team: 1 as const }];
const controls: Record<string, [string, keyof PlayerInput]> = {
  KeyW: ['white', 'thrust'], KeyS: ['white', 'reverse'], KeyA: ['white', 'left'], KeyD: ['white', 'right'], KeyF: ['white', 'fire'], KeyR: ['white', 'turnaround'],
  ArrowUp: ['orange', 'thrust'], ArrowDown: ['orange', 'reverse'], ArrowLeft: ['orange', 'left'], ArrowRight: ['orange', 'right'], Slash: ['orange', 'fire'], Period: ['orange', 'turnaround'],
};

export default function RankedExperiment() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const match = useRef(createRankedMatch(players, '1a'));
  const inputs = useRef<Record<string, PlayerInput>>({ white: { ...EMPTY_INPUT }, orange: { ...EMPTY_INPUT } });
  const [format, setFormat] = useState<RankedFormat>('1a');
  const [running, setRunning] = useState(false);
  const [hud, setHud] = useState({ stocks: [4, 4], result: '' });
  const resetInputs = () => { inputs.current = { white: { ...EMPTY_INPUT }, orange: { ...EMPTY_INPUT } }; };
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    let raf = 0, last = performance.now(), accumulator = 0;
    const frame = (now: number) => {
      accumulator += Math.min(250, now - last); last = now;
      if (running) while (accumulator >= 1000 / 60) {
        stepRankedMatch(match.current, inputs.current); accumulator -= 1000 / 60;
      }
      else accumulator = 0;
      renderClassicDuel(ctx, match.current.game);
      const m = match.current;
      const result = m.draw ? 'Draw — no rating change' : m.game.matchWinner !== null ? `${m.game.matchWinner === 0 ? 'White' : 'Orange'} wins` : '';
      setHud(previous => previous.stocks[0] === m.stocks[0] && previous.stocks[1] === m.stocks[1] && previous.result === result ? previous : { stocks: [...m.stocks], result });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  function restart(next: RankedFormat) {
    match.current = createRankedMatch(players, next); setFormat(next); resetInputs();
    setRunning(true); canvas.current?.focus();
  }
  return <details className="ranked-experiment" onToggle={event => { if (!event.currentTarget.open) { setRunning(false); resetInputs(); } }}>
    <summary>Try ranked formats · local two-player test</summary>
    <p>No ranked points. Two players share a keyboard.</p>
    <div className="ranked-experiment-actions">{(['1a', '1b'] as const).map(id => <button key={id} aria-pressed={format === id} onClick={() => restart(id)}>{RANKED_FORMATS[id].name}</button>)}</div>
    <p>{RANKED_FORMATS[format].description}</p>
    <div className="ranked-stock-hud">{['White', 'Orange'].map((name, team) => <div key={name} aria-label={`${name}: ${hud.stocks[team]} lives`}><strong>{name}</strong><span aria-hidden="true">{Array.from({ length: hud.stocks[team]! }, (_, i) => <ShipIcon key={i} size={20} />)}</span></div>)}</div>
    <canvas ref={canvas} width={424} height={424} tabIndex={0} aria-label="Local ranked test arena. White uses WASD, F to fire, R to reverse. Orange uses arrows, slash to fire, period to reverse."
      onFocus={() => setRunning(true)} onBlur={() => { setRunning(false); resetInputs(); }}
      onKeyDown={event => { const key = controls[event.code]; if (key) { event.preventDefault(); event.stopPropagation(); inputs.current[key[0]]![key[1]] = true; } }}
      onKeyUp={event => { const key = controls[event.code]; if (key) { event.preventDefault(); event.stopPropagation(); inputs.current[key[0]]![key[1]] = false; } }} />
    <p>White: WASD · F fire · R reverse<br />Orange: Arrow keys · / fire · . reverse</p>
    <p role="status">{hud.result || (running ? 'Local test in progress' : 'Paused — focus the arena to play')}</p>
  </details>;
}
