# Classic PR #3 review and publication verification

Reviewed the merged PR's engine, renderer, keyboard handling, tests, and reference
notes. PR #3 merged as `5fe2a52` on 2026-09-28 and is an ancestor of source
`3853c23`, already published by assets commit `9628406`.

The implementation provides ten drones per wave, shooting from level 2,
increasing speed/fire rate/pursuit, distributed armor every ten levels, remaining
health badges, buffered turn taps, and a level cap of 999. No blocking gameplay
findings were identified in this review.

One existing wall-turn test failed after the speed change: it checked only final
displacement after two seconds, when a valid out-and-back route could return to
its starting position. Updated it to require movement on every frame, in-bounds
coordinates throughout, and meaningful maximum displacement from the start.
No runtime changes were needed.

Verification performed:

- All 68 tests across seven files passed after correcting that assertion.
- TypeScript passed using `node node_modules/typescript/lib/tsc.js --noEmit`.
- `npm run build:pages` passed and reproduced `index-tcSAHPnB.js`.
- Public site returned HTTP 200. Live JS and CSS SHA256 hashes matched the
  published checkout; rebuilt JS also matched exactly.
- Live browser checks passed at desktop and mobile sizes for countdown,
  menu pause/resume, restart, and absence of page errors.
- `git diff --check` passed.

The Classic update is already live at
https://makaihurstjob-sys.github.io/alien-force-classic/ . A duplicate deployment
is unnecessary because this review changes only a test and this record.
No message was sent to the PR author.
