"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientRequest, getOrCreatePrincipal } from "../lib/client-api.js";
import { getMessages } from "../lib/i18n.js";

export function GuestJoin({ token, locale }: { readonly token: string; readonly locale: string }) {
  const t = getMessages(locale).invite;
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const join = async () => {
    if (name.trim().length < 2) return setError(t.shortName);
    setBusy(true);
    try {
      window.localStorage.setItem("dominoes-guest-name", name.trim());
      const principal = getOrCreatePrincipal("GUEST");
      await clientRequest<{ guestId: string }>("/guest-sessions", principal, {
        method: "POST",
        body: JSON.stringify({ displayName: name.trim() })
      });
      const result = await clientRequest<{ matchId: string }>(`/invites/${token}/join`, principal, { method: "POST" });
      window.localStorage.setItem(`dominoes-match-${result.matchId}-principal`, principal);
      router.push(`/${locale}/game/${result.matchId}?guest=1`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.unavailable);
      setBusy(false);
    }
  };
  return <main className="invite-page"><div className="invite-panel">
    <span className="eyebrow">{t.privateTable}</span><div className="invite-domino" aria-hidden="true"><span>••</span><span>•••••</span></div>
    <h1>{t.title}</h1><p>{t.intro}</p>
    <label>{t.guestName}<input aria-label={t.guestName} value={name} maxLength={20} onChange={(event) => setName(event.target.value)} placeholder={t.placeholder} /></label>
    <button className="cta" disabled={busy} onClick={() => void join()}>{busy ? t.joining : t.join}</button>
    {error && <p className="error-banner" role="alert">{error}</p>}
  </div></main>;
}
