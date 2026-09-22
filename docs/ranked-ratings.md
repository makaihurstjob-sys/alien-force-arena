# Ranked preseason — first implementation

## Approved rules

Ranked is Discord-only 1v1, starting at Cadet I with no placements. Cadet, Scout, Pilot, Ace and Commander each have I–III, with 100 points per division. Promotion carries excess points forward. A loss reaching/crossing a division floor stops at zero; the next loss demotes by that loss amount. Winning rearms grace. Cadet I is the floor.

Galactic Legend is exclusive to #1 after completing Commander III (1500 rating). Rating remains uncapped. Normal rating changes have baseline 30 and combined opponent/margin cap of 21–39. Exact rating, progress and actual gains/losses are visible when connected.

Experiment 1A uses four continuous stocks; 1B is first to four rounds with both pilots reset. Plane icons show lives. Preseason continues until seasons begin in 2027; no reset date is scheduled yet.

Ranked disconnects forfeit immediately; casual allows 30 seconds. Cooldowns begin after three rapid consecutive disconnects. Prioritize close skill matches, choose connection quality automatically, and offer Classic during queue with no ranked rewards. Ranked always has crossplay; casual permits disabling it. FFA uses separate hidden Elo.

Public cards should show rank, rating, peak, wins/losses, recent opponents/results, win rate and streaks. Circular profile borders sync to rank colors; no other rewards yet. Cheating prevention is the highest priority.

## Implemented

Pure rating, progression, rank, and disconnect-policy functions in src/lib/ranked-rules.ts, with tests. Both experimental formats run on Classic physics in src/game/classic/ranked-duel.ts; existing casual first-to-three remains intact. Ranked Ratings now has a local two-player keyboard test, plane lives, format/restart buttons, and the division legend.

Local test results never persist or award rating. Live standings/search remain disabled. Border colors are available from rankAt but earned profile borders are not yet connected.

## Initial tuning choices

- Combined change: round(clamp(30 + 4.5 * clamp((loserRating - winnerRating)/300, -1, 1) + 4.5 * margin, 21, 39)). Margin = 1 - 2 * losingKills/3. Forfeits use margin 1. Grace/floor can reduce the actual amount applied.
- Disconnect streak: at most 15 minutes between consecutive events; completed match resets it. Third event: five-minute cooldown; fourth: 15 minutes; fifth onward: 30 minutes. Needs trusted timestamps and server enforcement.
- 1A: immediate respawn, one second protection during which the pilot cannot fire or be hit. Survivor position/projectiles persist. Simultaneous final stocks draw without rating change. No round timeout.
- 1B: existing 60-second round timeout, two-second break, tied rounds replay without consuming lives.
- Above 1500, Commander III progress displays full while rating continues. Legend follows standings, without grace protection for its title.

## Remaining online work

1. Authoritative simulation and assigned participants, with server-side Discord validation. Browser-hosted friendly rooms cannot be trusted to award ranked wins.
2. Durable season/player/match storage, atomic two-player settlement, unique match IDs, peak/stats/history, authorization and concurrent/duplicate settlement tests. Deterministic tie rule for #1.
3. Skill-first queue, measured regional latency, forced ranked crossplay, Classic waiting experience, server-enforced disconnects/cooldowns. Casual crossplay setting and 30-second reconnect enforcement.
4. Real standings, public cards, earned profile borders, separate hidden FFA rating.
5. Two authenticated client tests and failure paths before enabling rating writes. This first slice includes no backend migration or deployment.
