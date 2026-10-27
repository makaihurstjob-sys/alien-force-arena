export const lobbyModes = {
  solo: { name: "Adventure", description: "999 levels · Start at level 1", min: 1, max: 1, playable: true },
  duel: {
    name: "Versus",
    description: "Private duel \u00b7 Unranked",
    min: 2,
    max: 2,
    playable: true,
  },
  bullet: { name: "Bullet Run", description: "Free for all", min: 2, max: 6, playable: true },
  practice: {
    name: "Practice",
    description: "Offline \u00b7 Training bot",
    min: 1,
    max: 1,
    playable: true,
  },
  ranked: {
    name: "Ranked",
    description: "Competitive 1v1 \u00b7 Matchmaking",
    min: 2,
    max: 2,
    playable: true,
  },
  arcade: {
    name: "Arcade",
    description: "Power-ups · 2–4 pilots · Team battle",
    min: 2,
    max: 4,
    playable: true,
  },
} as const;
export type LobbyMode = keyof typeof lobbyModes;
