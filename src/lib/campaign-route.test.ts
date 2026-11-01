import { describe, it, expect } from "vitest";
import { campaignRoute } from "./campaign-route";
describe("Campaign route", () => {
  it("has one current mission, completed predecessors, and locked successors", () => {
    const nodes = campaignRoute(7);
    expect(nodes).toHaveLength(20);
    expect(nodes.filter((n) => n.state === "current").map((n) => n.level)).toEqual([7]);
    expect(nodes.filter((n) => n.state === "cleared")).toHaveLength(6);
    expect(nodes.filter((n) => n.state === "locked")).toHaveLength(13);
    expect(nodes.at(-1)?.boss).toBe(true);
  });
  it("never produces level 1000 or a selectable alternate destination", () => {
    const last = campaignRoute(999);
    expect(last).toHaveLength(19);
    expect(last.at(-1)).toMatchObject({ level: 999, boss: true, state: "current" });
    expect(campaignRoute(21, 1).every((n) => n.state === "cleared")).toBe(true);
  });
});
