# Shared room redesign

Owner direction: unify Bullet Run with Create Room, make a room the eventual
entry point for all play including Classic solo, and plan for Classic 2vE.

The initial clickable concept is `docs/lobby-mockup.html`. Its font, logo and
sprite placeholders are embedded into the downloadable HTML in this conversation's
dropoff folder. All participants and network states are simulated. Classic 2vE
is a future-mode preview, not implemented cooperative gameplay.

Flow: main menu → create/join → select mode → invite → ready → host launch →
match → return to the same room. Mode selection from the menu should preselect
the room mode. Solo Classic needs one ready pilot, co-op eventually needs two,
and Bullet Run needs at least two with capacity 24. Guests cannot change the
mode or launch. Mode changes reset readiness and must reject incompatible
rosters rather than silently remove players.

Visual direction: preserve the canonical red/yellow logo, Windows Bold font,
Classic ship sprites, dark arena, green actions, and room code. Show pilots as
a lineup with explicit host/guest and readiness labels. Mobile stacks mode
selection above the lineup and wraps the lineup into two columns. Large rosters
will need a compact roster view beyond the four featured slots in this concept.

The owner's screenshot shows a raw load error and a closed-room message while
still presenting invitations and waiting-for-host text. The UI must distinguish
recoverable connection errors from authoritative closure, hide launch/invite
actions on closure, and offer a clear new-room/menu path. A failed poll alone
must not be interpreted as room closure.

Implementation boundary: Classic's existing lobby RPC is a two-player duel;
Bullet Run has separate room tables/RPC and no persistent readiness field.
A shared visual shell can land first, but a genuinely mode-switchable online
room needs an explicit backend mode, capacity, readiness, membership and launch
contract. Classic 2vE additionally requires cooperative simulation and transport;
the existing competitive duel must not be presented as cooperative Classic.
Keep ranked awards disabled pending the trusted ranked backend.

## Local integration checkpoint

The shared Create Room chooser and solo ready gate are implemented locally.
Bullet Run now renders the complete room membership as responsive ship cards,
with host/guest labels and a local-player highlight. Interrupted connections
and closed rooms hide invite/start controls; interrupted connections retry.

Verified in this session: Pages production build, direct TypeScript compiler
(`node node_modules/typescript/bin/tsc --noEmit`), and desktop/mobile browser
checks for the chooser, solo launch gate, future 2vE label, connection recovery,
closed-room controls, and leaving a room. Multiplayer browser calls use fixtures.
The expanded 24-player roster regression also passed at 1440px and 390px,
including a long unbroken pilot name, local-player highlight, and no horizontal
overflow. Fixtures return fresh snapshots on each poll, matching network reads.

Classic Play now opens the solo room on desktop and mobile. Its fixture browser
checks passed at both sizes, including canceling readiness.

A local, unapplied migration (`202609270000_bullet_readiness.sql`) adds member
readiness and idempotent `ready` / `unready` actions to `bullet_lobby`. Each action
uses the authenticated identity, requires membership in an open room, and exposes
all ready flags in the room snapshot. Leaving and rejoining clears readiness.

The client now renders shared ready flags and Ready/Cancel controls. Missing
ready fields keep launch disabled and show a setup-pending message. The launch
RPC locks the room while checking authenticated host identity, open status,
minimum two pilots, and every current member's readiness. The client builds its
starting roster from the validated response and stays in the lobby on rejection.
Local database tests cover these checks, including readiness cancellation.

Verified: TypeScript, Pages build, database tests, and fixture browser checks
at 1440px and 390px passed, including readiness toggles and rejected/approved
host launches.

The round lifecycle below supersedes the initial snapshot-only launch. Shared
Bullet Run entry presentation remains unfinished. Existing realtime broadcasts still trust a claimed host ID,
so this is not an authoritative match transport or an anti-cheat boundary.
No online backend changes or publication have been performed.


## Round lifecycle update

The unapplied readiness migration now stores lobby/playing phase, match ID, and
starting roster. Launch freezes that roster and clears readiness; only the host
can return the room to lobby, clearing round data and all ready flags. Late joins
remain members but wait outside the active roster until the next round. Existing
members can reconnect during the round. Client broadcasts carry the match ID,
and clients reject snapshots outside the active round or for nonparticipants.
Polling responses that overlap a local mutation are discarded to avoid restoring
old lobby state after a launch or return. The host simulation still uses the
existing broadcast transport, whose claimed host identity is not authenticated.

Local database lifecycle tests, TypeScript, production build, and extended browser
checks at 1440px and 390px passed, including return/reset, late arrivals, and stale
snapshots after return. Shared entry presentation remains unfinished.


## Shared entry integration

Bullet Run is now embedded in RoomEntry, including its roster, ready controls,
round waiting state and arena. Its desktop/mobile Play buttons open that same
entry directly. Choose mode and dialog Close are locked during requests and
room membership; Leave room releases both. The dialog expands to fit the arena.
Standalone Bullet Run invite URLs still open the same BulletRun component.
Classic invite codes are passed only to the join panel, preventing a stale code
from selecting a duel when the owner next chooses Solo or Bullet Run.

TypeScript, final build, and expanded desktop/mobile checks passed. Screenshots
at 1440px and 390px were inspected. Fixed embedded Leave navigation to preserve
the menu URL, verified switching modes and reopening through Play.
No live migration or publication has occurred.


## Two-session verification

`scripts/test-room-sync.py` passed with separate desktop host and phone-sized
guest browser contexts. It replaces RPC and realtime with shared local fixtures;
the application still polls, broadcasts and renders through its normal code.
Two consecutive rounds passed shared readiness, guest snapshots, host return,
readiness reset and final host closure, with zero page errors. This does not
verify Supabase network transport, live migration compatibility, or live invites.
