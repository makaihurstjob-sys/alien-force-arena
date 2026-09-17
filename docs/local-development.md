# Local development and practice demo

## Claude handoff: preview on Mac or another workspace

Use the latest `main` branch. In a new workspace:

```sh
git clone --branch main https://github.com/makaihurstjob-sys/alien-force-arena-redux.git
cd alien-force-arena-redux
bun install --frozen-lockfile
bun run dev --host 127.0.0.1 --port 5175 --strictPort
```

Bun must be installed on the host. Open `http://localhost:5175/classic` on
that same machine. Keep the dev process running while reviewing changes.
For an existing clone, inspect its working tree before switching branches or
pulling; preserve any local work. Do not overwrite it with a fresh snapshot.

In a cloud workspace, localhost belongs to the cloud host. If its preview system
requires a network listener, use `--host 0.0.0.0` instead and forward port 5175
through that workspace's preview feature. Give the user the actual forwarded
URL with `/classic` appended. Verify the page responds before reporting success.
On a Mac, localhost is visible in the Mac's browser; it is not automatically
reachable from the user's phone or Windows browser.

The existing `https://desktop-56u49jf.tailb2892a.ts.net:8447/` preview belongs
to the Windows machine. Pushing commits from Mac/cloud does not update that
Windows working tree or preview automatically. To update it, push the game
changes to the handoff branch, then have the Windows session inspect its local
changes and fast-forward that branch. Verify the preview afterward; a static
preview may need rebuilding, and dependency/config changes may need a game
dev-server restart. Never restart or modify the Master Dashboard deployment
as part of game preview work.

Local classic gameplay can be reviewed before Supabase lobby setup is complete.
Check `docs/multiplayer.md` for backend requirements. The multiplayer menu was
subsequently hidden: Options should currently contain only Level, until Create
Room is ready. Earlier multiplayer-menu verification notes are historical.

From this repository, run `bun install --frozen-lockfile`, then `bun run dev`.
Open the local URL printed by Vite. Run rule tests with `bun run test` and
check the production bundle with `bun run build`.

## What works locally

Choose Practice from the main menu. Arrow keys or WASD turn, thrust, and
reverse; Space fires. Touch players can use the handheld's D-pad and A/B.
Only one projectile per player may exist at a time. Start restarts the match
and Select changes the arena. First to three round wins takes the match;
drawn rounds award no points, so the round number can exceed three.

Pause or Escape freezes practice. Switching tabs or losing window focus
automatically pauses it; Resume continues. Inputs are cleared on focus loss
so a missed key release does not leave the ship moving or firing.

After a match, the results show each player's shots, hits, and accuracy.
Accuracy is hits divided by shots times 100, or zero when there are no shots.
Play again resets scores and statistics. These local results are not saved.

## How to explain the code

`src/game/engine.ts` advances mutable game state one fixed tick at a time.
`useGameLoop.ts` accumulates elapsed time into fixed ticks and draws the canvas.
`practice.tsx` supplies human and bot inputs, starts subsequent rounds, and
copies a small HUD snapshot into React roughly six times per second.
Pause stops the local loop without modifying the competitive simulation rules.
All gameplay tuning and arena geometry live in `src/game/config.ts`.

## Remaining work

Online rooms, matchmaking, database persistence, ratings, and leaderboards
are unfinished. Supabase integration files alone do not implement those features.
Original-game movement and visual fidelity remain unverified; the existing
arena rules are a remaster prototype, not a verified exact classic mode.
