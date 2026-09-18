# Free-for-All rooms

Create Room now asks for 1v1 Duel or FFA before creating a room. FFA supports 2-4 players, one ship per pilot, one shot in flight, and one-hit elimination. Last survivor wins a round; simultaneous elimination or a timeout with multiple survivors draws. First to three round wins takes the match. All current players must be ready and connected to start and must vote for a rematch.

Each pilot has a distinct seat, spawn corner, numbered color marker, and score. Roster changes during a match end that match and require returning to the room. Transport remains host-authoritative and peer-trusted, as in the existing unranked duel.

## Database rollout

Target: jtshieblptpxtkociseo. Apply 20260917200000_ffa_mode.sql first and commit it, then 20260917200100_ffa_rooms.sql. The enum addition must commit before the value is used. The new four-argument classic_lobby RPC selects the creation mode; the original three-argument RPC remains available for existing clients. Existing 1v1 and ranked seat/spectator behavior is preserved. Full FFA rooms reject extra players.

These migrations have been validated locally with PGlite, but have not been applied live from this session. Deploy the frontend only after applying and verifying the migrations.

## Validation

- bun run test (60 gameplay tests, including five FFA cases)
- node scripts/test-ffa-db.mjs (capacity, unique seats, retries, access, leave/rejoin, closure, legacy RPC)
- bun x --no-install tsc --noEmit
- bun run build:pages
- Playwright: desktop 1440x1000 and mobile 390x844, Create Room -> FFA -> four-player join/ready/start using a controlled lobby and BroadcastChannel transport. Real Supabase multi-device play remains a deployment verification step.
