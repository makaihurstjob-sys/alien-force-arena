import { useEffect, useRef, useState } from "react";
import spriteSheetUrl from "@/assets/classic/original-sprites.bmp?url";
import "./opening-intro.css";

const DURATION = 8500;

export default function OpeningIntro({ onStart }: { onStart: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready) { startButton.current?.focus(); return; }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) { setReady(true); return; }
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) { setReady(true); return; }
    const sheet = new Image();
    sheet.src = spriteSheetUrl;
    let raf = 0;
    const began = performance.now();
    const onMotionChange = () => { if (reduced.matches) setReady(true); };
    reduced.addEventListener("change", onMotionChange);
    const draw = (now: number) => {
      const elapsed = now - began;
      if (elapsed >= DURATION) { setReady(true); return; }
      const t = elapsed / 1000;
      ctx.fillStyle = "#050b13"; ctx.fillRect(0, 0, 960, 540);
      for (let i = 0; i < 95; i++) {
        const x = (i * 173 + 960 - t * (12 + i % 4 * 9)) % 960;
        ctx.fillStyle = i % 3 ? "#45617d" : "#d2e8f5";
        ctx.fillRect(x, i * 97 % 540, i % 3 ? 2 : 3, 2);
      }
      ctx.strokeStyle = "#102a38"; ctx.lineWidth = 1;
      for (let x = 0; x < 960; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 540); ctx.stroke(); }
      for (let y = 0; y < 540; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(960, y); ctx.stroke(); }
      ctx.imageSmoothingEnabled = false;
      const ship = (x: number, y: number, enemy: boolean, size: number) => {
        if (sheet.complete && sheet.naturalWidth) ctx.drawImage(sheet, 2, enemy ? 70 : 2, 32, 32, x, y, size, size);
      };
      const pilotX = 460 + Math.sin(t * 1.7) * 145;
      ship(pilotX, 405 - Math.min(t, 3) * 25, false, 52);
      for (let i = 0; i < 7; i++) {
        const x = 100 + i * 108 + Math.sin(t * 1.5 + i) * 36;
        const y = 65 + Math.sin(t + i * 0.7) * 28;
        ship(x, y, true, 42);
        if (t > 2 && i % 2 === 0) {
          ctx.fillStyle = "#ff9e53";
          ctx.fillRect(x + 20, 110 + (t * 100 + i * 50) % 300, 4, 13);
        }
      }
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = "#7bf5ff";
        ctx.fillRect(pilotX + 25, 340 - (t * 200 + i * 110) % 310, 4, 18);
      }
      if (t > 3) {
        const cycle = (t - 3) % 1.2;
        const centerX = 150 + Math.floor((t - 3) / 1.2) * 150;
        ctx.globalAlpha = 1 - cycle / 1.2;
        for (let i = 0; i < 12; i++) {
          const angle = i * Math.PI / 6;
          ctx.fillStyle = i % 2 ? "#ffb84a" : "#7cf4ff";
          ctx.fillRect(centerX + Math.cos(angle) * cycle * 65, 100 + Math.sin(angle) * cycle * 65, 5, 5);
        }
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = "rgba(5,11,19," + Math.min(1, Math.max(0, (t - 6.8) / 1.7)) + ")";
      ctx.fillRect(0, 0, 960, 540);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); reduced.removeEventListener("change", onMotionChange); };
  }, [ready]);
  return <section className={"opening-intro " + (ready ? "is-ready" : "")} aria-label="Alien Force Arena opening">
    <canvas ref={canvas} width={960} height={540} className="opening-battle" aria-hidden="true" />
    {!ready && <>
      <p className="opening-tagline">FIGHT. ADAPT. SURVIVE.</p>
      <button className="opening-skip" onClick={() => setReady(true)}>Skip intro</button>
    </>}
    {ready && <div className="opening-title">
      <img src={import.meta.env.BASE_URL + "branding/alien-force-logo.jpg"} width={100} height={100} alt="Alien Force logo" />
      <h1>ALIEN FORCE <span>ARENA</span></h1>
      <p>Small arenas. Big battles.</p>
      <button ref={startButton} className="opening-start" onClick={onStart}>START</button>
    </div>}
    <span className="sr-only" role="status">{ready ? "Intro complete. Select START to enter the main menu." : "Opening battle animation. You can skip the intro."}</span>
  </section>;
}
