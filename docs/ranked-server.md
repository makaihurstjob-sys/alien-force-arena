# Ranked database service

Migration: `supabase/migrations/202610010000_ranked_service.sql`.
Validation: `npm run test:ranked-db` (disposable PGlite PostgreSQL).

## Scope and deployment

This phase implements queue pairing, reserved match participants, trusted-server assignment,
and rating settlement. The browser now connects to join/poll/leave through the existing
Discord session. It does not start a physics server, measure network latency, or enable
playable online Ranked matches. The prior session reported this migration deployed to
Alien Force Multiplayer; deployment was not independently verified in this client pass.

Apply after the two core Drizzle migrations. This migration does not depend on shared-room
SQL. Ranked assignments have no browser-hosted room: `match_participants` holds the two
server-assigned seats. Legacy demo Elo remains separate from zero-based preseason
`ranked_players` records. The migration revokes direct client queue insert/update access
because those writes allow forged ratings/timestamps. Lobby RPCs use separate tables;
a future casual queue also needs a validated RPC.

## Browser contract

- Discord-linked users call `ranked_queue_join(p_rounds boolean default false)`.
- Poll `ranked_queue_poll()` about every five seconds. Waiting entries expire after 30
  seconds without a heartbeat. Rejoin after expiry; repeated join preserves wait/preference.
- `ranked_queue_leave()` cancels waiting entries. After pairing it returns the existing
  match, so browsers cannot cancel an assignment to dodge an opponent.
- Responses contain `status: idle | waiting | matched`, plus `queued_at` while waiting
  or `match_id` after pairing. No format is returned.
- Discord eligibility comes from `auth.identities`, not editable profile metadata.

Initial tuning: fixed 300-point maximum gap; nearest rating, oldest queue entry, then UUID.
The gap never widens. Both opted-in players get rounds first. Mixed pairs wait the opted-in
player's full ten seconds and get stocks. Both preferences off use a single random draw:
below 0.8 means stocks, otherwise rounds. Change preferences by leaving and rejoining.
Region `unassigned` and latency zero are placeholders, not measurements; regional placement
belongs to the future simulation allocator.

## Trusted server contract

Using service-role credentials, call `ranked_match_start(match_id, server_id)` within two
minutes of pairing. It returns format and participants. Repeated claims by the same server
are safe; another server cannot reclaim it. Never distribute service credentials to browsers.
Server IDs check assignment consistency; they are not independent credentials.

Only trusted simulation calls `ranked_settle(match_id, server_id, winner smallint,
loser_score integer, disconnect boolean default false)`. Winner is team 0 or 1 and losing
score is 0–3. Simultaneous final-stock draws use NULL winner, score 0, disconnect false;
rounds cannot draw. Disconnects forfeit immediately using maximum margin.

Settlement atomically writes history, actual rating changes, peak, wins/losses/draws,
signed streak, and disconnect state. Math matches `src/lib/ranked-rules.ts`: zero start,
21–39 nominal change, division grace below 1500, uncapped rating, and 5/15/30-minute
cooldowns from the third/fourth/fifth rapid disconnect. Normal completion resets the
disconnect streak. Identical result retries return the stored result; conflicting retries
fail. Legacy `complete_match` cannot settle Ranked matches through demo Elo.

Unclaimed assignments expire during the next queue operation without rating changes.
Live games require trusted settlement, including disconnects. A crashed-server recovery
worker remains necessary before enabling live Ranked.

## Concurrency and release gates

Queue changes, claims, and settlements share one transaction advisory lock. This prevents
overlapping matches and double settlement, at the cost of throughput. Partition only after
load testing equivalent invariants. PGlite tests execute PostgreSQL SQL but use a single
connection; they do not establish independent-connection contention behavior.

Before enabling Ranked: test concurrent join/poll/leave/settlement on hosted PostgreSQL,
deploy authoritative simulation and crash recovery, wire the client, and test two real
Discord sessions. Public standings and the deterministic Legend tie rule remain separate.

## Browser queue implementation

`src/components/RankedQueue.tsx` replaces the local experiment on the Ranked screen.
Discord users can join with the saved Rounds preference and cancel while waiting.
Polling every five seconds restores existing queue/assignment state after a reload;
requests are serialized so cancellation follows pending joins. The matched response
from leave is preserved. No format is read or displayed, and no local simulation or
client rating settlement starts. Expired entries return to idle for explicit rejoin.

Navigation/sign-out stops polling; waiting entries expire after 30 seconds without
heartbeats. Unclaimed matches expire after two minutes via a subsequent queue call.
Network failures show an error and polling retries. Settings lock until the queue
returns idle. The UI labels this as a matchmaking preview while simulation is pending.

Validation: client contract/lifecycle unit tests plus existing tests, TypeScript and
Pages build. Two authenticated Discord sessions and hosted concurrency testing are
still required to verify the live flow; no live match was created in this pass.

## Authoritative simulation server

`scripts/ranked-server.ts` is the trusted process this migration was written for. It is
the only thing that ever calls `ranked_match_start` / `ranked_settle`; it runs locally
under `tsx` (no build step) and is not deployed anywhere by this change.

`src/game/ranked-online.ts` adapts the same pure `classic/ranked-duel.ts` logic the
local Ranked experiment used into a trusted host (`RankedHost`), the ranked analogue of
`online.ts`'s `DuelHost`: it owns the simulation, tracks per-player staleness with a
30-second forfeit timeout, and only ever produces a `RankedResult` through gameplay
(win, draw, or disconnect) — never from a client message. Tested in
`src/game/ranked-online.test.ts` (pairing, forfeit attribution, 1A/1B natural wins,
simultaneous-draw, mutual pause never forfeiting, malformed-wire rejection).

The server loop: poll `ranked_matches` for unclaimed rows every 2 seconds, claim pending
ones via `ranked_match_start`, open a `ranked:{matchId}` Realtime broadcast channel,
advance the match on a fixed 1/60s accumulator (immune to `setInterval` drift), broadcast
a snapshot every 50ms, and call `ranked_settle` the instant a result exists. Snapshots
never include the format; only score, round, and respawn behavior do, same as the design
note above.

### Running it locally for a two-Discord-account test

1. Node 22+ (native `fetch`/`WebSocket`; checked with `node --version`).
2. In the Supabase dashboard for **Alien Force Multiplayer**: Project Settings → API →
   copy the **service_role** key. This key bypasses RLS — keep it out of git, out of the
   browser, and out of anywhere the Pages build reads from.
3. In the project root:
   ```
   SUPABASE_URL=https://jtshieblptpxtkociseo.supabase.co SUPABASE_SERVICE_ROLE_KEY=<paste> npm run ranked-server
   ```
   (`VITE_SUPABASE_URL` from `.env` also works in place of `SUPABASE_URL`.) You should see
   `[ranked-server] starting as local-xxxxxxxx ...`.
4. Sign into the live site as two different Discord accounts (two browser profiles, or one
   normal + one private window), open Ranked on both, and click **Find match** on both
   within the 300-rating-gap / Rounds-preference window described above.
5. Within a couple of seconds the terminal logs `hosting <matchId> (... format, hidden
   from players)` and both browsers drop into the live arena. Play it out; the terminal
   logs `settled <matchId> { winner, loserScore, disconnect }` once it ends, and both
   clients show Victory/Defeat/Draw with no format ever named.
6. Ctrl+C stops the server. Any match still in progress is abandoned without a rating
   change — it is not a clean forfeit, just a dropped process; rerun the server before
   starting the next test.

### Still not done

No deployment target for this server (it is meant to be run by hand for now), no
crash-recovery worker for a server that dies mid-match (docs above already called this
out as a prerequisite for *enabling* Ranked, not just building it), no load/concurrency
testing of multiple simultaneous ranked matches against hosted Postgres, and no completed two-account live test yet. Public standings and the Legend tie rule remain
separate, as before.

## Explicit forfeit (2026-10-03)

Apply `supabase/migrations/202610030000_ranked_forfeit.sql` before running the updated
server. The Forfeit match button confirms the loss and calls `ranked_forfeit(match_id)`.
This authenticated RPC derives the requesting player from `auth.uid()`, verifies the
live Ranked participant, and records the first request. The server reads it every two
seconds and settles via the existing disconnect result path, including cooldown rules.
Clients cannot choose a winner or send a forfeit on behalf of the opponent.

On Windows, create the git-ignored `.env.ranked-server` in the project root:

```
SUPABASE_URL=https://jtshieblptpxtkociseo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<private service role key>
```

Then run `npm run ranked-server`. This dedicated file is loaded only by the server
command; never use a VITE-prefixed variable for a service key. Test one played match,
one explicit forfeit, and one tab-close timeout with two Discord accounts. Confirm
both clients return to matchmaking and the server reports successful settlement.

Known transport limitation: existing public Realtime broadcasts do not authenticate
the claimed pilot or snapshot sender. The new forfeit RPC authenticates its caller,
but competitive release still needs authenticated gameplay transport.
