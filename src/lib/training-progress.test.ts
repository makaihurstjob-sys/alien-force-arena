import { describe, it, expect } from "vitest";
import { completeTraining, trainingComplete, TRAINING_KEY } from "./training-progress";
describe("First-flight completion", () => {
  it("persists completion by pilot, without marking another account trained", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    expect(trainingComplete("pilot-a", storage)).toBe(false);
    expect(completeTraining("pilot-a", storage)).toBe(true);
    expect(trainingComplete("pilot-a", storage)).toBe(true);
    expect(trainingComplete("pilot-b", storage)).toBe(false);
    expect(JSON.parse(values.get(TRAINING_KEY)!).version).toBe(1);
  });
  it("treats corrupt data as untrained and survives denied storage for the current session", () => {
    const broken = {
      getItem: () => "{broken",
      setItem: () => {
        throw Error("denied");
      },
    };
    expect(trainingComplete("pilot-c", broken)).toBe(false);
    expect(completeTraining("pilot-c", broken)).toBe(false);
    expect(trainingComplete("pilot-c", broken)).toBe(true);
  });
});
