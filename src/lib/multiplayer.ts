import { type SupabaseClient } from "@supabase/supabase-js";

export type RoomMode = "1v1" | "ffa";
export type Lobby = {
  mode?: RoomMode;
  max_players?: number;
  id: string;
  code: string;
  host_id: string;
  status: string;
  members: { player_id: string; display_name: string; is_ready: boolean; team: number }[];
};
const url = import.meta.env["VITE_SUPABASE_URL"];
const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
export const multiplayerConfigured = Boolean(url && key);
let client: Promise<SupabaseClient> | undefined;
export async function connection() {
  if (!multiplayerConfigured) throw new Error("Online rooms are not connected yet.");
  return (client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(url, key, {
      auth: { storageKey: "alien-force-multiplayer", persistSession: true },
    }),
  ));
}
export async function lobbyAction(
  action: "create" | "join" | "get" | "ready" | "leave",
  code = "",
  ready = false,
  mode: RoomMode = "1v1",
): Promise<Lobby | null> {
  const db = await connection();
  const { data: session, error: sessionError } = await db.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session.session) {
    const { error } = await db.auth.signInAnonymously();
    if (error) throw new Error("Guest access is unavailable. Online room setup is still pending.");
  }
  const { data, error } = await db.rpc("classic_lobby", {
    p_action: action,
    p_code: code.trim().toUpperCase(),
    p_ready: ready,
    ...(action === "create" && mode === "ffa" ? { p_mode: mode } : {}),
  });
  if (error) {
    if (error.code === "PGRST202") throw new Error("Online room setup is still pending.");
    throw new Error(error.message);
  }
  return data as Lobby | null;
}
export async function lobbyPlayerId() {
  return (await (await connection()).auth.getSession()).data.session?.user.id;
}
