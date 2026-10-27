# Adventure and squad lobby review

The main menu and shared lobby center your drone between invitation slots. The new lightweight CSS 3D preview rotates with mouse drag, touch drag, or arrow keys (Home resets). It is a lobby preview, not a replacement for the existing gameplay sprites. Friends join through the existing room code, copied invitation link, or optional QR code. This does not introduce persistent friend accounts, requests, or a friends list.

## Gameplay

- The displayed solo mode is **Adventure**. All new games start at level 1. The level selector and Options menu are absent from Adventure; the existing automatic progression and difficulty curve continue through 999. Internal `solo`, `classic_runs` and `/classic` identifiers stay compatible with existing rooms, links and records. Historic custom-start records remain history-only.
- Arcade accepts 2–4 pilots. The stable server roster order assigns alternating White / Orange seats: host and third arrival are White, second and fourth are Orange. Four pilots play 2v2; three play 2v1. No friendly fire or allied collision eliminations. A round ends after one team has no survivors (or a timeout); the existing first-to-three scoring remains.
- All four peers must connect before launch. Pause, reconnect timeout, match snapshots and unanimous rematch voting operate across the full roster. A missing peer pauses everyone. Either team can return the room to the lobby.
- Only your own and allied overhead tags are rendered in Arcade; enemy tags are hidden. Bullet Run is free-for-all, so it displays only your own overhead tag. Names remain in room rosters and match summaries; this is a visual rule, not data secrecy.
- Shared joystick controls cover Adventure, Arcade, Versus and Practice. Bullet Run uses the same joystick plus its Fire button. Pointer capture supports sliding direction changes outside the stick; release, cancellation, lost capture, blur and backgrounding clear input. Movement remains four-directional where the game requires lane movement.

## Fixes

Freeze shots now resolve their own nonlethal projectile hit instead of globally protecting an opponent against other shooters. Frozen pilots cannot teleport out of a stun. Multiplayer collision and round scoring consider every ship, not only the first two. Arcade history lists the opposing team rather than accidentally naming an ally as the opponent. The main Play button opens the selected game directly.

## Validation and rollout

- `npm test`: 124 passing tests, including four-pilot spawns, team collisions, victory, freeze interactions, full-roster snapshots and missing-peer pause.
- `node scripts/test-arcade-room-db.mjs`: local PGlite checks capacity, readiness, approved launch roster, rejected late joins, member return and mode capacity.
- `npx tsc --noEmit` and `npm run build:pages`.
- `scripts/check-squad-browser.mjs`: four Chromium pages with an isolated BroadcastChannel transport; same match and four ships on all clients, allied-only tag drawing, peer pause/resume/disconnect. Real touch events check mobile joystick and drone rotation. Desktop mouse rotation, 390px/1440px layout, and removed Adventure Options also checked. The mock transport is confined to `scripts/qa/vite.config.ts` and is never included by the production build. Run with Playwright available and optional `PLAYWRIGHT_MODULE` / `CHROMIUM_PATH` environment variables.

The browser multiplayer test is simulated, not a live Internet session or a physical iPhone/Safari test. Existing unranked host-trusted Broadcast architecture is retained; this change does not introduce authoritative servers or ranked security guarantees.

Before publishing the new frontend, apply `supabase/migrations/20261027171154_arcade_four_pilot_teams.sql` through the normal database migration deployment. It updates the existing authenticated room RPC, preserves its grants, and adds no tables or new public data grants. It has not been applied to the hosted project as part of this review. Existing two-player clients should refresh together before starting a new Arcade match because the new squad transport uses a versioned channel.

## Suggested next Adventure feature

Group the 999 levels into named sectors, with an illustrated route, a new obstacle pattern per sector, and a boss encounter every tenth level. That would add exploration and goals on top of the existing rising difficulty. These additional mechanics are proposals, not included in this change.
