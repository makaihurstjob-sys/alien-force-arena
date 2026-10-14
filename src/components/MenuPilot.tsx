import { useEffect, useState } from "react";
import { Wifi } from "lucide-react";
import { connection } from "@/lib/multiplayer";

export function MenuPilot() {
  const [name, setName] = useState("Guest");
  const [ping, setPing] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    let pending = false;
    let unsubscribe: (() => void) | undefined;
    async function refresh() {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const db = await connection();
        const { data: session, error: sessionError } = await db.auth.getSession();
        if (sessionError) throw sessionError;
        const user = session.session?.user;
        const started = performance.now();
        const query = db.from("profiles").select("display_name").abortSignal(AbortSignal.timeout(8000));
        const { data, error } = await (user ? query.eq("id", user.id).maybeSingle() : query.limit(0));
        if (error) throw error;
        if (active) {
          setPing(Math.round(performance.now() - started));
          setName(user && data && !Array.isArray(data) ? data.display_name || "Guest" : "Guest");
        }
      } catch {
        if (active) setPing(null);
      } finally { pending = false; }
    }
    void connection().then(db => {
      if (!active) return;
      const { data } = db.auth.onAuthStateChange(() => {
        setTimeout(() => { if (active) { setName("Guest"); setPing(null); void refresh(); } }, 0);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    }).catch(() => {});
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15000);
    const changed = () => void refresh();
    window.addEventListener("alien-force-profile-updated", changed);
    window.addEventListener("online", changed);
    return () => {
      active = false;
      clearInterval(interval);
      unsubscribe?.();
      window.removeEventListener("alien-force-profile-updated", changed);
      window.removeEventListener("online", changed);
    };
  }, []);
  const status = ping === null ? "Ping unavailable" : `Ping: ${ping} ms (room service round trip)`;
  return <div className="arena-pilot"><span>{name}</span><button type="button" className="arena-ping" aria-label={status}><Wifi size={20} aria-hidden="true" /><span role="tooltip">{status}</span></button></div>;
}
