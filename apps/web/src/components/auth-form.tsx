"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { clientRequest, getOrCreatePrincipal } from "../lib/client-api.js";
import { getSupabaseBrowserClient, passwordCredentials } from "../lib/auth.js";
import { getMessages } from "../lib/i18n.js";

export function AuthForm({ locale }: { readonly locale: string }) {
  const t = getMessages(locale).auth;
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const credentials = passwordCredentials(identifier, password);
      if (mode === "signin") {
        const { error: authError } = await supabase.auth.signInWithPassword(credentials);
        if (authError) throw authError;
        router.push(`/${locale}`);
        router.refresh();
        return;
      }
      const { data, error: authError } = await supabase.auth.signUp(credentials);
      if (authError) throw authError;
      if (!data.session) {
        setNotice(t.confirmation);
        return;
      }
      await clientRequest("/profiles", getOrCreatePrincipal("ACCOUNT"), { method: "POST", body: JSON.stringify({ username, locale }) });
      router.push(`/${locale}`);
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t.failed;
      setError(message === "INVALID_IDENTIFIER" ? t.invalidIdentifier : message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-panel">
      <a className="brand auth-brand" href={`/${locale}`}><span className="brand-mark">D</span>Dominoes</a>
      <div className="auth-tabs" role="tablist" aria-label={t.mode}>
        <button type="button" role="tab" aria-selected={mode === "signin"} onClick={() => setMode("signin")}>{t.signIn}</button>
        <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => setMode("signup")}>{t.create}</button>
      </div>
      <div className="auth-heading"><span className="eyebrow">{t.eyebrow}</span><h1>{mode === "signin" ? t.welcome : t.join}</h1><p>{mode === "signin" ? t.signinText : t.signupText}</p></div>
      <form onSubmit={(event) => void submit(event)}>
        {mode === "signup" && <label>{t.username}<input aria-label={t.username} minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="player_01" /></label>}
        <label>{t.identifier}<input aria-label={t.identifier} required autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="you@example.com or +380…" /></label>
        <label>{t.password}<input aria-label={t.password} type="password" required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button className="cta" disabled={busy} type="submit">{busy ? t.wait : mode === "signin" ? t.signIn : t.createMine}</button>
      </form>
      {notice && <p className="notice-banner" role="status">{notice}</p>}
      {error && <p className="error-banner" role="alert">{error}</p>}
      <p className="auth-footnote">{t.footnote}</p>
    </div>
  );
}
