import { adventureSector, type ClassicState } from "../game/classic/engine";
export type FilmScene = NonNullable<ClassicState["scene"]>;
export type StoryBeat = {
  title: string;
  text: string;
  art: "home" | "blockade" | "promise" | "boarding" | "launch" | "gate" | "escape" | "reserve";
  duration: number;
};
export function adventureStory(scene: FilmScene, level: number): StoryBeat[] {
  if (scene === "origin")
    return [
      {
        title: "Before the silence",
        art: "home",
        duration: 9500,
        text: "Ari Vega was a rescue pilot, carrying families between the stars. The Sentinel drones guarded those routes. Then a signal from the Core changed everything. The guardians stopped protecting people—and started hunting them.",
      },
      {
        title: "One voice made it through",
        art: "blockade",
        duration: 10500,
        text: "When the blockade reached Ari’s home, a final distress call escaped: “We’re still here. Don’t let the lights go out.” Across the universe, the same signal was taking control of every gate. Ari refused to leave those voices unanswered.",
      },
      {
        title: "A promise worth fighting for",
        art: "promise",
        duration: 10000,
        text: "The drone commanders carry the keys to the Core. Defeat them, reopen the gates, and cut off the signal before the last safe worlds fall. Ari has no army—only an old rescue ship and a promise: bring everyone home.",
      },
    ];
  if (scene === "boarding")
    return [
      {
        title: "Last Light",
        art: "boarding",
        duration: 8500,
        text: "In a deserted hangar, Ari finds the original white ship: Last Light. Its hull is scarred, but its rescue beacon still works. Ari climbs into the cockpit and sets a course for the first occupied sector.",
      },
      {
        title: "Someone is still out there",
        art: "launch",
        duration: 0,
        text: "“If you can hear me, hold on. I’m coming.” Engines ready. Rescue beacon active. Your mission begins in Sol’s Last Light. Take the controls when you’re ready.",
      },
    ];
  return [
    {
      title: `Beyond the gate · Level ${level}`,
      art: "gate",
      duration: 7500,
      text: "The commander’s signal fades. Ari guides the ship through the unlocked door, leaving a freed sector behind. On the other side, an emergency hangar answers the rescue beacon.",
    },
    {
      title: "The ship brought you this far",
      art: "escape",
      duration: 8500,
      text: "Reactor warning. The engines fail as the ship reaches the landing pad. Ari shuts down the damaged reactor, opens the canopy, and climbs out. The pilot is safe. The mission is not over.",
    },
    {
      title: "A new hull. The same promise.",
      art: "reserve",
      duration: 0,
      text: `A different-colored reserve ship waits in the dock. Ari carries the rescue beacon across the hangar and boards the new craft. Next destination: ${adventureSector(level).name}. There are still people waiting to come home.`,
    },
  ];
}
