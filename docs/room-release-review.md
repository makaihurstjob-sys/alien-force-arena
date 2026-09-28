# Shared room release review

## Included local changes

- Classic Play enters the solo Ready/Start room on desktop and mobile.
- Create Room offers Classic Solo, existing Classic 1v1, and embedded Bullet Run.
- Classic 2vE is labeled as future work, not playable.
- Bullet Run shows all 24 pilots, identity labels, shared readiness and host launch.
- Rounds record a match ID and starting roster; launch clears readiness.
- Host return clears round state; late arrivals wait for the next round.
- Close and mode changes require leaving the room; embedded Leave retains the menu.
- Interrupted/closed-room controls and stale-round snapshots are guarded.

## Verification

Prior implementation checks passed TypeScript, Pages build, local PGlite
migration tests and desktop/mobile browser fixtures at 1440px and 390px.
Both screenshots were inspected. The final two-session test passed two rounds,
guest snapshots, readiness reset and host closure without page errors.
The synchronization test uses shared local RPC/realtime fixtures, not Supabase.

## Release boundary

Nothing has been published and no live database migration has been applied.
The additive migration is `supabase/migrations/202609270000_bullet_readiness.sql`.
Apply it before publishing the new client. The new client keeps launch disabled
when the required lifecycle/readiness fields are absent. Coordinate the rollout
with no active Bullet Run rooms: existing clients lack the new lifecycle contract.

Live verification must cover two signed-in guests, invite entry, readiness,
launch, rematch, recovery and closure after migration and publication. Existing
realtime transport trusts claimed host IDs; this work does not provide an
authoritative or cheat-resistant match server. The screenshot's original Load
failed cause has not been reproduced on the live service; local recovery is tested.

Publication and live database changes require owner authorization. Local UI and
fixture verification are complete for this slice.
