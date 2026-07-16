"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientRequest, getOrCreatePrincipal } from "../lib/client-api.js";
import { getMessages } from "../lib/i18n.js";

export function LobbyActions({ locale }: { readonly locale: string }) {
  const t = getMessages(locale).lobby;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState<{ url: string; matchId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = async (mode: "ai" | "private") => {
    setBusy(true);
    setError(null);
    try {
      const result = await clientRequest<{ matchId: string; inviteToken?: string }>(
        `/matches/${mode}`,
        getOrCreatePrincipal("ACCOUNT"),
        { method: "POST", body: JSON.stringify({ seed: Date.now() }) }
      );
      if (mode === "ai") {
        router.push(`/${locale}/game/${result.matchId}`);
      } else {
        const url = `${window.location.origin}/${locale}/invite/${result.inviteToken}`;
        setInvite({ url, matchId: result.matchId });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.createError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lobby-actions">
      <button className="primary-action" disabled={busy} onClick={() => void create("ai")}>
        <span className="action-icon">◆</span>
        <span><strong>{t.playComputer}</strong><small>{t.computerHint}</small></span>
        <span aria-hidden="true">→</span>
      </button>
      <button className="secondary-action" disabled={busy} onClick={() => void create("private")}>
        <span className="action-icon">↗</span>
        <span><strong>{t.inviteFriend}</strong><small>{t.inviteHint}</small></span>
        <span aria-hidden="true">→</span>
      </button>
      {invite && (
        <div className="invite-card" role="status">
          <p>{t.ready}</p>
          <div><input readOnly value={invite.url} aria-label={t.invitationLink} /><button onClick={() => void navigator.clipboard.writeText(invite.url)}>{t.copy}</button></div>
          <a href={`/${locale}/game/${invite.matchId}`}>{t.goToTable}</a>
        </div>
      )}
      {error && <p className="error-banner" role="alert">{error}</p>}
    </div>
  );
}
