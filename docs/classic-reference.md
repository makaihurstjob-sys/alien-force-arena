# Classic mode reference and implementation

Reference: user-supplied 6:56 gameplay video, reviewed September 9, 2026.
Observed: 10 by 10 teal block grid, black lanes and background, cyan/white player,
red/yellow enemies, cardinal movement, level/score/life display and repeated grid across levels.
At approximately 41 seconds the score changes from 400 to 390 near a shot.

Playable locally at /classic, linked from the home screen. Arrows/W/A/D steer,
Space fires, P/Escape pauses. Touch buttons are provided. Focus loss pauses.
Practice remains the separate arena-duel mode.

## Provisional rules (not established by the footage)
- Perpendicular turns buffer until a lane intersection; precise original turning tolerance is unverified.
- One projectile per ship. Shots expire outside the playfield; enemies do not hurt other enemies.
- Each shot costs 10 points, clamped at zero (penalty still provisional).
- Three lives; one hit/contact loses a life. Respawn resets the enemy wave and gives two seconds of protection.
- Clearing a wave advances the level after 1.5 seconds; enemies increase up to ten and speed increases with a cap.
- Enemy steering favors the player's coordinates at intersections and firing is random.

All tuning is in src/game/classic/engine.ts. The simulation runs at 60 fixed ticks
per second; rendering uses requestAnimationFrame. Movement follows lane centers,
so blocks cannot be crossed. Projectile collision uses short substeps.
No database writes or online gameplay are connected to this local mode.

Exact original controls, speeds, AI, scoring, death/reset behavior, firing restrictions,
audio and menus still require verification. Tests cover turns, boundaries, shots,
wave progression, respawn protection and terminal game state.

## Browser verification

Tested with headless Microsoft Edge at 1100 x 850 and 390 x 844:
keyboard movement after New game, pause freezes the rendered simulation, resume,
automatic pause on window blur, restart restores three lives, pointer movement,
and no horizontal overflow on mobile. No browser runtime errors were reported.
Fixed keyboard movement when menu controls hold focus, cleared held-key state
across pause transitions, focused the canvas after restart/resume, and corrected
encoding artifacts in visible labels. Thirteen simulation tests pass.
This is a browser smoke test, not a claim of original-game fidelity or real-device touch testing.

## Original bundled help verification

Source: Aforce.hlp inside the ZIP linked at https://archive.org/details/win3_alienforce
Read directly as text from the bundled help; no original executable was run or assets copied.
The previous help-file interpretation included a stop command. The user clarified
that the original game they are referencing does not allow stopping; that correction
supersedes the stop mapping for this reconstruction. Stop input and stopped state
have been removed. Releasing a direction continues travel; R or B reverses.
A fires, Select also reverses, and Start pauses/resumes the whole game.
S and keypad 5 no longer stop the ship.

The previously recorded scoring is 100 points per enemy and a level-clear bonus
of 500 times the level cleared. Enemy firing onset, shot penalty, life reset behavior,
and timing remain provisional. Earlier browser validation above predates this control correction.


## Enemy progression pass

Re-read Aforce.hlp from the original archive ZIP: it describes simple early enemies,
increasing intelligence at higher levels, and the later introduction of return fire.
The RGB Classic Games description (https://www.classicdosgames.com/game/Alien_Force.html)
specifies no return fire on level 1 and some shooters beginning on level 2.
Implemented those firing thresholds. The current shooter count (level minus one,
capped at the wave size), pursuit probability, enemy count, and speeds are provisional.
AI now makes one decision per intersection passage and chooses in-bounds directions.
Level 1 mostly wanders; pursuit increases with level. That probability curve is a
playable approximation, not a recovered original algorithm. Exact video URL requested
again for side-by-side fidelity checks. User's no-stop correction remains authoritative.
