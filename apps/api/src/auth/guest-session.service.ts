import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { jwtVerify, SignJWT } from "jose";
import { PrismaService } from "../database/prisma.service.js";
import type { Principal } from "../matches/match.service.js";

const COOKIE_NAME = "dominoes_guest";
const LIFETIME_SECONDS = 24 * 60 * 60;

@Injectable()
export class GuestSessionService {
  private readonly key: Uint8Array;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    const secret = process.env.GUEST_SESSION_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "dominoes-local-guest-secret-change-me");
    if (!secret) throw new Error("GUEST_SESSION_SECRET is required in production");
    this.key = new TextEncoder().encode(secret);
  }

  async issue(displayName: string): Promise<{ guestId: string; token: string; maxAge: number }> {
    const guestId = randomUUID();
    const token = await new SignJWT({ kind: "GUEST" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(guestId)
      .setIssuer("dominoes-api")
      .setAudience("dominoes-guest")
      .setIssuedAt()
      .setExpirationTime(`${LIFETIME_SECONDS}s`)
      .sign(this.key);

    if (process.env.DATABASE_URL && process.env.NODE_ENV !== "test") {
      await this.prisma.guestSession.create({
        data: {
          id: guestId,
          name: displayName,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + LIFETIME_SECONDS * 1000)
        }
      });
    }
    return { guestId, token, maxAge: LIFETIME_SECONDS };
  }

  async verify(token: string): Promise<Principal> {
    const { payload } = await jwtVerify(token, this.key, {
      issuer: "dominoes-api",
      audience: "dominoes-guest"
    });
    if (payload.kind !== "GUEST" || !payload.sub) throw new Error("INVALID_GUEST_SESSION");
    return { kind: "GUEST", id: payload.sub };
  }

  readCookie(cookieHeader: string | undefined): string | undefined {
    if (!cookieHeader) return undefined;
    for (const entry of cookieHeader.split(";")) {
      const [name, ...value] = entry.trim().split("=");
      if (name === COOKIE_NAME) return decodeURIComponent(value.join("="));
    }
    return undefined;
  }

  get cookieName(): string {
    return COOKIE_NAME;
  }
}
