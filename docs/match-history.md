# Unified Career history

Career Match history merges Classic runs, settled online match participants, and browser records, sorts newest first, filters seven playable modes, and paginates 20 rows. Failed account sources report a warning while successful sources remain visible. Account reads are filtered by the authenticated player ID. Local storage is isolated by the player ID captured when play starts (or null for guest play).

Classic uses classic_runs. Ranked uses matches joined to the current player match_participants row; settled rating_after values distinguish rated results. Queued assignments that never started are excluded. Ranked ratings and outcomes are read only; the browser cannot submit them.

Versus, Arcade, Practice, Arcade Practice, and Bullet Run did not previously have durable history. New sessions use alien-force-match-history-v1 in localStorage, retaining at most 500 records on this browser. These records are not synced across devices. Existing games from those modes cannot be reconstructed. This can be moved to an account database store separately when backend deployment access is available.

Local recording checkpoints every five seconds and freezes results on completion, restarts, leaving, and pagehide. Match IDs deduplicate repeats and distinguish rematches. Bullet Run is continuous: its entry describes a session with kills, deaths, pilots, and weapon stage, without inventing a winner. Default score and accuracy are omitted when a source did not track them.
