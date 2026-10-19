import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("saved keyboard controls", () => {
  beforeEach(() => {
    vi.resetModules();
    const items = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps cleared controls unbound after reload without discarding alternate keys", async () => {
    const { defaults, saveBindings } = await import("./keybindings");
    saveBindings({ ...structuredClone(defaults), thrust: ["KeyI", "ArrowUp"], fire: [] });
    vi.resetModules();
    const { loadBindings, inputAction, matches, keyboardHelp } = await import("./keybindings");
    expect(loadBindings().fire).toEqual([]);
    expect(loadBindings().thrust).toEqual(["KeyI", "ArrowUp"]);
    expect(inputAction("KeyI")).toBe("thrust");
    expect(inputAction("KeyW")).toBeUndefined();
    expect(matches("fire", "Space")).toBe(false);
    expect(keyboardHelp()).toContain("Fire: Unbound");
  });

  it("updates the active input mapping when saved and restores all default alternatives", async () => {
    const { defaults, saveBindings, matches } = await import("./keybindings");
    expect(matches("thrust", "KeyW")).toBe(true);
    saveBindings({ ...structuredClone(defaults), thrust: ["KeyI", "ArrowUp"] });
    expect(matches("thrust", "KeyW")).toBe(false);
    expect(matches("thrust", "KeyI")).toBe(true);
    saveBindings(structuredClone(defaults));
    expect(matches("thrust", "KeyW")).toBe(true);
    expect(matches("dash", "KeyQ")).toBe(true);
    expect(matches("pause", "Escape")).toBe(true);
  });
});
