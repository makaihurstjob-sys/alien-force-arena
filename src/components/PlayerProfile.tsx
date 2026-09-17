import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { connection } from "@/lib/multiplayer";
import "./player-profile.css";

export function PlayerProfile() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [seen, setSeen] = useState(false);
  const savedName = useRef("");
  const saving = useRef<Promise<boolean> | null>(null);
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
    setMessage(""); setBusy(true);
    try {
      const db = await connection();
      const { data: session, error: sessionError } = await db.auth.getSession();
      if (sessionError) throw sessionError;
      const current = session.session?.user;
      if (current) {
        const { data, error } = await db.from("profiles").select("display_name").eq("id", current.id).maybeSingle();
        if (error) throw error;
        savedName.current = data?.display_name ?? "";
        setName(savedName.current);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load your name."); }
    finally { setBusy(false); }
  }

  function saveName(): Promise<boolean> {
    if (saving.current) return saving.current;
    const pending = persistName();
    saving.current = pending;
    void pending.finally(() => { saving.current = null; });
    return pending;
  }

  async function closeProfile() {
    if (await saveName()) dialog.current?.close();
  }

  async function persistName(): Promise<boolean> {
    const value = name.trim();
    if (value === savedName.current) return true;
    if ([...value].length < 2 || [...value].length > 24 || /[\p{Cc}\p{Cf}]/u.test(value)) {
      setMessage("Use 2–24 characters, without control characters."); return false;
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
      savedName.current = value; setName(value); setMessage("Display name saved.");
      return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save your name."); return false; }
    finally { setBusy(false); }
  }

  async function signIn() {
    if (!await saveName()) return;
    setBusy(true); setMessage("");
    try {
      const db = await connection();
      const response = await fetch(`${import.meta.env["VITE_SUPABASE_URL"]}/auth/v1/settings`, {
        headers: { apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] },
      });
      if (!response.ok) throw new Error("Unable to check Discord sign-in. Please try again.");
      const settings = await response.json();
      if (!settings.external?.discord) return;
      const { error } = await db.auth.signInWithOAuth({ provider: "discord", options: {
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
      } });
      if (error) throw error;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to sign in."); }
    finally { setBusy(false); }
  }

  return <>
    <button className="player-profile-button" aria-label="Player profile" aria-haspopup="dialog" onClick={() => {
      setSeen(true); void editName();
      try { localStorage.setItem("alien-force-profile-seen", "yes"); } catch { /* Optional preference. */ }
      dialog.current?.showModal();
    }}>
      {typeof avatar === "string" && avatar.startsWith("https://") && !imageFailed
        ? <img src={avatar} alt="Discord avatar" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
        : !seen && !discord ? <span aria-hidden="true">+</span> : null}
    </button>
    <dialog ref={dialog} className="mobile-menu-dialog player-profile-dialog" aria-labelledby="profile-title" onCancel={event => { event.preventDefault(); void closeProfile(); }}>
      <div className="mobile-panel-heading"><h2 id="profile-title">Player profile</h2>
        <button aria-label="Close profile" onClick={() => void closeProfile()}>×</button>
      </div>
      <button className="profile-option discord-sign-in" disabled={!!discord} onClick={() => void signIn()}>
        <span>{discord ? "Signed in with Discord" : "Sign in with Discord"}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.445.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.042-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .079.01c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.076.076 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.419 0 1.334-.955 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z" /></svg>
      </button>
      <form onSubmit={event => { event.preventDefault(); void saveName(); }}>
        <input className="profile-option" id="player-display-name" aria-label="Display name" placeholder="Enter your name here" value={name} onChange={event => setName(event.target.value)} onBlur={() => { void saveName(); }} autoComplete="nickname" disabled={busy} />
      </form>
      {message && <p role="status">{message}</p>}
    </dialog>
  </>;
}
