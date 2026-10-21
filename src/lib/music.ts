import { useCallback, useEffect, useSyncExternalStore } from "react";

const MUTED_KEY = "alien-force-music-muted";
const VOLUME = 0.4;
const PLAYS = 2; // in a multi-track station, each track loops twice before the next one
const CROSSFADE = 2.5;
const GESTURES = ["pointerdown", "keydown", "touchend"] as const;

// ---------------------------------------------------------------- saved Music setting
const listeners = new Set<() => void>();
let muted: boolean | undefined;

function readMuted() {
  if (muted === undefined) {
    try { muted = localStorage.getItem(MUTED_KEY) === "true"; } catch { muted = false; }
  }
  return muted;
}

function setMusicMuted(value: boolean) {
  muted = value;
  try { localStorage.setItem(MUTED_KEY, String(value)); } catch { /* Keep the in-memory choice. */ }
  stations.forEach((station) => station.refresh());
  listeners.forEach((listener) => listener());
}

/** The shared Music on/off setting; every toggle (intro, menu, lobby) stays in sync. */
export function useMusicMuted() {
  const value = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    readMuted,
    () => false,
  );
  const toggleMuted = useCallback(() => setMusicMuted(!readMuted()), []);
  return { muted: value, toggleMuted };
}

// ---------------------------------------------------------------- stations
type Station = { users: number; active: number; closing?: number; refresh: () => void; close: () => void };
const stations = new Map<string, Station>();

function fadeTo(output: GainNode, value: number, seconds: number) {
  const now = output.context.currentTime;
  output.gain.cancelScheduledValues(now);
  output.gain.setValueAtTime(output.gain.value, now);
  output.gain.linearRampToValueAtTime(value, now + seconds);
}

function openStation(name: string, tracks: string[]): Station | null {
  const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  const ctx = new Context();
  const output = ctx.createGain();
  output.gain.value = 0;
  output.connect(ctx.destination);
  const silent = ctx.createGain(); // keeps the queue timers in the audio graph without making sound
  silent.gain.value = 0;
  silent.connect(ctx.destination);
  const sources = new Set<AudioBufferSourceNode>();
  let closed = false;
  let loaded = false;
  let pause: number | undefined;
  const resume = () => {
    if (!station.active) return;
    void ctx.resume().then(() => {
      if (ctx.state === "running") GESTURES.forEach((event) => window.removeEventListener(event, resume, true));
    }, () => {});
  };

  // Schedules track `index` at audio time `when`, then queues the following track to overlap its fade-out.
  const play = (buffers: AudioBuffer[], index: number, when: number) => {
    if (closed) return;
    const buffer = buffers[index % buffers.length]!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    sources.add(source);
    source.onended = () => sources.delete(source);
    if (buffers.length === 1) { // a single theme just loops gaplessly
      source.connect(output);
      source.start(when);
      return;
    }
    const end = when + buffer.duration * PLAYS;
    const fade = ctx.createGain();
    fade.gain.setValueAtTime(0, when);
    fade.gain.linearRampToValueAtTime(1, when + CROSSFADE);
    fade.gain.setValueAtTime(1, end - CROSSFADE);
    fade.gain.linearRampToValueAtTime(0, end);
    fade.connect(output);
    source.connect(fade);
    source.onended = () => { sources.delete(source); fade.disconnect(); };
    source.start(when);
    source.stop(end);
    // Audio time pauses while the context is suspended, so a timer could fire early; queue from audio time instead.
    const queue = ctx.createConstantSource();
    queue.connect(silent);
    queue.onended = () => { queue.disconnect(); play(buffers, index + 1, end - CROSSFADE); };
    queue.start(when);
    queue.stop(Math.max(when, end - CROSSFADE - 1));
  };

  const station: Station = {
    users: 0,
    active: 0,
    // Fades to the current target: audible only while some screen wants this station and Music is on.
    refresh: () => {
      if (!loaded) return;
      window.clearTimeout(pause);
      if (station.active) {
        resume();
        fadeTo(output, readMuted() ? 0 : VOLUME, 0.4);
      } else {
        fadeTo(output, 0, 0.4);
        pause = window.setTimeout(() => { if (!station.active) void ctx.suspend(); }, 500); // keeps its place
      }
    },
    close: () => {
      closed = true;
      stations.delete(name);
      window.clearTimeout(pause);
      GESTURES.forEach((event) => window.removeEventListener(event, resume, true));
      sources.forEach((source) => { try { source.stop(); } catch { /* Not started yet. */ } });
      void ctx.close();
    },
  };
  GESTURES.forEach((event) => window.addEventListener(event, resume, true));

  Promise.all(tracks.map((path) =>
    fetch(import.meta.env.BASE_URL + path)
      .then((response) => response.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))))
    .then((buffers) => {
      if (closed) return;
      play(buffers, 0, ctx.currentTime + 0.05);
      loaded = true;
      output.gain.setValueAtTime(0, ctx.currentTime);
      if (station.active) {
        resume();
        output.gain.linearRampToValueAtTime(readMuted() ? 0 : VOLUME, ctx.currentTime + 1.5);
      } else station.refresh();
    })
    .catch(() => { /* Music is optional; the screen stays silent. */ });
  return station;
}

/**
 * Plays a named music station while a screen is mounted and `active`. One shared instance per name,
 * so remounting a screen keeps the song going; an inactive station fades out and pauses in place.
 */
export function useMusicStation(name: string, tracks: string[], active = true) {
  useEffect(() => {
    let station = stations.get(name);
    if (!station) {
      station = openStation(name, tracks) ?? undefined;
      if (!station) return;
      stations.set(name, station);
    }
    const current = station;
    window.clearTimeout(current.closing);
    current.users += 1;
    return () => {
      current.users -= 1;
      if (current.users > 0) return;
      current.closing = window.setTimeout(() => { if (current.users === 0) current.close(); }, 600);
    };
    // Track lists are constant per station name.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  useEffect(() => {
    const station = stations.get(name);
    if (!station || !active) return;
    station.active += 1;
    station.refresh();
    return () => {
      station.active -= 1;
      station.refresh();
    };
  }, [name, active]);
}
