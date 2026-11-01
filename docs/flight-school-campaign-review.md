# Flight School and Adventure gates

After the opening START, a pilot with no saved history enters Practice Flight School. Existing device/account history bypasses training; an account-history failure is not treated as proof of a new player. Completion is saved per browser (with a session fallback if storage is blocked), including guest completion before sign-in. It is not a cloud-synced completion flag. Practice offers replay. Direct mode URLs retain their existing routing.

AX-7 provides captions and optional browser speech. Nine action-verified lessons use the actual gameplay engines: flight and steering, hitting a target, grid movement, turning around, shield, freeze, rapid fire, speed boost, and teleport. Keyboard bindings and phone joystick/actions are supported. Training does not submit match records.

Adventure now follows clear → fireworks → exit gate → flight → star route → entrance gate → waiting for player movement. Boss transitions retain the pilot's ship-transfer cinematic before the route. Arrival is at the bottom-right corner. Combat and its clock stay frozen until fresh movement. The route shows twenty-level sectors through level 999, with bosses every twenty levels and the final core at 999. Other sectors can be viewed, but only the current mission can be entered; this is a map of the current run, not a new cross-session save system.

Validation: TypeScript, 154 unit tests, Pages build, targeted ESLint, and Playwright desktop/mobile checks. Browser coverage completes all nine lessons with real inputs, checks persistence/replay, existing-player bypass, touch controls, and exercises fireworks, locked route progression, flight/arrival, first movement and boss transfer. The campaign harness exposes state only through its test-only Vite transform. Browser tests mock backend responses and do not validate live Supabase or physical iOS/Safari behavior. No database migration or deployment is required by this change.

Reproduce browser checks after `npm run build:pages` with `node scripts/check-flight-school.mjs`. Optional `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, and `LD_LIBRARY_PATH` select an installed Playwright/browser runtime.
