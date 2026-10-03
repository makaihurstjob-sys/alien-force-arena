import { describe, expect, it, vi } from 'vitest';
vi.mock('./multiplayer', () => ({ connection: vi.fn() }));
import { connection } from './multiplayer';
import { parseQueueState, rankedQueueAction, RankedQueueSession } from './ranked-queue';
const match = { status: 'matched' as const, match_id: '12345678-1234-1234-1234-123456789012' };
describe('Ranked client queue', () => {
  it('accepts only usable responses and discards hidden fields', () => {
    expect(parseQueueState({ ...match, format: '1b' })).toEqual(match);
    expect(() => parseQueueState({ status: 'waiting', queued_at: 'bad' })).toThrow();
    expect(() => parseQueueState({ status: 'matched' })).toThrow();
    expect(() => parseQueueState(null)).toThrow();
  });
  it('sends only the preference on join and preserves matched cancellation', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: match, error: null });
    vi.mocked(connection).mockResolvedValue({ auth: { getSession: async () => ({ data: { session: { user: { identities: [{ provider: 'discord' }] } } } }) }, rpc } as never);
    expect(await rankedQueueAction('join', true)).toEqual(match);
    expect(rpc).toHaveBeenCalledWith('ranked_queue_join', { p_rounds: true });
    expect(await rankedQueueAction('leave')).toEqual(match);
    expect(rpc).toHaveBeenLastCalledWith('ranked_queue_leave', {});
  });
  it('rejects guests without creating anonymous identities or queue entries', async () => {
    const rpc = vi.fn();
    vi.mocked(connection).mockResolvedValue({ auth: { getSession: async () => ({ data: { session: null } }) }, rpc } as never);
    await expect(rankedQueueAction('join')).rejects.toThrow('Discord');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('serializes cancellation behind a pending join', async () => {
    let finish!: (value: { status: 'idle' }) => void;
    const request = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(match);
    const update = vi.fn();
    const queue = new RankedQueueSession(request, update);
    const join = queue.action('join');
    const leave = queue.action('leave');
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(1);
    finish({ status: 'idle' });
    await Promise.all([join, leave]);
    expect(request.mock.calls.map(call => call[0])).toEqual(['join', 'leave']);
    expect(update).toHaveBeenLastCalledWith(match);
  });
  it('recovers after failures and ignores late responses after disposal', async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(match);
    const update = vi.fn();
    const queue = new RankedQueueSession(request, update);
    await expect(queue.action('poll')).rejects.toThrow('offline');
    await queue.action('poll');
    expect(update).toHaveBeenCalledWith(match);
    update.mockClear();
    const pending = queue.action('join');
    queue.stop();
    await pending;
    expect(request).toHaveBeenCalledTimes(2);
    expect(update).not.toHaveBeenCalled();
  });
});
