import { connection } from './multiplayer';
export type BulletLobby = { id: string; code: string; host_id: string; status: 'open' | 'closed'; members: { player_id: string; display_name: string }[] };
export async function bulletLobby(action: 'create' | 'join' | 'get' | 'leave', code = ''): Promise<BulletLobby | null> {
  const db = await connection();
  const { data: session, error: sessionError } = await db.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session.session) {
    const { error } = await db.auth.signInAnonymously();
    if (error) throw new Error('Guest access is unavailable. Bullet Run rooms need anonymous sign-in.');
  }
  const { data, error } = await db.rpc('bullet_lobby', { p_action: action, p_code: code.trim().toUpperCase() });
  if (error) throw new Error(error.code === 'PGRST202' ? 'Bullet Run database setup is pending.' : error.message);
  return data as BulletLobby | null;
}
