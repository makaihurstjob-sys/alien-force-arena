# Alien Force Arena — roadmap

## In progress
- [x] Central tuning config, engine (one-projectile rule), renderer, practice bot
- [x] Home screen + playable practice arena (canvas, controls, HUD)
- [x] Practice pause/resume, automatic pause on focus loss, match results and rematch
- [x] Tests: one-projectile rule, countdown, round end, draws, match win, round reset

## Next
- [ ] Enable Lovable Cloud (auth + Postgres)
- [ ] SQL migrations: profiles, ratings, rooms, memberships, queue, matches,
      participants, rounds, events, leaderboard snapshots (+ demo seed)
- [ ] Authoritative multiplayer server code + deployment README
- [ ] Private rooms (codes), public matchmaking, results, Elo ratings
- [ ] Leaderboard + analytics screens with real SQL
- [ ] Docs: spec, Mermaid ER diagram, demo script

## Added later by request
- [x] Mobile play: Game Boy-inspired handheld shell with touch D-pad + A/B buttons
- [x] Playable video-informed Classic mode: grid lanes, waves, lives, score, pause, touch controls
- [ ] Verify Classic timings, AI, scoring and original rules (see docs/classic-reference.md)
- [ ] Agent integrations (MCP): @lovable.dev/mcp-js server exposing app tools
      (leaderboard, player stats, match lookup). Ask public-vs-OAuth consent.

## Known gaps / needs verification
- Supplied original-game footage has now been inspected; exact
  movement speeds, projectile behaviour, hitboxes and arena layouts are
  reconstructions marked UNVERIFIED in src/game/config.ts.

## September 16 preview setup
- [x] Original-style Options ? Level dialog with OK/Cancel
- [x] Equal Classic difficulty across levels using the level-one baseline
- [x] Owner-supplied Windows Bold throughout UI and canvas text
- [x] Prepared lobby UI and tested Supabase RPC migration (menu entry hidden)
- [ ] Add Create Room under Options when multiplayer is available; only Level is shown now
- [ ] Apply lobby migration and enable guest authentication remotely
- [ ] Connect authoritative online matches; private rooms stay unranked
- [ ] Permanent accounts and separate ranked ratings after result validation
See docs/multiplayer.md for setup, verified behavior, and remaining work.
