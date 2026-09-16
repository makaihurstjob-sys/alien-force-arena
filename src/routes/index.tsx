import { createFileRoute, Link } from "@tanstack/react-router";
import { RetroFrame } from "@/components/RetroFrame";

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

function Home() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 font-mono text-foreground">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="text-center">
          <img src="/branding/alien-force-logo.jpg" alt="Alien Force logo" width="100" height="100" className="mx-auto mb-4 [image-rendering:pixelated]" />
          <h1 className="text-3xl font-bold uppercase tracking-[0.3em] text-primary sm:text-4xl">
            Alien Force Arena
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            One shot in the air at a time. Make it count.
          </p>
        </header>

        <RetroFrame title="Main Menu">
          <div className="grid gap-3 text-card-foreground sm:grid-cols-2">
            <MenuButton
              to="/classic"
              label="Classic"
              hint="Grid-and-lane survival, based on the reference video"
            />
            <MenuButton to="/practice" label="Practice" hint="Local 1v1 vs a training bot" />
            <MenuButton
              label="Play Online"
              hint="Ranked 1v1 / 2v2 — needs the game server (not live yet)"
              disabled
            />
            <MenuButton label="Join Room" hint="Private room codes — coming next" disabled />
            <MenuButton label="Leaderboard" hint="Daily snapshots — coming next" disabled />
          </div>
        </RetroFrame>

        <RetroFrame title="How To Play">
          <ul className="space-y-1 text-sm text-card-foreground">
            <li>
              <b>Arrow keys / WASD</b> — turn left &amp; right, thrust forward, reverse.
            </li>
            <li>
              <b>Space</b> — fire.
            </li>
            <li>
              You may only have <b>one projectile in play</b>. The ring around your ship is solid
              when you can fire, dashed while your shot is still travelling.
            </li>
            <li>One hit eliminates. Last team standing wins the round; first to 3 rounds wins.</li>
          </ul>
          <p className="mt-3 border-t border-panel-shadow pt-3 text-xs text-muted-foreground">
            PvP rules above are adjustable design choices, not verified rules from the original 1990
            game. Classic mode now follows the supplied gameplay video. Exact movement speed,
            projectile speed, hitbox sizes and arena layouts are reconstructions — all of them are
            centralised in one settings file for tuning.
          </p>
        </RetroFrame>
      </div>
    </main>
  );
}

function MenuButton({
  to,
  label,
  hint,
  disabled,
}: {
  to?: string;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  const body = (
    <span className="block">
      <span className="block text-sm font-bold uppercase tracking-wider">{label}</span>
      <span className="block text-xs text-muted-foreground">{hint}</span>
    </span>
  );
  const base =
    "border-2 border-panel-shadow bg-panel-light px-4 py-3 text-left text-card-foreground shadow-panel transition-transform";
  if (disabled || !to) {
    return (
      <span className={`${base} cursor-not-allowed opacity-60`} aria-disabled>
        {body}
      </span>
    );
  }
  return (
    <Link to={to} className={`${base} hover:translate-x-[1px] hover:translate-y-[1px]`}>
      {body}
    </Link>
  );
}
