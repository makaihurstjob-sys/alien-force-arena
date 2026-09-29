import { connection } from './multiplayer';
import type { BulletLobby } from './bullet-lobby';
import type { LobbyMode } from './lobby-modes';

export type GameLobby = BulletLobby & { mode: LobbyMode };
export type RoomAction = 'create' | 'join' | 'get' | 'leave' | 'ready' | 'unready' | 'launch' | 'return' | 'mode';

export async function gameLobby(action: RoomAction, code = '', mode: LobbyMode = 'bullet'): Promise<GameLobby | null> {
  const db = await connection();
  const { data: session, error: sessionError } = await db.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session.session) {
    const { error } = await db.auth.signInAnonymously();
    if (error) throw new Error('Guest access is unavailable. Please try again.');
  }
  const { data, error } = await db.rpc('game_lobby', { p_action: action, p_code: code.trim().toUpperCase(), p_mode: mode });
  if (error) throw new Error(error.message);
  return data as GameLobby | null;
}

// Keep the existing preview usable until the additive backend migration is applied.
export async function sharedRoomsAvailable() {
  const db = await connection();
  const { error } = await db.rpc('game_lobby', { p_action: 'get', p_code: '', p_mode: 'bullet' });
  if (!error) return true;
  if (error.code === 'PGRST202') return false;
  if (error.code === 'P0001' || error.code === '42501') return true;
  throw new Error('Unable to check room service. Please try again.');
}
