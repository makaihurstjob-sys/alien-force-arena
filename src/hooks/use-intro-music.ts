import { useEffect, useRef } from "react";
import { useMusicMuted } from "@/lib/music";

const VOLUME = 0.45;
const GESTURES = ["pointerdown", "keydown", "touchend"] as const;

/** Loops the Deep Signal intro theme gaplessly; browsers hold it until the first tap or key. */
export function useIntroMusic(exiting: boolean) {
  const { muted, toggleMuted } = useMusicMuted();
  const gain = useRef<GainNode | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useEffect(() => {
    const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const ctx = new Context();
    const output = ctx.createGain();
    output.gain.value = 0;
    output.connect(ctx.destination);
    gain.current = output;
    let source: AudioBufferSourceNode | undefined;
    let disposed = false;
    const resume = () => {
      void ctx.resume().then(() => {
        if (ctx.state === "running") GESTURES.forEach((name) => window.removeEventListener(name, resume, true));
      }, () => {});
    };
    GESTURES.forEach((name) => window.addEventListener(name, resume, true));
    resume();
    void fetch(import.meta.env.BASE_URL + "audio/deep-signal-loop.wav")
      .then((response) => response.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        if (disposed) return;
        source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(output);
        source.start();
        // Audio time stands still while suspended, so the fade-in waits for the first gesture.
        output.gain.setValueAtTime(0, ctx.currentTime);
        output.gain.linearRampToValueAtTime(mutedRef.current ? 0 : VOLUME, ctx.currentTime + 1.5);
      })
      .catch(() => { /* Music is optional; the intro plays silently. */ });
    return () => {
      disposed = true;
      GESTURES.forEach((name) => window.removeEventListener(name, resume, true));
      try { source?.stop(); } catch { /* Not started yet. */ }
      gain.current = null;
      void ctx.close();
    };
  }, []);

  useEffect(() => {
    const output = gain.current;
    if (!output) return;
    const now = output.context.currentTime;
    output.gain.cancelScheduledValues(now);
    output.gain.setValueAtTime(output.gain.value, now);
    output.gain.linearRampToValueAtTime(muted || exiting ? 0 : VOLUME, now + (exiting ? 0.4 : 0.15));
  }, [muted, exiting]);

  return { muted, toggleMuted };
}
