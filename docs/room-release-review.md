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

## Still unverified
Live two-account multiplayer readiness sync (real Supabase Realtime, not the
local two-session browser simulation) has not been tested against the
published site.
