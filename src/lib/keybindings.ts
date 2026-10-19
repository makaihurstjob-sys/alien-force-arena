export const defaults = {
  thrust: ["KeyW", "ArrowUp"], reverse: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"], right: ["KeyD", "ArrowRight"],
  fire: ["Space"], turnaround: ["KeyR", "KeyB"],
  dash: ["ShiftLeft", "ShiftRight", "KeyQ"], pause: ["KeyP", "Escape"],
};
export type Action = keyof typeof defaults;
export type Bindings = Record<Action, string[]>;
const storageKey = "alien-force-keybindings-v1";
export function loadBindings(): Bindings {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved && Object.keys(defaults).every(key => Array.isArray(saved[key]) && saved[key].every((code: unknown) => typeof code === "string"))) return saved;
  } catch { /* Storage may be unavailable. */ }
  return structuredClone(defaults);
}
let bindings: Bindings | undefined;
export function saveBindings(value: Bindings) {
  localStorage.setItem(storageKey, JSON.stringify(value));
  bindings = structuredClone(value);
}
export function matches(action: Action, code: string) {
  bindings ??= loadBindings();
  return bindings[action].includes(code);
}
export function inputAction(code: string): Exclude<Action, "pause"> | undefined {
  return (Object.keys(defaults) as Action[]).find(action => action !== "pause" && matches(action, code)) as Exclude<Action, "pause"> | undefined;
}
export function keyLabel(code: string) {
  if (code.startsWith("Arrow")) return code.replace("Arrow", "Arrow ");
  return code.replace(/^Key/, "").replace(/^Digit/, "").replace(/^Arrow/, "Arrow ").replace(/Left$/, " Left").replace(/Right$/, " Right");
}

export function keyboardHelp(arcade = false) {
  const value = loadBindings();
  const show = (action: Action) => value[action].map(keyLabel).join(" / ") || "Unbound";
  return `Move: ${['thrust', 'reverse', 'left', 'right'].map(action => show(action as Action)).join(', ')}. Fire: ${show('fire')}. Turn around: ${show('turnaround')}.${arcade ? ` Dash / teleport: ${show('dash')}.` : ''} Pause: ${show('pause')}.`;
}
