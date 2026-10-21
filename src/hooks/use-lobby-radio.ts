import { useMusicMuted, useMusicStation } from "@/lib/music";

const LOBBY_TRACKS = ["audio/hangar-standby-loop.wav", "audio/signal-lock-loop.wav"];

/** Plays Hangar Standby and Signal Lock back to back, like a radio station, while a lobby is open. */
export function useLobbyRadio() {
  useMusicStation("lobby", LOBBY_TRACKS);
  return useMusicMuted();
}
