export const lobbyModes = {
  solo: { name: "Classic", description: "Solo survival", min: 1, max: 1, playable: true },
  duel: {
    name: "Classic 1v1",
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
    description: "Power-ups \u00b7 Private duel \u00b7 Unranked",
    min: 2,
    max: 2,
    playable: true,
  },
} as const;
export type LobbyMode = keyof typeof lobbyModes;
