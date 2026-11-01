import { describe, it, expect } from "vitest";
import { createTraining, stepTraining, TRAINING_LESSONS } from "./flight-school";
import { EMPTY_INPUT } from "../types";
function run(index: number, input: Partial<typeof EMPTY_INPUT>, ticks = 300) {
  const s = createTraining(index);
  for (let i = 0; i < ticks && !s.passed; i++) stepTraining(s, { ...EMPTY_INPUT, ...input });
  return s;
}
describe("Flight School real gameplay objectives", () => {
  it("does not complete a lesson from idle or a Next click", () => {
    const s = createTraining();
    for (let i = 0; i < 1000; i++) stepTraining(s, { ...EMPTY_INPUT });
    expect(s.started).toBe(false);
    expect(s.passed).toBe(false);
    expect(s.distance).toBe(0);
  });
  it("requires flight distance and steering in Practice physics", () => {
    expect(run(0, { thrust: true, right: true }, 600).passed).toBe(true);
    expect(run(0, { right: true }, 120).passed).toBe(false);
  });
  it("uses a real projectile hit for the firing lesson", () => {
    const s = run(1, { fire: true });
    expect(s.passed).toBe(true);
    expect(s.flight.ships[0]!.hits).toBeGreaterThan(0);
  });
  it("teaches buffered grid movement and turn-around", () => {
    const s = createTraining(2);
    for (let i = 0; i < 40; i++) stepTraining(s, { ...EMPTY_INPUT, left: true });
    expect(s.passed).toBe(false);
    for (let i = 0; i < 60; i++) stepTraining(s, { ...EMPTY_INPUT, thrust: true });
    expect(s.passed).toBe(true);
    expect(run(3, { turnaround: true }).passed).toBe(true);
  });
  it.each([4, 5, 6, 7, 8])("uses actual pickups and effects for power lesson %s", (index) => {
    const input =
      index === 4 || index === 7
        ? { right: true }
        : index === 8
          ? { right: true, dash: true }
          : { fire: true };
    const s = run(index, input);
    expect(s.passed).toBe(true);
    expect(s.powerCollected).toBe(true);
    if (index === 4) expect(s.shieldCollected).toBe(true);
    if (index === 5) expect(s.match.frozenUntil.has("trainer")).toBe(true);
    if (index === 6)
      expect(
        s.match.game.projectiles.filter((p) => p.ownerId === "you").length,
      ).toBeGreaterThanOrEqual(2);
    if (index === 8) expect(s.match.teleportCharges.get("you")).toBe(0);
  });
  it("covers every power-up supported by Arcade", () => {
    expect(
      TRAINING_LESSONS.filter((l) => "power" in l)
        .map((l) => ("power" in l ? l.power : ""))
        .sort(),
    ).toEqual(["freeze", "rapidFire", "shield", "speedBoost", "teleport"]);
  });
});
