import { describe, expect, it } from "vitest";
import { adventureStory } from "./adventure-story";
describe("Adventure narrative", () => {
  it("introduces the rescue pilot, a personal reason, and a mission before boarding", () => {
    const origin = adventureStory("origin", 1);
    expect(origin.map((beat) => beat.art)).toEqual(["home", "blockade", "promise"]);
    expect(origin.every((beat) => beat.duration > 0)).toBe(true);
    expect(origin.map((beat) => beat.text).join(" ")).toContain("bring everyone home");
  });
  it("holds at the boarding confirmation instead of starting combat on a timer", () => {
    expect(adventureStory("boarding", 1).at(-1)).toMatchObject({ art: "launch", duration: 0 });
    expect(adventureStory("transfer", 21).at(-1)).toMatchObject({ art: "reserve", duration: 0 });
  });
});
