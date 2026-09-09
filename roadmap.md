# Alien Force Arena — roadmap

## In progress
- [x] Central tuning config, engine (one-projectile rule), renderer, practice bot
- [ ] Home screen + playable practice arena (canvas, controls, HUD)
- [ ] Tests: one-projectile rule, round end

## Next
- [ ] Enable Lovable Cloud (auth + Postgres)
- [ ] SQL migrations: profiles, ratings, rooms, memberships, queue, matches,
      participants, rounds, events, leaderboard snapshots (+ demo seed)
- [ ] Authoritative multiplayer server code + deployment README
- [ ] Private rooms (codes), public matchmaking, results, Elo ratings
- [ ] Leaderboard + analytics screens with real SQL
- [ ] Docs: spec, Mermaid ER diagram, demo script

## Added later by request
- [ ] Mobile play: Game Boy-inspired handheld shell with touch D-pad + A/B buttons
- [ ] Classic mode: recreate Robert Epps' original Alien Force gameplay as a
      separate mode next to the remastered arena (BLOCKED: waiting on the
      user's gameplay footage to match real movement/firing/levels)
- [ ] Agent integrations (MCP): @lovable.dev/mcp-js server exposing app tools
      (leaderboard, player stats, match lookup). Ask public-vs-OAuth consent.

## Known gaps / needs verification
- Original 1990 Alien Force could not be run or inspected from this environment;
  movement speeds, projectile behaviour, hitboxes and arena layouts are
  reconstructions marked UNVERIFIED in src/game/config.ts.
