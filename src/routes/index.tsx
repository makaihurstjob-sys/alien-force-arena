import { createFileRoute } from "@tanstack/react-router";
import { EnemyShipBackdrop } from "@/components/EnemyShipBackdrop";
import { MobileMainMenu } from "@/components/MobileMainMenu";
import "./mobile-main-menu.css";
import { useEffect, useState } from "react";
import spriteSheetUrl from "@/assets/classic/original-sprites.bmp?url";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Alien Force Arena — Retro Top-Down Arena Duels" },
      {
        name: "description",
        content:
          "A retro top-down arena shooter with a one-shot-at-a-time rule. Play local practice now; online 1v1 and 2v2 coming from the authoritative server.",
      },
      { property: "og:title", content: "Alien Force Arena" },
      {
        property: "og:description",
        content: "Retro top-down arena duels with a one-projectile-at-a-time rule.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

export function Home() {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    let revealTimer: ReturnType<typeof setTimeout>;
    const reveal = () => {
      if (!cancelled) setLoading(false);
    };
    const fallback = setTimeout(reveal, 5000);
    const sheet = new Image();
    sheet.src = spriteSheetUrl;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const invite = window.location.hash.startsWith("#room=");
    Promise.allSettled([sheet.decode(), document.fonts.ready]).then(() => {
      if (!cancelled) revealTimer = setTimeout(reveal, reduced || invite ? 0 : 1100);
    });
    return () => {
      cancelled = true;
      clearTimeout(fallback);
      clearTimeout(revealTimer);
    };
  }, []);
  return (
    <main
      aria-busy={loading}
      className={`home-menu ${loading ? "menu-loading" : "menu-loaded"} relative isolate min-h-screen bg-background px-4 py-10 font-mono text-foreground`}
    >
      <EnemyShipBackdrop />
      {loading && (
        <span className="sr-only" role="status">
          Loading Alien Force Arena
        </span>
      )}
      <div className="menu-reveal" inert={loading}>
        <MobileMainMenu />
      </div>
    </main>
  );
}
