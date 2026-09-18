import { CLASSIC, moveActor, vectors, type Direction } from './engine';
import { PVP_RULES, TICK_MS } from '../config';
import type { GameState, PlayerInput } from '../types';

export type PlayerSeed = { id: string; name: string; team: number };
const directions: Direction[] = ['right', 'down', 'left', 'up'];
export const directionFromAngle = (angle: number): Direction =>
  directions[((Math.round(angle / (Math.PI / 2)) % 4) + 4) % 4]!;

function spawn(state: GameState, players: PlayerSeed[]) {
  const previous = new Map(state.ships.map(s => [s.id, s]));
  state.ships = players.map(p => ({
    ...p, x: CLASSIC.margin + (p.team % 2 === 0 ? 0 : CLASSIC.cells * CLASSIC.spacing),
    y: CLASSIC.margin + (p.team < 2 ? CLASSIC.cells * CLASSIC.spacing : 0),
    angle: p.team % 2 === 0 ? 0 : Math.PI, vx: 0, vy: 0,
    alive: true, canFire: true, shots: previous.get(p.id)?.shots ?? 0,
    hits: previous.get(p.id)?.hits ?? 0,
  }));
}
export function createMatch(players: PlayerSeed[]): GameState {
  const state: GameState = { tick: 0, phase: 'countdown',
    phaseTimerMs: PVP_RULES.countdownSeconds * 1000, ships: [], projectiles: [],
    round: 1, score: [0, 0, ...Array.from({ length: Math.max(0, ...players.map(p => p.team - 1)) }, () => 0)], lastRoundWinner: null, matchWinner: null, events: [] };
  spawn(state, players);
  return state;
}
export function startRound(state: GameState, players: PlayerSeed[]) {
  state.projectiles = [];
  state.phase = 'countdown';
  state.phaseTimerMs = PVP_RULES.countdownSeconds * 1000;
  state.lastRoundWinner = null;
  state.round++;
  spawn(state, players);
}

/** Classic's lane movement and shot physics, with two human pilots and round scoring. */
export function step(state: GameState, inputs: Record<string, PlayerInput>) {
  state.tick++;
  state.events = [];
  state.phaseTimerMs = Math.max(0, state.phaseTimerMs - TICK_MS);
  if (state.phase !== 'playing') {
    if (state.phase === 'countdown' && state.phaseTimerMs === 0) {
      state.phase = 'playing';
      state.phaseTimerMs = PVP_RULES.roundTimeLimitSeconds * 1000;
    }
    return;
  }
  for (const ship of state.ships) {
    if (!ship.alive) continue;
    const input = inputs[ship.id];
    const actor = { id: ship.team, x: ship.x, y: ship.y, direction: directionFromAngle(ship.angle) };
    const reverseNow = !!input?.turnaround && !ship.turnaroundHeld;
    ship.turnaroundHeld = !!input?.turnaround;
    if (reverseNow) actor.direction = directions[(directions.indexOf(actor.direction) + 2) % 4]!;
    const wanted = input?.thrust ? 'up' : input?.reverse ? 'down' : input?.left ? 'left' : input?.right ? 'right' : null;
    moveActor(actor, reverseNow ? null : wanted, CLASSIC.playerSpeed * TICK_MS / 1000);
    ship.x = actor.x;
    ship.y = actor.y;
    ship.angle = directions.indexOf(actor.direction) * Math.PI / 2;
    if (input?.fire && ship.canFire) {
      const [dx, dy] = vectors[actor.direction];
      state.projectiles.push({ id: `${state.round}:${state.tick}:${ship.id}`, ownerId: ship.id,
        team: ship.team, x: ship.x, y: ship.y, vx: dx * CLASSIC.bulletSpeed,
        vy: dy * CLASSIC.bulletSpeed, ageMs: 0 });
      ship.canFire = false;
      ship.shots++;
      state.events.push({ type: 'shot', playerId: ship.id, tick: state.tick });
    }
  }
  // Resolve all shots against the same live roster so simultaneous hits are a draw.
  const eliminated = new Set<string>();
  state.projectiles = state.projectiles.filter(shot => {
    shot.ageMs += TICK_MS;
    for (let remaining = CLASSIC.bulletSpeed * TICK_MS / 1000; remaining > 0; remaining -= 2) {
      const distance = Math.min(2, remaining);
      shot.x += shot.vx / CLASSIC.bulletSpeed * distance;
      shot.y += shot.vy / CLASSIC.bulletSpeed * distance;
      if (shot.x < 0 || shot.y < 0 || shot.x > CLASSIC.size || shot.y > CLASSIC.size) return false;
      const target = state.ships.find(s => s.alive && s.id !== shot.ownerId && Math.hypot(s.x - shot.x, s.y - shot.y) < 9);
      if (target) {
        eliminated.add(target.id);
        const owner = state.ships.find(s => s.id === shot.ownerId)!;
        owner.hits++;
        state.events.push({ type: 'hit', playerId: owner.id, targetId: target.id, tick: state.tick },
          { type: 'elimination', playerId: target.id, byId: owner.id, tick: state.tick });
        return false;
      }
    }
    return true;
  });
  for (let i = 0; i < state.ships.length; i++) {
    for (let j = i + 1; j < state.ships.length; j++) {
      const a = state.ships[i]!, b = state.ships[j]!;
      if (a.alive && b.alive && Math.hypot(a.x - b.x, a.y - b.y) < 12) {
        eliminated.add(a.id); eliminated.add(b.id);
      }
    }
  }
  for (const ship of state.ships) {
    if (eliminated.has(ship.id)) ship.alive = false;
    ship.canFire = !state.projectiles.some(p => p.ownerId === ship.id);
  }
  const alive = state.ships.filter(s => s.alive);
  if (alive.length > 1 && state.phaseTimerMs > 0) return;
  const winner = alive.length === 1 ? alive[0]!.team : null;
  state.phase = 'round_over';
  state.phaseTimerMs = 2000;
  state.lastRoundWinner = winner;
  if (winner !== null) {
    state.score[winner] = (state.score[winner] ?? 0) + 1;
    if (state.score[winner]! >= PVP_RULES.roundsToWinMatch) state.matchWinner = winner;
  }
  state.events.push({ type: 'round_end', winningTeam: winner, tick: state.tick });
}
