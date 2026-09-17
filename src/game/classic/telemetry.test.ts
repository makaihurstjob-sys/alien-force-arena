import { describe, it, expect } from "vitest";
import { createClassic, tickClassic } from "./engine";
import { snapshotRun } from "../../lib/classic-records";

const idle = { direction: null, fire: false };
describe("Classic run telemetry", () => {
  it("counts life-losing collisions once, ignoring invulnerability and countdowns", () => {
    const s = createClassic(); s.phase = "playing"; s.invulnerable = 0;
    s.enemies = [{ ...s.player, id: 1 }];
    tickClassic(s, idle, 0);
    expect(s.crashes).toBe(1); expect(s.lives).toBe(2);
    tickClassic(s, idle, 0);
    expect(s.crashes).toBe(1);
    s.phase = "playing"; s.enemies = [{ ...s.player, id: 1 }];
    tickClassic(s, idle, 0);
    expect(s.crashes).toBe(1);
  });
  it("separates bullet deaths from crashes", () => {
    const s = createClassic(); s.phase = "playing"; s.invulnerable = 0;
    s.shots = [{ ...s.player, id: 99, owner: 1, y: s.player.y - 1, direction: "down" }];
    tickClassic(s, idle, 0.001);
    expect(s.shotDeaths).toBe(1); expect(s.crashes).toBe(0); expect(s.lives).toBe(2);
  });
  it("counts only actual shots and preserves totals when a life is lost", () => {
    const s = createClassic(); s.phase = "playing"; s.invulnerable = 0;
    tickClassic(s, { ...idle, fire: true }, 0);
    tickClassic(s, { ...idle, fire: true }, 0);
    expect(s.shotsFired).toBe(1);
    s.enemies = [{ ...s.player, id: 1 }]; tickClassic(s, idle, 0);
    expect(s.shotsFired).toBe(1);
  });
  it("tracks cleared levels once and excludes countdown time", () => {
    const s = createClassic(4);
    tickClassic(s, idle, 3); expect(s.elapsed).toBe(0);
    s.enemies = []; tickClassic(s, idle, 0.25);
    expect(s.levelsCleared).toBe(1);
    tickClassic(s, idle, 2);
    expect(s.levelsCleared).toBe(1); expect(s.level).toBe(5); expect(s.startLevel).toBe(4);
    expect(s.elapsed).toBe(0.25);
  });
  it("freezes a completed record so restart cannot change the saved result", () => {
    const s = createClassic(); s.phase = "game_over"; s.elapsed = 2.5; s.score = 90;
    s.shotsFired = 1; s.hits = 1; s.crashes = 3; s.lives = 0;
    const run = snapshotRun(s, "restarted", "player", "run");
    s.score = 0;
    expect(run).toMatchObject({ outcome: "game_over", score: 90, shots: 1, hits: 1, crashes: 3, duration_ms: 2500 });
  });
});
