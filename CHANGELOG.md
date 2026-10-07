# Changelog

## 2026-10-07

- Keep the lobby invite link visible and stationary when copying; remove the extra copied message.
- Add a mint-and-dark-green room QR code above the invite link for mobile scanning.

Patch notes for Alien Force Arena, newest first. Grouped by theme/date rather than
one line per commit — see `git log` for the exact commit history. When shipping a
notable update, add a new dated section at the top of this file.

## 2026-10-03 - Ranked points and responsive controls

- Show saved personal rank, rating, record, and peak in the lobby and ratings screen.
- Results show the server-saved point change, before/after rating, and division changes;
  pending settlement is shown honestly rather than estimating or awarding browser points.
- Fixed input handlers resetting whenever a match snapshot arrived. Changed inputs now
  send on the next animation frame, with idle heartbeats every 250ms.

## 2026-10-03 - Restore Ranked hangar controls

- Removed the separate Ranked matchmaking panel from the lobby.
- Restored pilot Ready buttons and the existing Start match button. Ready enables
  Start for that pilot; Start joins public Ranked matchmaking, and the same button
  cancels a waiting search. Queue status uses the existing lobby status line.
- Preserved Discord eligibility, saved Rounds preference, and authoritative matches.

## 2026-10-03 - Ranked lobby entry and Join Room

- Connected the main-menu Ranked lobby to authenticated public matchmaking with
  Ready up / Find match, cancellation, and full-screen authoritative gameplay.
  Each player enters the queue separately; two room occupants are not required.
- Selecting a game now updates an existing host-owned idle room to that mode,
  fixing stale solo rooms with a one-pilot limit when opening Ranked.
- Added Join Room inside the shared lobby. Room-code switching is transactional:
  invalid, closed, full, or playing destinations preserve the current membership.
  Successful switches leave the old room and close it if the switching player hosts it.

## 2026-10-03 - Ranked forfeit and deterministic Arcade tests

- Added a confirmed Forfeit match button. An authenticated database request identifies
  the signed-in participant; the trusted server credits the opponent and settles the
  loss with the existing disconnect penalty rules. First request wins; retries are safe.
- Fixed Arcade test randomness by passing a fixed center-lane RNG to the existing
  simulation API, preventing unrelated pickups from replacing test buffs.
- Ranked server can load ignored `.env.ranked-server` credentials on startup.
- Two-account live testing still requires private server credentials and Discord sessions.

## 2026-10-03 — Ranked goes live: authoritative game server

- Added the trusted ranked-server process (`scripts/ranked-server.ts`, run via
  `npm run ranked-server`): it claims matched Ranked games, hosts the match over a
  Supabase Realtime channel, and is the only thing allowed to report a result
  (win, draw, or disconnect forfeit). Never trusts the browser for outcomes.
- Added `src/game/ranked-online.ts` (`RankedHost`) — the server-side simulation
  owner, with a 30-second per-player disconnect timeout that credits the correct
  opponent, and full test coverage (`ranked-online.test.ts`).
- Added `RankedMatchView` / `useRankedMatch` so the Ranked screen now drops
  players straight into a live match the instant they're paired — no separate
  "waiting for server" placeholder anymore.
- Merged in Elvis's Arcade power-up mode (see below) onto this branch; verified
  no conflicts and all 112 tests + typecheck + production build still pass together.
- Still open: no in-match forfeit button (closing the tab reaches the same
  30-second timeout instead), no deployment target for the server itself (run it
  by hand for now), and no load-tested concurrent-match handling yet.

## 2026-09-29 — Ranked matchmaking policy (format hidden from players)

- Added a Rounds preference toggle to Ranked settings, off by default.
  - **Off:** weighted random draw, 80% Stocks / 20% Rounds.
  - **On:** prefers a Rounds opponent near your rank; falls back to Stocks after
    a 10-second wait if no one suitable is queued.
  - The matched format is never shown anywhere in the UI — it's only visible
    through how the match actually plays (respawn behavior vs. round resets).
- Added the `ranked_queue_join/poll/leave`, `ranked_match_start`, and
  `ranked_settle` database functions (Supabase migration), enforcing: Discord-only
  entry, server-only rating writes, the 10-second Rounds fallback, duplicate-result
  protection, division-grace rating floor, and escalating disconnect cooldowns.
- Wired the Ranked screen to the live queue (Discord-only entry, 5-second polling,
  cancel, and reload recovery) in place of the earlier local two-player keyboard test.

## 2026-09-29 – 10-01 — Arcade mode (power-ups)

- Added Arcade: Classic duel physics plus 5 power-ups, wired into the online
  Shared Hangar as a real 1v1 room mode.
- Fixed duel turn buffering so a quick direction tap isn't lost if the key is
  released a tick early (applies to Classic duel generally, not just Arcade).

## 2026-09-28 – 29 — Shared Hangar and Classic polish

- Shipped the first Shared Hangar lobby (every home game mode routes through one
  shared room flow) with mode switching and a legacy-service fallback.
- Classic: safer respawns near death, waits for movement before progressing,
  preserves enemy waves across a respawn.
- Hangar UI: equal player panels, animated lobby logo, Discord profile icon,
  animated "Leave Room" back to the main menu.

## 2026-09-22 – 27 — Bullet Run, Classic scaling, early Ranked rules

- Built Bullet Run: a free-for-all arena mode for up to 24 players, with its own
  weapon-progression curve, then gave it shared readiness and host-launch
  validation inside the room dialog.
- Scaled Classic difficulty smoothly through level 999 and rebalanced drone armor
  (ten drones per wave).
- Implemented the first preseason rating rules (zero start, division grace,
  bounded 21–39 delta) and a local two-player Ranked format experiment, before any
  of it was connected to a live queue.

## 2026-09-16 – 18 — First online multiplayer, Classic records, Ranked UI shell

- Shipped the first playable online 1v1 duel (recovery + rematches), using
  Classic's lane gameplay and original sprite style.
- Published the arena app to GitHub Pages with a repeatable release process.
- Added Classic player records, profile flags, a Ranked standings menu card, and
  approved rank names with color swatches.

## 2026-09-08 – 10 — Project start

- Initial scaffold, Classic mode design, and the first GitHub Pages packaging of
  the shared Classic game.
