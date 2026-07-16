"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@dominoes/contracts";
import { clientRequest, getOrCreatePrincipal } from "../lib/client-api.js";
import { getSupabaseBrowserClient } from "../lib/auth.js";
import { getMessages } from "../lib/i18n.js";

export function ProfilePanel({ locale }: { readonly locale: string }) {
  const t = getMessages(locale).profile;
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void clientRequest<Profile>("/profiles/me", getOrCreatePrincipal("ACCOUNT"))
      .then(setProfile)
      .catch((cause) => setError(cause instanceof Error ? cause.message : t.unavailable));
  }, [t.unavailable]);
  const signOut = async () => {
    try { await getSupabaseBrowserClient().auth.signOut(); } catch { /* local development has no Supabase */ }
    router.push(`/${locale}/auth`);
  };
  return <div className="auth-panel profile-panel">
    <a className="brand auth-brand" href={`/${locale}`}><span className="brand-mark">D</span>Dominoes</a>
    <h1>{t.title}</h1>
    {!profile && !error && <p>{t.loading}</p>}
    {profile && <><label>{t.username}<strong>{profile.username}</strong></label><label>{t.language}<span className="locale-links"><a href="/uk/profile">Українська</a><a href="/en/profile">English</a><a href="/ru/profile">Русский</a></span></label></>}
    {error && <p className="error-banner" role="alert">{error}</p>}
    <button type="button" className="cta" onClick={() => void signOut()}>{t.signOut}</button>
  </div>;
}
