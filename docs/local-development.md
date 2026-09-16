# Local development and practice demo

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
