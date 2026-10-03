/**
 * Ranked authoritative simulation server.
 *
 * This is the trusted process the ranked-service migration was written for
 * (see docs/ranked-server.md): it is the only thing allowed to call
 * ranked_match_start / ranked_settle, using service_role credentials that
 * must never reach a browser. Run it locally with `npm run ranked-server`
 * while testing with two real Discord accounts; nothing here is deployed
 * anywhere automatically.
 *
 * Requires Node 22+ (native WebSocket/fetch) and is run through tsx so it can
 * import the same pure game modules the client and tests use, unmodified.
 */
import { randomUUID } from "node:crypto";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { PlayerSeed } from "../src/game/classic/duel";
import { TICK_MS } from "../src/game/config";
import { RANKED_SNAPSHOT_INTERVAL_MS, RankedHost, isRankedPacket } from "../src/game/ranked-online";
import type { RankedFormat } from "../src/lib/ranked-rules";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DISCOVERY_INTERVAL_MS = 2000;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "[ranked-server] Missing SUPABASE_URL (or VITE_SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Set both in your shell before running `npm run ranked-server`. The service role key is\n" +
      "in the Supabase dashboard (Project Settings -> API) and must never be committed or shipped to the client.",
  );
  process.exit(1);
}

const SERVER_ID = process.env.RANKED_SERVER_ID ?? `local-${randomUUID().slice(0, 8)}`;
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Running = {
  host: RankedHost;
  channel: RealtimeChannel;
  lastFrame: number;
  accumulated: number;
  lastSend: number;
};
const running = new Map<string, Running>();
const claiming = new Set<string>();

async function subscribeChannel(channel: RealtimeChannel): Promise<boolean> {
  return new Promise((resolve) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve(true);
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED")
        resolve(false);
    });
  });
}

async function claim(matchId: string) {
  if (running.has(matchId) || claiming.has(matchId)) return;
  claiming.add(matchId);
  try {
    const { data, error } = await db.rpc("ranked_match_start", {
      p_match_id: matchId,
      p_server_id: SERVER_ID,
    });
    if (error || !data) return; // expired, already claimed elsewhere, or not yet pending
    const format = data.format as RankedFormat;
    const participants = (data.participants as { player_id: string; team: 0 | 1 }[] | null) ?? [];
    if (participants.length !== 2) return;
    const players: PlayerSeed[] = [...participants]
      .sort((a, b) => a.team - b.team)
      .map((p) => ({ id: p.player_id, name: p.team === 0 ? "WHITE" : "ORANGE", team: p.team }));
    const host = new RankedHost(matchId, players, format);
    const channel = db.channel(`ranked:${matchId}`, {
      config: { broadcast: { self: false, ack: false } },
    });
    channel.on("broadcast", { event: "pilot" }, ({ payload }) => {
      if (!isRankedPacket(payload) || payload.matchId !== matchId) return;
      host.receive(payload, Date.now());
    });
    const subscribed = await subscribeChannel(channel);
    if (!subscribed) {
      console.error(`[ranked-server] could not open the channel for ${matchId}; will retry claim`);
      await db.removeChannel(channel);
      return;
    }
    const now = Date.now();
    running.set(matchId, { host, channel, lastFrame: now, accumulated: 0, lastSend: 0 });
    console.log(
      `[ranked-server] hosting ${matchId} (${format === "1a" ? "stocks" : "rounds"} format, hidden from players)`,
    );
  } catch (cause) {
    console.error(`[ranked-server] claim failed for ${matchId}`, cause);
  } finally {
    claiming.delete(matchId);
  }
}

async function discover() {
  const { data: candidates, error } = await db
    .from("ranked_matches")
    .select("match_id, forfeit_player_id")
    .is("result", null);
  if (error) {
    console.error("[ranked-server] discovery query failed", error.message);
    return;
  }
  for (const row of candidates ?? []) {
    if (row.forfeit_player_id)
      running.get(row.match_id)?.host.requestForfeit(row.forfeit_player_id);
  }
  const ids = (candidates ?? [])
    .map((row) => row.match_id as string)
    .filter((id) => !running.has(id) && !claiming.has(id));
  if (ids.length === 0) return;
  const { data: matches, error: matchesError } = await db
    .from("matches")
    .select("id, status")
    .in("id", ids)
    .eq("status", "pending");
  if (matchesError) {
    console.error("[ranked-server] match status lookup failed", matchesError.message);
    return;
  }
  for (const row of matches ?? []) void claim(row.id as string);
}

async function settle(matchId: string, entry: Running) {
  const result = entry.host.result;
  if (!result) return;
  running.delete(matchId);
  const { error } = await db.rpc("ranked_settle", {
    p_match_id: matchId,
    p_server_id: SERVER_ID,
    p_winner: result.winner,
    p_loser_score: result.loserScore,
    p_disconnect: result.disconnect,
  });
  if (error) console.error(`[ranked-server] settle failed for ${matchId}: ${error.message}`);
  else console.log(`[ranked-server] settled ${matchId}`, result);
  await db.removeChannel(entry.channel);
}

function tickAll() {
  const now = Date.now();
  for (const [matchId, entry] of running) {
    const elapsed = Math.min(now - entry.lastFrame, 250);
    entry.lastFrame = now;
    entry.accumulated += elapsed;
    while (entry.accumulated >= TICK_MS) {
      entry.host.advance(now);
      entry.accumulated -= TICK_MS;
      if (entry.host.result) break;
    }
    if (now - entry.lastSend >= RANKED_SNAPSHOT_INTERVAL_MS) {
      entry.lastSend = now;
      void entry.channel.send({
        type: "broadcast",
        event: "state",
        payload: entry.host.snapshot(),
      });
    }
    if (entry.host.result) void settle(matchId, entry);
  }
}

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log(
    "[ranked-server] shutting down; unclaimed simulation state is discarded (no rating changes)",
  );
  clearInterval(discoveryTimer);
  clearInterval(tickTimer);
  for (const [, entry] of running) await db.removeChannel(entry.channel);
  process.exit(0);
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

console.log(`[ranked-server] starting as ${SERVER_ID} against ${SUPABASE_URL}`);
await discover();
const discoveryTimer = setInterval(() => void discover(), DISCOVERY_INTERVAL_MS);
const tickTimer = setInterval(tickAll, TICK_MS);
