import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { connection } from "@/lib/multiplayer";
import "./player-profile.css";

export function PlayerProfile() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [seen, setSeen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const discord = user?.identities?.some(identity => identity.provider === "discord");
  const avatar = discord ? user?.user_metadata["avatar_url"] : undefined;

  useEffect(() => {
    try { setSeen(localStorage.getItem("alien-force-profile-seen") === "yes"); } catch { /* Storage may be disabled. */ }
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void connection().then(async db => {
      if (!active) return;
      const subscription = db.auth.onAuthStateChange((_event, session) => {
        if (active) { setUser(session?.user ?? null); setImageFailed(false); }
      });
      unsubscribe = () => subscription.data.subscription.unsubscribe();
      const { data, error } = await db.auth.getSession();
      if (error) throw error;
      if (active) setUser(data.session?.user ?? null);
    }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; unsubscribe?.(); };
  }, []);

  async function editName() {
    setEditing(true); setMessage(""); setBusy(true);
    try {
      const db = await connection();
      if (user) {
        const { data, error } = await db.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
        if (error) throw error;
        setName(data?.display_name ?? "");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load your name."); }
    finally { setBusy(false); }
  }

  async function saveName() {
    const value = name.trim();
    if ([...value].length < 2 || [...value].length > 24 || /[\p{Cc}\p{Cf}]/u.test(value)) {
      setMessage("Use 2–24 characters, without control characters."); return;
    }
    setBusy(true); setMessage("");
    try {
      const db = await connection();
      const { data: session, error: sessionError } = await db.auth.getSession();
      if (sessionError) throw sessionError;
      let current = session.session?.user;
      if (!current) {
        const { data, error } = await db.auth.signInAnonymously();
        if (error) throw error;
        current = data.user ?? undefined;
      }
      if (!current) throw new Error("Unable to create your guest profile.");
      const { error } = await db.from("profiles").upsert({ id: current.id, display_name: value }, { onConflict: "id" });
      if (error) throw new Error(error.code === "23505" ? "That display name is taken. Try another." : error.message);
      setEditing(false); setMessage("Display name saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save your name."); }
    finally { setBusy(false); }
  }

  async function signIn() {
    setBusy(true); setMessage("");
    try {
      const db = await connection();
      const response = await fetch(`${import.meta.env["VITE_SUPABASE_URL"]}/auth/v1/settings`, {
        headers: { apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] },
      });
      if (!response.ok) throw new Error("Unable to check Discord sign-in. Please try again.");
      const settings = await response.json();
      if (!settings.external?.discord) throw new Error("Discord sign-in is not enabled yet. You can still change your display name below.");
      const { error } = await db.auth.signInWithOAuth({ provider: "discord", options: {
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
      } });
      if (error) throw error;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to sign in."); }
    finally { setBusy(false); }
  }

  return <>
    <button className="player-profile-button" aria-label="Player profile" aria-haspopup="dialog" onClick={() => {
      setSeen(true); setEditing(false);
      try { localStorage.setItem("alien-force-profile-seen", "yes"); } catch { /* Optional preference. */ }
      dialog.current?.showModal();
    }}>
      {typeof avatar === "string" && avatar.startsWith("https://") && !imageFailed
        ? <img src={avatar} alt="Discord avatar" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
        : !seen && !discord ? <span aria-hidden="true">+</span> : null}
    </button>
    <dialog ref={dialog} className="mobile-menu-dialog player-profile-dialog" aria-labelledby="profile-title">
      <div className="mobile-panel-heading"><h2 id="profile-title">Player profile</h2>
        <button aria-label="Close profile" disabled={busy} onClick={() => dialog.current?.close()}>×</button>
      </div>
      <button className="profile-option" disabled={busy || !!discord} onClick={() => void signIn()}>{discord ? "Signed in with Discord" : "Sign in with Discord"}</button>
      <button className="profile-option" disabled={busy} onClick={() => void editName()}>Change display name</button>
      {editing && <form onSubmit={event => { event.preventDefault(); void saveName(); }}>
        <label htmlFor="player-display-name">Display name</label>
        <input id="player-display-name" value={name} onChange={event => setName(event.target.value)} autoComplete="nickname" autoFocus disabled={busy} />
        <button className="profile-option" disabled={busy} type="submit">{busy ? "Saving…" : "Save display name"}</button>
      </form>}
      {message && <p role="status">{message}</p>}
    </dialog>
  </>;
}
