"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlayerView, PublicGameCommand } from "@dominoes/contracts";
import { GameBoard } from "./game-board.js";
import { getMatch, getOrCreatePrincipal, sendCommand, type ClientPrincipal } from "../lib/client-api.js";
import { subscribeToMatch } from "../lib/realtime.js";
import { getMessages } from "../lib/i18n.js";

export function GameSession({ matchId, locale = "en" }: { readonly matchId: string; readonly locale?: string }) {
  const t = getMessages(locale).game;
  const [principal, setPrincipal] = useState<ClientPrincipal | null>(null);
  const [view, setView] = useState<PlayerView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (activePrincipal: ClientPrincipal) => {
    setError(null);
    try {
      setView(await getMatch(matchId, activePrincipal));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.restoreError);
    }
  }, [matchId, t.restoreError]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    const savedPrincipal = window.localStorage.getItem(`dominoes-match-${matchId}-principal`) as ClientPrincipal | null;
    const activePrincipal = savedPrincipal ?? getOrCreatePrincipal("ACCOUNT");
    setPrincipal(activePrincipal);
    void refresh(activePrincipal);
    void subscribeToMatch(matchId, activePrincipal, {
      onSnapshot: (snapshot) => {
        if (!cancelled) {
          setView(snapshot);
          setError(null);
        }
      },
      onError: (message) => {
        if (!cancelled) setError(message);
      }
    }).then((cleanup) => {
      if (cancelled) cleanup();
      else unsubscribe = cleanup;
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [matchId, refresh]);

  const command = async (nextCommand: PublicGameCommand) => {
    if (!principal || !view) return;
    setBusy(true);
    setError(null);
    try {
      setView(await sendCommand(matchId, principal, view, nextCommand));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.moveError);
      await refresh(principal);
    } finally {
      setBusy(false);
    }
  };

  if (error && !view) return <StateCard title={t.unavailable} detail={error} />;
  if (!view) return <StateCard title={t.preparing} detail={t.restoring} />;
  return <>{error && <p className="error-banner floating" role="alert">{error}</p>}<GameBoard view={view} onCommand={(value) => void command(value)} busy={busy} locale={locale} /></>;
}

function StateCard({ title, detail }: { readonly title: string; readonly detail: string }) {
  return <main className="centered-state"><div className="brand-mark">D</div><h1>{title}</h1><p>{detail}</p></main>;
}
