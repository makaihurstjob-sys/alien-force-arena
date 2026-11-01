export const TRAINING_KEY = "alien-force-flight-school-v1";
const completedInSession = new Set<string>();
export function trainingComplete(
  owner: string | null,
  storage: Pick<Storage, "getItem"> | undefined = undefined,
) {
  const key = owner ?? "guest";
  if (completedInSession.has(key)) return true;
  try {
    storage ??= globalThis.localStorage;
    const data = JSON.parse(storage?.getItem(TRAINING_KEY) ?? "{}");
    return data?.version === 1 && typeof data.completed?.[key] === "string";
  } catch {
    return false;
  }
}
export function completeTraining(
  owner: string | null,
  storage: Pick<Storage, "getItem" | "setItem"> | undefined = undefined,
) {
  const key = owner ?? "guest";
  completedInSession.add(key);
  try {
    storage ??= globalThis.localStorage;
    let saved: unknown;
    try {
      saved = JSON.parse(storage?.getItem(TRAINING_KEY) ?? "{}");
    } catch {
      saved = {};
    }
    const data = saved as { version?: number; completed?: Record<string, string> };
    storage?.setItem(
      TRAINING_KEY,
      JSON.stringify({
        version: 1,
        completed: {
          ...(data?.version === 1 ? data.completed : {}),
          [key]: new Date().toISOString(),
        },
      }),
    );
    return !!storage;
  } catch {
    return false;
  }
}
