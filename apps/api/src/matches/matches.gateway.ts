import { Inject, Injectable } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import type { PlayerView } from "@dominoes/game-engine";
import { AUTH_TOKEN_VERIFIER, type AuthTokenVerifier } from "../auth/token-verifier.js";
import { MatchService, type Principal } from "./match.service.js";
import { GuestSessionService } from "../auth/guest-session.service.js";

interface MatchSocketData {
  principal?: Principal;
}

interface ClientToServerEvents {
  "match:join": (payload: { matchId?: unknown }) => void;
}

interface ServerToClientEvents {
  "match:snapshot": (snapshot: PlayerView) => void;
  "match:error": (error: { code: unknown }) => void;
}

type MatchSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, MatchSocketData>;
type MatchServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, MatchSocketData>;

@Injectable()
@WebSocketGateway({
  namespace: "matches",
  cors: { origin: true, credentials: true }
})
export class MatchesGateway implements OnGatewayConnection {
  @WebSocketServer()
  private readonly server!: MatchServer;

  constructor(
    @Inject(MatchService) private readonly matches: MatchService,
    @Inject(AUTH_TOKEN_VERIFIER) private readonly tokenVerifier: AuthTokenVerifier,
    @Inject(GuestSessionService) private readonly guestSessions: GuestSessionService
  ) {}

  async handleConnection(client: MatchSocket): Promise<void> {
    try {
      client.data.principal = await this.authenticate(client);
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage("match:join")
  async joinMatch(
    @ConnectedSocket() client: MatchSocket,
    @MessageBody() payload: { matchId?: unknown }
  ): Promise<void> {
    const principal = client.data.principal;
    if (!principal || typeof payload?.matchId !== "string") {
      client.emit("match:error", { code: "UNAUTHORIZED" });
      return;
    }

    try {
      const snapshot = await this.matches.getView(payload.matchId, principal);
      await client.join(this.room(payload.matchId));
      client.emit("match:snapshot", snapshot);
    } catch (error) {
      client.emit("match:error", {
        code: error instanceof Error && "code" in error ? error.code : "FORBIDDEN"
      });
    }
  }

  async publishMatch(matchId: string): Promise<void> {
    const sockets = await this.server.in(this.room(matchId)).fetchSockets();
    await Promise.all(sockets.map(async (socket) => {
      const principal = socket.data.principal;
      if (!principal) return;
      try {
        socket.emit("match:snapshot", await this.matches.getView(matchId, principal));
      } catch {
        socket.emit("match:error", { code: "FORBIDDEN" });
      }
    }));
  }

  private async authenticate(client: MatchSocket): Promise<Principal> {
    const testPrincipal = client.handshake.auth.testPrincipal;
    if (process.env.NODE_ENV !== "production" && typeof testPrincipal === "string") {
      const [kind, ...idParts] = testPrincipal.split(":");
      const id = idParts.join(":");
      if ((kind === "ACCOUNT" || kind === "GUEST") && id) return { kind, id };
    }

    const token = client.handshake.auth.token;
    if (typeof token === "string" && token) return this.tokenVerifier.verify(token);
    const guestToken = this.guestSessions.readCookie(client.handshake.headers.cookie);
    if (guestToken) return this.guestSessions.verify(guestToken);
    throw new Error("UNAUTHORIZED");
  }

  private room(matchId: string): string {
    return `match:${matchId}`;
  }
}
