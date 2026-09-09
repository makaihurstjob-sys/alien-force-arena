/**
 * Alien Force Arena — central tuning file.
 *
 * EVERY gameplay number lives here so we can compare against the original
 * 1990 Windows "Alien Force" and adjust without touching engine code.
 *
 * NOTE ON ACCURACY: we could not run or inspect the original executable from
 * this environment (archive.org's win3 emulator needs a browser session we
 * cannot drive here). All values below are our best reconstruction and are
 * marked UNVERIFIED. Items needing verification against the original:
 *   - ship acceleration / max speed / turn rate
 *   - projectile speed and lifetime
 *   - whether projectiles bounce off walls or die on contact
 *   - hitbox sizes, arena size, obstacle layout
 *   - respawn / round rules
 */

export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;

export const ARENA = {
  width: 800,
  height: 600,
};

/** Ship movement (UNVERIFIED reconstruction). */
export const SHIP = {
  radius: 12,
  accel: 420, // px/s^2 while thrusting
  reverseAccel: 240,
  maxSpeed: 260, // px/s
  friction: 2.6, // per second velocity damping
  turnRate: 4.2, // radians/s
};

/** Projectiles. The one-shot rule is enforced in the engine, not here. */
export const PROJECTILE = {
  radius: 3,
  speed: 520, // px/s
  lifetimeMs: 2200, // leaves play after this
  bouncesOffWalls: false, // UNVERIFIED: original may bounce
};

/** PvP ruleset — ADJUSTABLE DESIGN CHOICES, not verified original rules. */
export const PVP_RULES = {
  oneHitElimination: true,
  roundsToWinMatch: 3,
  countdownSeconds: 3,
  roundTimeLimitSeconds: 60,
};

export type ArenaLayout = {
  id: string;
  name: string;
  obstacles: { x: number; y: number; w: number; h: number }[];
  spawns: { x: number; y: number; angle: number; team: 0 | 1 }[];
};

/** Arena layouts. Obstacles are axis-aligned rectangles (simple + readable). */
export const ARENA_LAYOUTS: ArenaLayout[] = [
  {
    id: "cross",
    name: "Cross Section",
    obstacles: [
      { x: 360, y: 120, w: 80, h: 160 },
      { x: 360, y: 320, w: 80, h: 160 },
      { x: 120, y: 280, w: 160, h: 40 },
      { x: 520, y: 280, w: 160, h: 40 },
    ],
    spawns: [
      { x: 90, y: 90, angle: 0, team: 0 },
      { x: 90, y: 510, angle: 0, team: 0 },
      { x: 710, y: 90, angle: Math.PI, team: 1 },
      { x: 710, y: 510, angle: Math.PI, team: 1 },
    ],
  },
  {
    id: "pillars",
    name: "Pillars",
    obstacles: [
      { x: 200, y: 150, w: 60, h: 60 },
      { x: 540, y: 150, w: 60, h: 60 },
      { x: 200, y: 390, w: 60, h: 60 },
      { x: 540, y: 390, w: 60, h: 60 },
      { x: 370, y: 270, w: 60, h: 60 },
    ],
    spawns: [
      { x: 80, y: 300, angle: 0, team: 0 },
      { x: 80, y: 120, angle: 0, team: 0 },
      { x: 720, y: 300, angle: Math.PI, team: 1 },
      { x: 720, y: 480, angle: Math.PI, team: 1 },
    ],
  },
];

/** Practice-mode bot difficulty (local only — never used for online play). */
export const BOT = {
  reactionMs: 220,
  aimErrorRadians: 0.18,
  fireCooldownMs: 350,
};
