# Bullet Run readiness — release record

## Authorization
Owner authorized applying the readiness migration and publishing the updated
game on 2026-09-28.

## Database
Applied migration `bullet_readiness` (version 20260928150721) to Supabase
project `jtshieblptpxtkociseo` (Alien Force Multiplayer). Confirmed via
`list_migrations` that it now follows `20260926231400 bullet_run`. Advisor
scan after applying shows only the expected `RLS enabled, no policy` INFO
findings on `bullet_members`/`bullet_rooms`, consistent with the existing
`classic_lobby` pattern (access is gated through the SECURITY DEFINER RPC).
No new or unexpected findings.

## Source
Committed the readiness client/server work (`15ee9ed` locally, rebased onto
origin/main as `3853c23`) to `makaihurstjob-sys/alien-force-arena` branch
`main`. Rebase onto two unrelated upstream commits (Classic difficulty
rebalance, PR #3) had no file overlap. Full `build:pages` production build
passed after the rebase, before pushing.

## Publish
Ran `scripts/publish-pages.ps1 -PublishCheckout "../alien-force-public-release"`,
pushing compiled assets to `makaihurstjob-sys/alien-force-classic` (`9628406`).
GitHub Pages run `36441703480` completed successfully. Verified the public
site directly: `https://makaihurstjob-sys.github.io/alien-force-classic/`
returns HTTP 200 and serves `index-tcSAHPnB.js` / `index-0HPp29pt.css`,
matching the hashes from the local production build byte-for-byte.

## Live multiplayer verification — 2026-09-28
`python scripts/test-room-live.py` passed against the public GitHub Pages site
using two isolated browser contexts with distinct Supabase anonymous user IDs
(1440px desktop host and 390px guest). No RPC or Realtime mocks were used.

Verified two rounds: shared ready/cancel state, launch disabled while unready,
both arenas opening, advancing real Realtime snapshot ticks received by the
guest, host return to lobby, and readiness reset on both clients. The rematch
used a new match ID. Host closure reached the guest; no page errors occurred.
The host left the temporary test rooms, including after failed test attempts.
Anonymous test identities remain in Supabase Auth.

Initial harness attempts read guest authentication before join completion and
then omitted binary WebSocket messages. The final test waits for both players
and decodes Supabase's binary broadcast format. No game changes were needed.
This checks two anonymous identities in isolated contexts on one machine;
cross-device/network conditions and authenticated account flows were not tested.

## Shared Hangar first implementation ? 2026-09-28

Local implementation adds the full-screen Bullet Run hangar, smaller upper-left
wordmark, high tab-style game/room row, readiness controls, invite copying, and
four initial slots expanding to five and six as players join. Leave Room returns
to the launcher. Nested dialog close/cancel events are ignored by the parent so
closing the game selector preserves the lobby, focus, and readiness.

Validation: all 68 unit tests, direct local TypeScript compiler, production Pages
build, and local database migration tests passed. Desktop (1440px) and phone
(390px) browser checks cover readiness, selector dismissal, focus restoration,
4/5/6 slots, no horizontal overflow, and leaving. Screenshots are saved in the
conversation-a11aa5db2bb84b0ca911c6f23478d060 attachment folder.
The local frontend also passed two rounds with two independent real Supabase
anonymous players: ready/cancel sync, launch, advancing guest Realtime snapshots,
rematch reset/new match ID, and host closure; no page errors. Temporary rooms
were closed; test anonymous identities remain.

Not published. The six-player capacity migration is prepared and tested locally,
but has not been applied remotely. Classic choices remain disabled in the game
selector: changing games while retaining the room roster still requires shared
room backend work. This is a first Bullet Run lobby implementation, not completed
cross-mode switching. Existing rooms with more than six members remain visible
for compatibility until closed.
