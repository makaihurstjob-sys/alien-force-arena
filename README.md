# Alien Force Arena Remastered

Build a working browser game called Alien Force Arena for a college Database Design and Implementation project.

This should be a playable recreation of the mechanics and visual feel of the 1990 Windows game Alien Force, extended with multiplayer PvP and a relational database. Build the actual game, not just a landing page or dashboard.

REFERENCE AND ACCURACY

Reference: https://archive.org/details/win3_alienforce

Inspect the reference if you can. If you cannot play or inspect it, say so and identify which gameplay details need verification. Do not claim exact fidelity without checking.

Create original artwork and code; do not reuse the original executable, sprites, or audio.

Keep gameplay settings centralized so we can adjust movement speed, projectile speed, collision sizes, and arena layouts after comparing with the original.

GAMEPLAY

- Top-down, single-screen arena with obstacles.

- Retro Windows-era visual style, simple original pixel-style ships, and readable projectiles.

- The core rule: each player may have only ONE active projectile at a time. Another shot becomes available only after that projectile hits something or leaves play.

- Keyboard controls, clear instructions, collision detection, and a visible indicator showing whether the player can fire.

- Responsive controls and smooth rendering using Canvas or a suitable 2D game library.

- Local practice mode so the game is immediately playable.

- Multiplayer 1v1 and 2v2 modes.

- For the initial PvP rules, use one-hit elimination, last surviving team wins the round, and first to three rounds wins the match. Label these as adjustable PvP design choices, not verified original rules.

- Include lobby, ready state, countdown, gameplay, results, and rematch flow.

- Display connection status and handle disconnects explicitly.

MULTIPLAYER

Support both:

1. Private rooms with short room codes that friends can enter.

2. Public matchmaking based on rating and measured latency.

The authoritative server must control movement validation, projectiles, collisions, damage, round outcomes, and the one-projectile rule. Clients send inputs, not trusted results.

Use a suitable real-time transport. Do not store every animation frame in the database or treat database row updates as the authoritative game loop.

If a persistent game server cannot run within this platform, generate the separate server code and clear deployment instructions. Keep local practice functional and clearly distinguish it from live multiplayer. Do not simulate online players or show fake successful connections.

DATABASE — A CENTRAL GRADED REQUIREMENT

Use Supabase/PostgreSQL with readable SQL migrations and relational constraints.

Include tables for:

- Player profiles linked to authentication.

- Ratings by game mode.

- Rooms and room memberships.

- Matchmaking queue entries with mode, rating, region, measured latency, and queue timestamps.

- Matches with mode, lifecycle status, server assignment, timestamps, and winning team.

- Match participants with player, team, outcome, and before/after ratings.

- Match rounds and their outcomes.

- Gameplay events including shots, hits, eliminations, and disconnects.

- Daily leaderboard snapshots.

Keep rooms separate from matches so a room can support rematches.

Use primary keys, foreign keys, indexes, checks, and uniqueness constraints.

Store timestamps consistently.

Persist useful gameplay telemetry without writing every movement tick.

Ensure match completion and rating updates are transactional and cannot be applied twice.

SECURITY

- Players can edit only appropriate fields in their own profiles.

- Clients cannot directly change ratings, match results, or authoritative telemetry.

- Apply row-level security where appropriate.

- Keep privileged keys on the server.

- Validate room capacity, team assignments, and match transitions.

RATINGS AND ANALYTICS

Implement an understandable Elo-based rating system. Document how team ratings and individual adjustments work for 2v2.

Provide a daily leaderboard refresh mechanism and a way to demonstrate it manually.

Include SQL analytical queries for:

- Highest accuracy, with a minimum shot count.

- Win rate by player and mode.

- Rating gaps between opposing players or teams.

- Average matchmaking wait time.

- Disconnect rates.

- Daily participation.

Define accuracy explicitly and prevent division by zero.

SCREENS

- Simple home screen with Play, Practice, Join Room, and Leaderboard.

- Create/join room and team lobby.

- Game arena as the visual focus.

- Results with score, shots, hits, accuracy, and rating changes.

- Leaderboard with mode filters and snapshot date.

- A small analytics screen backed by real queries.

Keep the presentation retro and game-focused. Avoid a generic SaaS dashboard or marketing page.

EXPLAINABILITY AND DELIVERABLES

We are students and must explain how everything works.

Prefer straightforward code, clear names, small modules, and comments explaining important decisions.

Include:

- Working game client.

- Authoritative multiplayer server code.

- Database migrations and clearly labeled demo seed data.

- Mermaid ER diagram.

- Brief technical specification.

- Setup and deployment README.

- Explanation of the game loop, one-shot rule, collision detection, networking, matchmaking, rating updates, and telemetry.

- A demo script showing two players joining, completing a match, saving results, updating ratings, and refreshing the leaderboard.

- Focused tests for the one-projectile rule, room capacity, result validation, and duplicate rating-update prevention.

BUILD ORDER

Start with a genuinely playable arena and local practice.

Then implement database/authentication, private multiplayer rooms, public matchmaking, results, ratings, and analytics.

Make practical implementation decisions and proceed. Clearly identify anything that requires external deployment or configuration and any features that remain incomplete.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://alien-force-arena-redux.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b2c2ff86-8740-496b-a62b-1f80795b5f48).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
