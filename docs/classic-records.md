# Classic records and profile flags

Classic records are browser-reported community scores. Completed runs starting at level 1 qualify for the leaderboard; restarts, exits through the game menu, and custom starting levels remain in public history. Closing the browser is not guaranteed to save an unfinished run.

These migrations were applied in this order to the confirmed game database on September 17, 2026:

1. `supabase/migrations/20260917175940_classic_run_history.sql`
2. `supabase/migrations/20260917190000_profile_flags.sql`

The profile uses a sign-in door icon unless a Discord avatar is available. Players can save a name and optional flag together, including as a guest. Flags appear on the Classic leaderboard and player card. Clearing a flag saves `null`. Existing profile ownership policies apply to the new column; the database accepts only bundled flag codes.

The flag picker includes all 271 entries from [flag-icons 7.5.0](https://github.com/lipis/flag-icons), including its 249 ISO country/territory entries and additional regional/organizational flags. SVG files ship with the app; rendering does not depend on an external image host or platform emoji support. Search matches names and flag codes. Keep the database allowlist synchronized if the flag package changes.

Validation:

- `npm test -- --reporter=dot`
- `npx tsc --noEmit`
- `node scripts/test-classic-records-db.mjs` (isolated PostgreSQL via PGlite)
- `npm run build:pages`
- Start `npx vite --config vite.pages.config.ts --host 127.0.0.1 --port 5197`, then run `python scripts/test-classic-records-ui.py` and `python scripts/test-profile-flags-ui.py`. Browser fixtures exercise the actual UI with controlled data; they do not prove live Supabase persistence.

Confirmed project: Alien Force Multiplayer (`jtshieblptpxtkociseo`). The owner confirmed this project on September 17, 2026. Investigation found duplicate `.env` entries: an old `cutaanwrdvhhurpisaiw` URL came before the intended URL. The later value was the effective Vite setting. An earlier first-match inspection incorrectly reported the old URL as the effective configuration. The duplicates are now removed, frontend/server public credentials match the intended project, and `supabase/config.toml` is aligned.

Live verification passed using the publishable key and a temporary anonymous guest: profile creation, flag save/update, score insertion, duplicate-safe retry, public stats/history/leaderboard reads, rejection of another player's score submission, and rejection of score modification. The guest was signed out, then its exact test profile, run and auth record were removed; zero remaining records were confirmed. Guest access and Discord are enabled in Auth settings. This does not verify the complete Discord redirect flow.

The security advisor returned warnings for existing guest-access policies, the intentional lobby security-definer RPC, and disabled leaked-password protection. See [guest access advisories](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins), [security-definer RPC advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No unrelated policies or authentication settings were changed.

Published September 17, 2026: source release `81729da`, public build `8dae0a2`, at https://makaihurstjob-sys.github.io/alien-force-classic/. GitHub Pages reported a successful deployment. The public HTML serves the verified release bundle. Desktop (1440px) and phone (390px) browser checks passed for menu order, sign-in icon, all 271 flag options, SVG loading, and a successful live leaderboard response, with no runtime errors or horizontal overflow. Local player-card navigation and flag save/reopen fixtures, all 55 gameplay tests, database checks, TypeScript, and the Pages build also passed.
