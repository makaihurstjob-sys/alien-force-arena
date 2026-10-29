# Adventure cinematic flow

Adventure's prologue and boarding sequence now run only after a solo match is launched. Selecting a mode or entering a lobby does not mount the story. The shared title screen starts without its automatic battle presentation: that presentation was mounted by Home before a mode was selected, which made it appear across the whole game. It is separate from the pilot's Adventure narrative.

Flow: title → main menu → Adventure lobby → ready/start match → pilot prologue → original ship boarding → **Start Protecting** → level 1 awaiting the player's first movement. The final boarding screen never advances on a timer. Skip narration and Escape advance toward that confirmation; they do not bypass it into combat. Post-boss transfer scenes still require Continue Mission before the next level resumes.

The revised illustrated scenes introduce Ari Vega as a rescue pilot, establish the Sentinel signal and the distress call from home, and connect the drone commanders to the Core and the mission to reopen the gates. New vector artwork includes the pilot's flight suit and reflective visor, blockade, world, cockpit, hangar, ship, reactor damage and replacement craft. Gentle camera moves, walking, engine glow and gate transit replace the old shared stick-figure/ship animation. Reduced-motion preferences disable animation while preserving the story and controls.

Narrative scenes advance with a visible progress indicator and manual Next scene controls. Time spent with the page hidden does not consume the story. Final mission confirmations require a click or keyboard activation. Keyboard focus stays in the cinematic, background gameplay is hidden/inert, scrolling is locked, and scene keys reset when changing sequences. No voice-over or external video download is added.

Validation:
- 138 Vitest tests pass, including Adventure boss/door/scene rules and narrative confirmation data.
- TypeScript, targeted ESLint (excluding existing formatting conventions), and Pages build pass.
- `scripts/check-adventure-film.mjs` verifies the built app's title/menu/lobby/start flow, complete prologue/boarding, explicit Start Protecting, and no pilot story in Practice, Arcade, Ranked, Versus or Bullet Run lobbies. Direct Practice/Arcade game routes also omit it.
- An isolated cinematic fixture checks timed scene progression, skip-to-confirmation behavior, a final screen that stays until confirmation, mobile layout and post-boss transfer. Desktop and 390px screenshots are inspected locally.

Browser checks use Chromium and simulated backend errors to select the existing offline fallback lobby. They do not validate a live Supabase room, physical iPhone or Safari. No database migration, live deployment or merge is performed by this change.
