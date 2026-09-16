# Multiplayer setup

Options → Multiplayer opens a private, unranked 1v1 lobby. The client supports guest
authentication, six-character room codes, two seats, ready status, leaving, and
roster refresh every two seconds while the dialog is open. Closing the dialog
keeps membership; Join with the saved code restores the room. Create also restores
an existing open room. Leaving as host closes the room. A disconnected host's room
is not yet expired automatically.

## Connect the backend

The repo already contains Supabase URL and publishable-key configuration. Never
put service-role keys in VITE variables. The static build reads `.env` from the
repository root using `envDir`.

1. On a new database, apply `drizzle/migrations/0000_alien_force_arena_core_schema.sql`
   and `0001_ratings_functions_and_demo_seed.sql` first. The second includes demo
   records; review these before deploying to a real player database. Do not rerun
   these baseline migrations on an existing database.
2. Apply `supabase/migrations/202609160001_classic_lobbies.sql` after the baseline.
   This intentionally removes direct client access to rooms and memberships;
   the authenticated `classic_lobby` RPC performs all lobby operations instead.
3. Enable anonymous sign-ins in Supabase Auth for guest lobbies.
4. Test two separate browser profiles: create, join, toggle ready, leave, rejoin,
   host leave, full-room rejection, invalid codes, and a third user's access denial.

The RPC checks identity and membership, locks the room before allocating seats,
and serializes each player's mutations. It does not create matches, accept match
results, or touch ratings. Browser clients cannot invoke `complete_match`.

## Next multiplayer stages

- Add a game session transport and authoritative simulation for synchronized
  inputs, snapshots, disconnect handling, and reconnects. Do not write movement
  frames to Postgres. Lobby polling is not the gameplay transport.
- Keep code-based friend matches unranked. Add permanent player accounts before
  ranked matchmaking, with separate 1v1 and 2v2 ratings.
- Only a trusted game server may finalize a match and update ratings, atomically
  and once. Audit the existing `complete_match` function for abandoned/live-state
  validation, concurrent rating updates, and rating limits before enabling it.
- Decide seasons, placements, tier thresholds, rematches, and disconnect penalties
  later. Existing demo Elo constants are provisional, not a claimed reproduction
  of Brawlhalla's ranking rules.

References: https://supabase.com/docs/guides/auth/auth-anonymous and
https://supabase.com/docs/guides/database/functions

## Verified September 16, 2026

- 32 engine tests, TypeScript, and the static production build passed.
- Playwright on the Tailscale preview at 1440?1000 and 390?844 verified the
  Level dialog (OK, Cancel, invalid input, Escape), Windows Bold loading,
  desktop/mobile controls, and the Multiplayer menu, with no page exceptions.
- Both existing database migrations and the new lobby migration executed in
  isolated PGlite/Postgres. Authenticated-user checks covered create/rejoin,
  two-player capacity, ready, leave, host closure, nonmember denial, anonymous
  denial, denied direct room reads, and denied match-result writes. Hosted
  database concurrency and two-device online play remain untested.
- The configured remote Supabase project responds, but `classic_lobby` returned
  PGRST202 (missing function). The live Create room attempt could not sign in
  as a guest and showed a recoverable setup message. No remote migration was
  applied; management access is not available in this session.
- Reference match: Level menu, dialog wording, white/blue panel, gray beveled
  buttons, and the supplied font. Intentional additions: Multiplayer menu and
  responsive viewport-centered dialog placement.
