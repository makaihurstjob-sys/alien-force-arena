import { createMatch as createFlightMatch, step as stepFlight } from "../engine";
import {
  createPowerDuelMatch,
  stepPowerDuel,
  type PowerDuelMatch,
  type PowerUpKind,
} from "../classic/powerup-duel";
import { TICK_MS } from "../config";
import { EMPTY_INPUT, type GameState, type PlayerInput } from "../types";

export const TRAINING_LESSONS = [
  {
    id: "flight",
    title: "Find your wings",
    arena: "flight",
    text: "Welcome, pilot. I’m AX-7, your flight instructor. In Practice, left and right rotate your ship; up fires the thrusters and down reverses thrust. Fly a short distance and change your heading.",
    goal: "Travel 70 pixels and steer your ship.",
  },
  {
    id: "shot",
    title: "One shot. Make it count.",
    arena: "flight",
    text: "Line up with the stationary target and fire. Normally, you can only have one shot in flight. Wait until it hits or clears the arena before firing again.",
    goal: "Hit the training drone with a real shot.",
  },
  {
    id: "lanes",
    title: "Learn the combat grid",
    arena: "grid",
    text: "Adventure, Versus and Arcade use lanes instead of Practice’s free flight. A direction chooses where to go. Your ship keeps moving; turns are buffered until the next crossing. Try two directions.",
    goal: "Move 45 pixels and use two different directions.",
  },
  {
    id: "reverse",
    title: "Turn the tables",
    arena: "grid",
    text: "The turn-around action instantly flips your heading. Use it when a drone closes in or when you need to get back to the last crossing. Try it now.",
    goal: "Perform a turn-around.",
  },
  {
    id: "shield",
    title: "Shield · S",
    arena: "grid",
    power: "shield",
    text: "Fly into the blue S pickup. A shield protects you briefly. I’ll send a harmless training shot toward you once it is active. Keep your shield between the shot and your hull.",
    goal: "Collect Shield and survive the incoming shot.",
  },
  {
    id: "freeze",
    title: "Freeze Shot · snowflake",
    arena: "grid",
    power: "freeze",
    text: "Collect the snowflake. It loads your next shot with a short freeze instead of an elimination. Fire at the target to lock its movement and weapons. Shields can block freeze shots.",
    goal: "Collect Freeze Shot and freeze the target.",
  },
  {
    id: "rapid",
    title: "Rapid Fire · F",
    arena: "grid",
    power: "rapidFire",
    text: "Collect the yellow F. While Rapid Fire is active, the normal one-shot limit is lifted. Hold Fire and put at least two shots in the air at once.",
    goal: "Collect Rapid Fire and launch two simultaneous shots.",
  },
  {
    id: "speed",
    title: "Speed Boost · B",
    arena: "grid",
    power: "speedBoost",
    text: "Collect the green B, then steer. The boost increases your speed for a short time. Plan your next crossing early—you are covering the lanes faster now.",
    goal: "Collect Speed Boost and steer for 60 boosted pixels.",
  },
  {
    id: "teleport",
    title: "Teleport · T",
    arena: "grid",
    power: "teleport",
    text: "Collect the purple T. It stores one teleport charge. Hold a direction and use Dash / Teleport to jump three lane cells. With no direction held, you jump in your current heading.",
    goal: "Collect Teleport and spend its charge on a jump.",
  },
] as const;
export type TrainingSession = {
  index: number;
  match: PowerDuelMatch;
  flight: GameState;
  passed: boolean;
  started: boolean;
  distance: number;
  boostedDistance: number;
  turned: boolean;
  directions: Set<string>;
  shieldShotAt: number | null;
  shieldCollected: boolean;
  powerCollected: boolean;
};
const players = [
  { id: "you", name: "YOU", team: 0 as const },
  { id: "trainer", name: "TRAINING DRONE", team: 1 as const },
];
export function createTraining(index = 0): TrainingSession {
  const match = createPowerDuelMatch(players);
  match.game.phase = "playing";
  match.game.phaseTimerMs = 1e9;
  match.nextSpawnAtTick = Number.MAX_SAFE_INTEGER;
  Object.assign(match.game.ships[0]!, { x: 212, y: 212, angle: 0 });
  Object.assign(match.game.ships[1]!, { x: 332, y: 212, angle: Math.PI });
  const flight = createFlightMatch(players, "pillars");
  flight.phase = "playing";
  flight.phaseTimerMs = 1e9;
  Object.assign(flight.ships[0]!, { x: 80, y: 70, angle: 0 });
  Object.assign(flight.ships[1]!, { x: 260, y: 70, angle: Math.PI });
  const lesson = TRAINING_LESSONS[index]!;
  if ("power" in lesson)
    match.pickup = {
      id: "lesson-pickup",
      kind: lesson.power as PowerUpKind,
      x: lesson.id === "shield" ? 252 : 212,
      y: 212,
    };
  if (lesson.id === "rapid" || lesson.id === "speed" || lesson.id === "teleport")
    Object.assign(match.game.ships[1]!, { x: 412, y: 12 });
  return {
    index,
    match,
    flight,
    passed: false,
    started: false,
    distance: 0,
    boostedDistance: 0,
    turned: false,
    directions: new Set(),
    shieldShotAt: null,
    shieldCollected: false,
    powerCollected: false,
  };
}
export function stepTraining(session: TrainingSession, input: PlayerInput) {
  if (session.passed) return;
  const lesson = TRAINING_LESSONS[session.index]!;
  if (
    input.thrust ||
    input.reverse ||
    input.left ||
    input.right ||
    input.fire ||
    input.turnaround ||
    input.dash
  )
    session.started = true;
  if (!session.started) return;
  for (const direction of ["thrust", "reverse", "left", "right"] as const)
    if (input[direction]) session.directions.add(direction);
  if (lesson.arena === "flight") {
    const me = session.flight.ships[0]!;
    const target = session.flight.ships[1]!;
    const before = { x: me.x, y: me.y };
    stepFlight(session.flight, { you: input, trainer: { ...EMPTY_INPUT } }, "pillars");
    session.distance += Math.hypot(me.x - before.x, me.y - before.y);
    session.turned ||= Math.abs(me.angle) > 0.3;
    Object.assign(target, { x: 260, y: 70, vx: 0, vy: 0 });
    session.passed =
      lesson.id === "flight" ? session.distance >= 70 && session.turned : me.hits > 0;
    if (!me.alive && !session.passed) {
      me.alive = true;
      session.flight.phase = "playing";
      session.flight.phaseTimerMs = 1e9;
    }
    return;
  }
  const { match } = session;
  const me = match.game.ships[0]!;
  const target = match.game.ships[1]!;
  const before = { x: me.x, y: me.y, shots: me.shots, angle: me.angle };
  const targetPosition = { x: target.x, y: target.y, angle: target.angle };
  const charge = match.teleportCharges.get("you") ?? 0;
  const shield = match.buffs.get("you")?.kind === "shield";
  // A stationary range target; the actual combat/power-up engine resolves all hits.
  const actionInput =
    "power" in lesson && !session.powerCollected ? { ...input, fire: false, dash: false } : input;
  stepPowerDuel(match, { you: actionInput, trainer: { ...EMPTY_INPUT } }, () => 0.5);
  Object.assign(target, targetPosition);
  session.distance += Math.hypot(me.x - before.x, me.y - before.y);
  const buff = match.buffs.get("you");
  session.powerCollected ||= !!buff || (match.teleportCharges.get("you") ?? 0) > 0;
  if (buff?.kind === "speedBoost" && (input.thrust || input.reverse || input.left || input.right))
    session.boostedDistance += Math.hypot(me.x - before.x, me.y - before.y);
  session.shieldCollected ||= buff?.kind === "shield";
  if (lesson.id === "shield" && buff?.kind === "shield" && session.shieldShotAt === null) {
    session.shieldShotAt = match.game.tick;
    match.game.projectiles.push({
      id: "shield-training-shot",
      ownerId: "trainer",
      team: 1,
      x: Math.min(420, me.x + 55),
      y: me.y,
      vx: -250,
      vy: 0,
      ageMs: 0,
    });
  }
  switch (lesson.id) {
    case "lanes":
      session.passed = session.distance >= 45 && session.directions.size >= 2;
      break;
    case "reverse":
      session.passed = !!input.turnaround && Math.cos(me.angle) < -0.9;
      break;
    case "shield":
      session.passed =
        session.shieldCollected &&
        me.alive &&
        session.shieldShotAt !== null &&
        match.game.tick - session.shieldShotAt > 50;
      break;
    case "freeze":
      session.passed = (match.frozenUntil.get("trainer") ?? 0) > match.game.tick;
      break;
    case "rapid":
      session.passed =
        session.powerCollected &&
        match.game.projectiles.filter((p) => p.ownerId === "you").length >= 2;
      break;
    case "speed":
      session.passed = session.boostedDistance >= 60;
      break;
    case "teleport":
      session.passed =
        charge > 0 &&
        (match.teleportCharges.get("you") ?? 0) === 0 &&
        Math.hypot(me.x - before.x, me.y - before.y) > 60;
      break;
  }
  // No learner failure can trap the lesson: offer a retry while retaining a live range.
  if (!me.alive && !session.passed) {
    me.alive = true;
    Object.assign(me, { x: 212, y: 212 });
    match.game.phase = "playing";
    match.game.phaseTimerMs = 1e9;
  }
}
