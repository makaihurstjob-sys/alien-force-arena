# Ranked ratings: design proposal and first UI

## Implemented

Ranked Ratings reuses the Classic leaderboard's dialog sizing, typography,
table, toolbar, and pagination styles, with a violet accent. The owner-provided
Brawlhalla screenshot informs the search/region/mode layout and columns:
rank, region, player, tier, wins–losses, season rating, and peak rating.

The board is explicitly preseason. Search, filters, and pagination remain
disabled until a real ranked data source exists. No fictional players, ratings,
or results are shown. No new database migrations or rating writes are included.
The ranked gameplay card remains Coming soon.

## Rank brainstorm — not approved or enforced

Proposed space theme, low to high:

| Tier | Name | Badge direction |
| --- | --- | --- |
| 1 | Cadet | Gray, one chevron |
| 2 | Scout | Teal, paired chevrons |
| 3 | Pilot | Blue, wings |
| 4 | Ace | Gold, winged star |
| 5 | Commander | Crimson, crowned wings |
| 6 | Galactic Legend | Violet, star and orbital ring |

Alternative familiar ladder: Bronze, Silver, Gold, Platinum, Diamond,
with Galactic Legend as the distinctive top tier.

Suggestion: ten placement matches, then rating-based promotion and demotion.
Consider three divisions in each ordinary tier; keep the top tier undivided.
These are Alien Force proposals, not claims about Brawlhalla's rules.
Do not set public thresholds until rank names, starting rating, and expected
rating movement have been decided. Small early populations favor a simple
ladder; avoid a top-N requirement until there are enough active competitors.

## Next implementation stages

1. Agree on names, divisions, placement count, rating thresholds, season length,
   and whether peak means season peak (recommended) or lifetime peak.
2. Define a season and one player rating record per season and mode. Store
   current rating, season peak, wins, losses, and placement progress. Matchmaking
   region is separate from the optional profile flag: never infer it from flags.
3. Build a trusted result settlement path before enabling ranked matches.
   A unique match ID must prevent duplicate results. Update both competitors
   atomically, check assigned participants, and define disconnect/forfeit rules.
   Clients must not directly edit ratings or declare arbitrary ranked wins.
   Existing host-simulated friendly rooms alone are insufficient as a trusted
   result authority. Private rooms and FFA must not affect the 1v1 ladder.
4. Expose a paginated public standings read endpoint with server-side search,
   region and mode filters, deterministic rating order, and an agreed tie rule.
   Join display names and flags from profiles. Only advertise regions actually
   supported by matchmaking. Show unplaced players separately from ranked seats.
5. Connect this UI to that endpoint with loading/error/retry and empty/search
   states, then add ranked player cards with season stats and match history.
6. Validate placement, rating movement, peaks, duplicates, concurrent settlement,
   authorization, forfeits, and season rollover before enabling ranked play.
