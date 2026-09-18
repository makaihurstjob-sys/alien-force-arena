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

Owner approved these names on September 18, 2026. The Ranked Ratings panel
shows them as labeled color swatches, lowest to highest. Colors are temporary
and centralized in `src/lib/ranks.ts`; sprites can replace them later.

Space theme, low to high:

| Tier | Name | Temporary color |
| --- | --- | --- |
| 1 | Cadet | Gray `#a8b5c7` |
| 2 | Scout | Mint `#53dfbe` |
| 3 | Pilot | Blue `#69baff` |
| 4 | Ace | Gold `#ffda6b` |
| 5 | Commander | Coral `#ff8899` |
| 6 | Galactic Legend | Violet `#d0a0ff` |

Suggestion: ten placement matches, then rating-based promotion and demotion.
Consider three divisions in each ordinary tier; keep the top tier undivided.
These are Alien Force proposals, not claims about Brawlhalla's rules.
Do not set public thresholds until starting rating and expected
rating movement have been decided. Small early populations favor a simple
ladder; avoid a top-N requirement until there are enough active competitors.

## Next implementation stages

1. Agree on divisions, placement count, rating thresholds, season length,
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
