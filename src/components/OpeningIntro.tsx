import { useEffect, useRef, useState } from "react";
import spriteSheetUrl from "@/assets/classic/original-sprites.png?url";
import "./opening-intro.css";

const DURATION = 8500;

function TitleShip() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const logo = new Image();
    logo.onload = () => {
      ctx.drawImage(logo, 0, 0, 100, 100);
      const pixels = ctx.getImageData(0, 0, 100, 100);
      // Key out the white JPEG backdrop, retaining the selected ship artwork.
      for (let i = 0; i < pixels.data.length; i += 4) {
        if (pixels.data[i]! > 220 && pixels.data[i + 1]! > 220 && pixels.data[i + 2]! > 220)
          pixels.data[i + 3] = 0;
      }
      ctx.putImageData(pixels, 0, 0);
    };
    logo.src = import.meta.env.BASE_URL + "branding/alien-force-logo.jpg";
    return () => { logo.onload = null; };
  }, []);
  return <canvas ref={canvas} width={100} height={100} role="img" aria-label="Alien Force logo" className="opening-logo" />;
}

export default function OpeningIntro({ onStart }: { onStart: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const [ready, setReady] = useState(false);
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    if (!exiting) return;
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 420;
    const timer = window.setTimeout(onStart, delay);
    return () => window.clearTimeout(timer);
  }, [exiting, onStart]);
  useEffect(() => {
    if (ready) return;
    const skip = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      setReady(true);
    };
    window.addEventListener("keydown", skip);
    return () => window.removeEventListener("keydown", skip);
  }, [ready]);
  useEffect(() => {
    if (ready) { startButton.current?.focus(); return; }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) { setReady(true); return; }
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) { setReady(true); return; }
    const sheet = new Image();
    const sprites = document.createElement("canvas");
    sprites.width = 64; sprites.height = 32;
    let spritesReady = false;
    let disposed = false;
    const prepareSprites = () => {
      if (disposed || spritesReady || !sheet.naturalWidth) return;
      const pixels = sprites.getContext("2d", { willReadFrequently: true });
      if (!pixels) return;
      pixels.drawImage(sheet, 2, 2, 32, 32, 0, 0, 32, 32);
      pixels.drawImage(sheet, 2, 70, 32, 32, 32, 0, 32, 32);
      const data = pixels.getImageData(0, 0, 64, 32);
      for (let i = 0; i < data.data.length; i += 4) {
        if (data.data[i]! < 16 && data.data[i + 1]! < 16 && data.data[i + 2]! < 16) data.data[i + 3] = 0;
      }
      pixels.putImageData(data, 0, 0);
      spritesReady = true;
    };
    sheet.onload = () => { void sheet.decode().then(prepareSprites, prepareSprites); };
    sheet.onerror = () => { if (!disposed) setReady(true); };
    sheet.src = spriteSheetUrl;
    void sheet.decode().then(prepareSprites, () => {});
    // Independent seeded coordinates avoid the diagonal pattern of modular rows.
    let seed = 417;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const stars = Array.from({ length: 240 }, () => ({
      x: random() * 960, y: random() * 540, depth: .2 + random() * .8, phase: random() * Math.PI * 2,
    }));
    const galaxy = document.createElement("canvas");
    galaxy.width = 960; galaxy.height = 540;
    const sky = galaxy.getContext("2d");
    if (sky) {
      sky.fillStyle = "#030812"; sky.fillRect(0, 0, 960, 540);
      for (let i = 0; i < 18; i++) {
        const x = random() * 1100 - 70, y = 90 + x * .28 + random() * 160 - 80;
        const glow = sky.createRadialGradient(x, y, 0, x, y, 130 + random() * 140);
        glow.addColorStop(0, i % 2 ? "rgba(70,38,116,.14)" : "rgba(18,104,132,.14)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        sky.fillStyle = glow; sky.fillRect(0, 0, 960, 540);
      }
    }
    let raf = 0;
    let began: number | undefined;
    const onMotionChange = () => { if (reduced.matches) setReady(true); };
    reduced.addEventListener("change", onMotionChange);
    const draw = (now: number) => {
      // The intro clock starts only after the ships can actually be drawn.
      if (!spritesReady) { raf = requestAnimationFrame(draw); return; }
      began ??= now;
      const elapsed = now - began;
      if (elapsed >= DURATION) { setReady(true); return; }
      const t = elapsed / 1000;
      const bounds = canvas.current!.getBoundingClientRect();
      const aspect = bounds.width / bounds.height;
      ctx.drawImage(galaxy, 0, 0);
      for (const star of stars) {
        const y = (star.y + t * (8 + star.depth * 28)) % 540;
        ctx.globalAlpha = .4 + star.depth * .4 + Math.sin(t * .8 + star.phase) * .15;
        ctx.fillStyle = star.depth > .8 ? "#dbf5ff" : "#7999c9";
        ctx.fillRect(star.x, y, star.depth > .85 ? 2 : 1, star.depth > .85 ? 2 : 1);
      }
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = false;
      const ship = (x: number, y: number, enemy: boolean, size: number, bank: number) => {
        if (!spritesReady) return;
        ctx.save();
        ctx.translate(x + size / 2, y + size / 2);
        // CSS fills the viewport; counter its unequal axes for square ships.
        ctx.scale(1, aspect / (960 / 540));
        ctx.rotate(bank);
        const thrust = size * (.3 + .15 * Math.sin(t * 35 + x));
        const exhaust = ctx.createLinearGradient(0, size * .3, 0, size * .5 + thrust);
        exhaust.addColorStop(0, enemy ? "#ffe8a0" : "#e4ffff");
        exhaust.addColorStop(.3, enemy ? "#ff783b" : "#60dcff");
        exhaust.addColorStop(1, "transparent");
        ctx.fillStyle = exhaust;
        ctx.beginPath(); ctx.moveTo(-size * .11, size * .3);
        ctx.lineTo(0, size * .5 + thrust); ctx.lineTo(size * .11, size * .3); ctx.fill();
        ctx.drawImage(sprites, enemy ? 32 : 0, 0, 32, 32, -size / 2, -size / 2, size, size);
        ctx.restore();
      };
      const pilotX = 460 + Math.sin(t * 1.7) * 145;
      const pilotY = 405 - 75 * (1 - Math.exp(-t * .8)) + Math.sin(t * 2.1) * 9;
      ship(pilotX, pilotY, false, 52, Math.cos(t * 1.7) * .3);
      for (let i = 0; i < 7; i++) {
        const x = 100 + i * 108 + Math.sin(t * 1.5 + i) * 36;
        const dive = Math.max(0, Math.sin(t * 1.3 - i * .65));
        const y = 45 + Math.sin(t + i * 0.7) * 24 + dive * dive * 110;
        ship(x, y, true, 42, Math.cos(t * 1.5 + i) * .28);
        if (t > 2 && i % 2 === 0) {
          ctx.fillStyle = "#ff9e53";
          ctx.fillRect(x + 20, 110 + (t * 100 + i * 50) % 300, 4, 13);
        }
      }
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = "#7bf5ff";
        ctx.fillRect(pilotX + 25, pilotY - (t * 200 + i * 110) % 310, 4, 18);
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
    return () => { disposed = true; cancelAnimationFrame(raf); sheet.onload = null; sheet.onerror = null; reduced.removeEventListener("change", onMotionChange); };
  }, [ready]);
  return <section className={"opening-intro " + (ready ? "is-ready " : "") + (exiting ? "is-exiting" : "")} aria-label="Alien Force Arena opening">
    <canvas ref={canvas} width={960} height={540} className="opening-battle" aria-hidden="true" />
    {!ready && <>
      <p className="opening-tagline">FIGHT. ADAPT. SURVIVE.</p>
      <button className="opening-skip" onClick={() => setReady(true)} aria-label="Skip intro">
        <span className="opening-skip-keyboard">Press Space Bar to skip intro…</span>
        <span className="opening-skip-touch">Tap to skip intro…</span>
      </button>
    </>}
    {ready && <div className="opening-title">
      <TitleShip />
      <h1>ALIEN FORCE <span>ARENA</span></h1>
      <p>Fight · Adapt · Survive</p>
      <button ref={startButton} className="opening-start" disabled={exiting} onClick={() => setExiting(true)}>START</button>
    </div>}
    <span className="sr-only" role="status">{ready ? "Intro complete. Select START to enter the main menu." : "Opening battle animation. You can skip the intro."}</span>
  </section>;
}
