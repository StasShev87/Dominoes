import { PlayerViewSchema, type PlayerView, type PublicGameCommand } from "@dominoes/contracts";
import { getAccessToken } from "./auth.js";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/v1";

export type ClientPrincipal = `${"ACCOUNT" | "GUEST"}:${string}`;

export function getOrCreatePrincipal(kind: "ACCOUNT" | "GUEST" = "ACCOUNT"): ClientPrincipal {
  const key = `dominoes-${kind.toLowerCase()}-principal`;
  const existing = window.localStorage.getItem(key);
  if (existing) return `${kind}:${existing}`;
  const id = crypto.randomUUID();
  window.localStorage.setItem(key, id);
  return `${kind}:${id}`;
}

export async function clientRequest<T>(
  path: string,
  principal: ClientPrincipal,
  init?: RequestInit
): Promise<T> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : { "x-test-principal": principal }),
      ...init?.headers
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function getMatch(matchId: string, principal: ClientPrincipal): Promise<PlayerView> {
  return PlayerViewSchema.parse(await clientRequest(`/matches/${matchId}`, principal));
}

export async function sendCommand(
  matchId: string,
  principal: ClientPrincipal,
  view: PlayerView,
  command: PublicGameCommand
): Promise<PlayerView> {
  const response = await clientRequest<{ snapshot: unknown }>(`/matches/${matchId}/commands`, principal, {
    method: "POST",
    body: JSON.stringify({ commandId: crypto.randomUUID(), expectedVersion: view.version, command })
  });
  return PlayerViewSchema.parse(response.snapshot);
}
