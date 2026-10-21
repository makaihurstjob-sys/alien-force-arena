import { useMusicStation } from "@/lib/music";

const MENU_TRACKS = ["audio/command-deck-loop.wav"];

/** Loops the Command Deck theme on the main menu; pauses in place while `active` is false (lobbies and matches). */
export function useMenuMusic(active: boolean) {
  useMusicStation("menu", MENU_TRACKS, active);
}
