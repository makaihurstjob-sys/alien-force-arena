import { useCallback, useEffect, useState } from "react";

const MUTED_KEY = "alien-force-music-muted";
const VOLUME = 0.4;
const TRACKS = ["audio/hangar-standby-loop.wav", "audio/signal-lock-loop.wav"];
const PLAYS = 2; // each station track loops twice before the next one
const CROSSFADE = 2.5;
const GESTURES = ["pointerdown", "keydown", "touchend"] as const;

type Radio = { ctx: AudioContext; output: GainNode; users: number; closing?: number; close: () => void };
let radio: Radio | null = null;

function readMuted() {
  try { return localStorage.getItem(MUTED_KEY) === "true"; } catch { return false; }
}

function fadeTo(output: GainNode, value: number, seconds: number) {
  const now = output.context.currentTime;
  output.gain.cancelScheduledValues(now);
  output.gain.setValueAtTime(output.gain.value, now);
  output.gain.linearRampToValueAtTime(value, now + seconds);
}

/** One shared station so remounting the lobby (mode or room changes) keeps the song going. */
function acquireRadio(): Radio | null {
  if (radio) {
    window.clearTimeout(radio.closing);
    radio.users += 1;
    fadeTo(radio.output, readMuted() ? 0 : VOLUME, 0.4);
    return radio;
  }
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
  const resume = () => {
    void ctx.resume().then(() => {
      if (ctx.state === "running") GESTURES.forEach((name) => window.removeEventListener(name, resume, true));
    }, () => {});
  };
  GESTURES.forEach((name) => window.addEventListener(name, resume, true));
  resume();

  // Schedules track `index` at audio time `when`, then queues the following track to overlap its fade-out.
  const play = (buffers: AudioBuffer[], index: number, when: number) => {
    if (closed) return;
    const buffer = buffers[index % buffers.length]!;
    const end = when + buffer.duration * PLAYS;
    const fade = ctx.createGain();
    fade.gain.setValueAtTime(0, when);
    fade.gain.linearRampToValueAtTime(1, when + CROSSFADE);
    fade.gain.setValueAtTime(1, end - CROSSFADE);
    fade.gain.linearRampToValueAtTime(0, end);
    fade.connect(output);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(fade);
    source.onended = () => { sources.delete(source); fade.disconnect(); };
    sources.add(source);
    source.start(when);
    source.stop(end);
    // Audio time pauses while the context is suspended, so a timer could fire early; queue from audio time instead.
    const queue = ctx.createConstantSource();
    queue.connect(silent);
    queue.onended = () => { queue.disconnect(); play(buffers, index + 1, end - CROSSFADE); };
    queue.start(when);
    queue.stop(Math.max(when, end - CROSSFADE - 1));
  };

  Promise.all(TRACKS.map((path) =>
    fetch(import.meta.env.BASE_URL + path)
      .then((response) => response.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))))
    .then((buffers) => {
      if (closed) return;
      play(buffers, 0, ctx.currentTime + 0.05);
      output.gain.setValueAtTime(0, ctx.currentTime);
      output.gain.linearRampToValueAtTime(readMuted() ? 0 : VOLUME, ctx.currentTime + 1.5);
    })
    .catch(() => { /* Music is optional; the lobby stays silent. */ });

  radio = {
    ctx,
    output,
    users: 1,
    close: () => {
      closed = true;
      GESTURES.forEach((name) => window.removeEventListener(name, resume, true));
      sources.forEach((source) => { try { source.stop(); } catch { /* Not started yet. */ } });
      void ctx.close();
    },
  };
  return radio;
}

function releaseRadio(current: Radio) {
  current.users -= 1;
  if (current.users > 0) return;
  fadeTo(current.output, 0, 0.4);
  current.closing = window.setTimeout(() => {
    if (radio === current && current.users === 0) {
      radio = null;
      current.close();
    }
  }, 600);
}

/** Plays Hangar Standby and Signal Lock back to back, like a radio station, while a lobby is open. */
export function useLobbyRadio() {
  const [muted, setMuted] = useState(readMuted);

  useEffect(() => {
    const current = acquireRadio();
    return () => { if (current) releaseRadio(current); };
  }, []);

  useEffect(() => {
    if (radio) fadeTo(radio.output, muted ? 0 : VOLUME, 0.15);
  }, [muted]);

  const toggleMuted = useCallback(() => {
    setMuted((value) => {
      try { localStorage.setItem(MUTED_KEY, String(!value)); } catch { /* Keep the in-memory choice. */ }
      return !value;
    });
  }, []);

  return { muted, toggleMuted };
}
