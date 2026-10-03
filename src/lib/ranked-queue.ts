import { connection } from './multiplayer';

export type RankedQueueState = { status: 'idle' } | { status: 'waiting'; queued_at: string } | { status: 'matched'; match_id: string };
export type QueueAction = 'join' | 'poll' | 'leave';
export function parseQueueState(value: unknown): RankedQueueState {
  const data = value as Record<string, unknown> | null;
  if (data?.['status'] === 'idle') return { status: 'idle' };
  if (data?.['status'] === 'waiting' && typeof data['queued_at'] === 'string' && Number.isFinite(Date.parse(data['queued_at'])))
    return { status: 'waiting', queued_at: data['queued_at'] };
  if (data?.['status'] === 'matched' && typeof data['match_id'] === 'string' && /^[0-9a-f-]{36}$/i.test(data['match_id']))
    return { status: 'matched', match_id: data['match_id'] };
  throw new Error('Unable to read matchmaking status. Please retry.');
}
export async function rankedQueueAction(action: QueueAction, rounds = false): Promise<RankedQueueState> {
  const db = await connection();
  const { data: session, error: authError } = await db.auth.getSession();
  if (authError) throw authError;
  if (!session.session?.user.identities?.some(identity => identity.provider === 'discord'))
    throw new Error('Sign in with Discord through your player profile to play Ranked.');
  const { data, error } = await db.rpc(`ranked_queue_${action}`, action === 'join' ? { p_rounds: rounds } : {});
  if (error) throw new Error(error.code === 'PGRST202' ? 'Ranked matchmaking is unavailable. Please try again later.' : error.message);
  return parseQueueState(data);
}

/** Serialize requests so cancel cannot overtake an in-flight join or heartbeat. */
export class RankedQueueSession {
  private tail: Promise<void> = Promise.resolve();
  private stopped = false;
  constructor(private request: typeof rankedQueueAction, private update: (state: RankedQueueState) => void) {}
  action(action: QueueAction, rounds = false): Promise<void> {
    const operation = this.tail.then(async () => {
      if (this.stopped) return;
      const state = await this.request(action, rounds);
      if (!this.stopped) this.update(state);
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
  // Stop heartbeats on navigation/sign-out. The server expires waiting entries in 30s.
  stop() { this.stopped = true; }
}
