import { PlayerViewSchema, type PlayerView, type PublicGameCommand } from "@dominoes/contracts";
import { getAccessToken } from "./auth.js";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/v1";

export type ClientPrincipal = `${"ACCOUNT" | "GUEST"}:${string}`;

function createClientUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getOrCreatePrincipal(kind: "ACCOUNT" | "GUEST" = "ACCOUNT"): ClientPrincipal {
  const key = `dominoes-${kind.toLowerCase()}-principal`;
  const existing = window.localStorage.getItem(key);
  if (existing) return `${kind}:${existing}`;
  const id = createClientUuid();
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
    body: JSON.stringify({ commandId: createClientUuid(), expectedVersion: view.version, command })
  });
  return PlayerViewSchema.parse(response.snapshot);
}
