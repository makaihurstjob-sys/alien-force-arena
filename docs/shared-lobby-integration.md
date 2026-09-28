# Shared lobby entry

The home screen Play action opens the hangar for Classic, Practice, Classic 1v1,
Bullet Run, Ranked, and Arcade. Create Room and Join Room are removed from home.
Ranked and Arcade remain coming-soon modes with launch disabled.

Classic and Practice use local single-player lobbies and return to the hangar with
readiness cleared. Classic 1v1 and Bullet Run create online rooms automatically;
their invite links open the appropriate lobby from home. Leave Room returns home.

The selector supports changes from local lobbies. Existing multiplayer rooms
still use separate backend services: changing their mode while preserving the
roster is not implemented, and other choices are explicitly disabled.

Validation on September 28, 2026:

- 68 unit tests; TypeScript compilation; production Pages build.
- All six home entry paths at desktop and phone widths, selector dismissal,
  readiness, local launch/return, and Leave Room.
- Hangar slots expand from four to five to six; six players leave no invite slot.
- Classic 1v1: two independent users, two rounds, readiness/cancel, invite reload,
  matching match IDs, return/reset, and host closure.
- Bullet Run: two independent users, two rounds, readiness/cancel, advancing
  realtime snapshots, return/reset, and host closure.

This checkpoint is local. No publication or database migration was performed.
