import { describe, expect, it } from "vitest";
import {
  createClassic,
  tickClassic,
  finishAdventureScene,
  EXIT_DOOR,
  adventureSector,
} from "./engine";
const idle = { direction: null, fire: false };
const adventure = (level: number) => createClassic(level, () => 0.5, true);
function clear(level: number) {
  const s = adventure(level);
  s.scene = undefined;
  s.phase = "playing";
  s.enemies = [];
  tickClassic(s, idle);
  return s;
}
describe("Adventure campaign", () => {
  it("freezes combat during origin and boarding, then requires fresh movement", () => {
    const s = adventure(1);
    const snapshot = JSON.stringify(s);
    tickClassic(s, { direction: "left", fire: true }, 10);
    expect(JSON.stringify(s)).toBe(snapshot);
    finishAdventureScene(s);
    expect(s.scene).toBe("boarding");
    finishAdventureScene(s);
    expect(s.scene).toBe("arrival");
    finishAdventureScene(s);
    expect(s.scene).toBeUndefined();
    tickClassic(s, { direction: "left", fire: false });
    expect(s.phase).toBe("waiting");
    tickClassic(s, idle);
    tickClassic(s, { direction: "left", fire: false });
    expect(s.phase).toBe("playing");
  });
  it.each([20, 40, 60, 980])("spawns an armored firing commander every 20 levels: %s", (level) => {
    const s = adventure(level);
    expect(s.enemies).toHaveLength(1);
    expect(s.enemies[0]).toMatchObject({ boss: true, canFire: true });
    expect(s.enemies[0]!.health).toBeGreaterThanOrEqual(10);
    expect(adventure(level - 1).enemies.some((e) => e.boss)).toBe(false);
    expect(adventure(level + 1).enemies.some((e) => e.boss)).toBe(false);
  });
  it("waits indefinitely for the pilot to fly through the door and awards the bonus once", () => {
    const s = clear(1);
    const score = s.score;
    for (let i = 0; i < 300; i++) tickClassic(s, idle);
    expect(s.level).toBe(1);
    expect(s.score).toBe(score);
    expect(s.levelsCleared).toBe(1);
    s.player = { ...s.player, x: EXIT_DOOR.x, y: 52, direction: "up" };
    for (let i = 0; i < 30; i++) tickClassic(s, { direction: "up", fire: false });
    expect(s.level).toBe(2);
    expect(s.scene).toBe("travel");
    expect(s.enemies).toHaveLength(10);
  });
  it.each([20, 40, 120, 980])(
    "plays one transfer and retains the new color after boss %s",
    (level) => {
      const s = clear(level);
      const old = s.shipColor;
      s.player = { ...s.player, ...EXIT_DOOR };
      tickClassic(s, idle);
      expect(s.level).toBe(level + 1);
      expect(s.scene).toBe("travel");
      finishAdventureScene(s);
      expect(s.scene).toBe("transfer");
      expect(s.previousShipColor).toBe(old);
      expect(s.shipColor).not.toBe(old);
      const color = s.shipColor;
      tickClassic(s, idle, 10);
      expect(s.level).toBe(level + 1);
      finishAdventureScene(s);
      tickClassic(s, idle);
      expect(s.shipColor).toBe(color);
    },
  );
  it("ends the campaign at 999 rather than replaying it", () => {
    const s = clear(999);
    s.player = { ...s.player, ...EXIT_DOOR };
    tickClassic(s, idle);
    expect(s.completed).toBe(true);
    expect(s.phase).toBe("game_over");
    expect(s.level).toBe(999);
  });
  it("groups named sectors in 20-level ranges", () => {
    expect(adventureSector(1)).toEqual(adventureSector(20));
    expect(adventureSector(21).number).toBe(2);
    expect(adventureSector(999).number).toBe(50);
  });
});

it("gates every level through travel, route and bottom-right arrival without starting combat",()=>{
 const s=clear(3);s.player={...s.player,...EXIT_DOOR};tickClassic(s,idle);
 expect(s.scene).toBe("travel");const before=s.elapsed;
 tickClassic(s,{direction:"left",fire:true},10);expect(s.elapsed).toBe(before);
 finishAdventureScene(s);expect(s.scene).toBe("route");finishAdventureScene(s);expect(s.scene).toBe("arrival");
 expect(s.player).toMatchObject({x:412,y:412,direction:"left"});finishAdventureScene(s);expect(s.scene).toBeUndefined();
 tickClassic(s,{direction:"left",fire:true});expect(s.phase).toBe("waiting");tickClassic(s,idle);tickClassic(s,{direction:"left",fire:false});expect(s.phase).toBe("playing");
});
it("celebration is visual and never changes the cleared level's combat result",()=>{
 const s=clear(4);const score=s.score;for(let i=0;i<180;i++)tickClassic(s,idle);
 expect(s.celebrationTime).toBeGreaterThan(2);expect(s.level).toBe(4);expect(s.score).toBe(score);expect(s.shots).toEqual([]);
});
