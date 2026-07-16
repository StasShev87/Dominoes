import { PlayerViewSchema, type PlayerView } from "@dominoes/contracts";
import { io } from "socket.io-client";
import { getAccessToken } from "./auth.js";
import type { ClientPrincipal } from "./client-api.js";

interface MatchSubscriptionHandlers {
  readonly onSnapshot: (snapshot: PlayerView) => void;
  readonly onError: (message: string) => void;
}

export async function subscribeToMatch(
  matchId: string,
  principal: ClientPrincipal,
  handlers: MatchSubscriptionHandlers
): Promise<() => void> {
  const token = await getAccessToken();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/v1";
  const socket = io(`${apiUrl.replace(/\/$/, "").replace(/\/v1$/, "")}/matches`, {
    auth: token ? { token } : { testPrincipal: principal },
    transports: ["websocket"],
    withCredentials: true
  });

  socket.on("connect", () => socket.emit("match:join", { matchId }));
  socket.on("match:snapshot", (value: unknown) => {
    const parsed = PlayerViewSchema.safeParse(value);
    if (parsed.success) handlers.onSnapshot(parsed.data);
    else handlers.onError("The server sent an invalid match update");
  });
  socket.on("match:error", (value: { code?: unknown }) => {
    handlers.onError(typeof value?.code === "string" ? value.code : "Realtime connection failed");
  });
  socket.on("connect_error", (error) => handlers.onError(error.message));

  return () => socket.close();
}
