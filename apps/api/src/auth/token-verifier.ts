import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { Principal } from "../matches/match.service.js";

export const AUTH_TOKEN_VERIFIER = Symbol("AUTH_TOKEN_VERIFIER");

export interface AuthTokenVerifier {
  verify(token: string): Promise<Principal>;
}

export class SupabaseTokenVerifier implements AuthTokenVerifier {
  private readonly jwks;
  private readonly issuer: string;

  constructor(
    supabaseUrl: string,
    private readonly audience: string = "authenticated"
  ) {
    const baseUrl = supabaseUrl.replace(/\/$/, "");
    this.issuer = `${baseUrl}/auth/v1`;
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`));
  }

  async verify(token: string): Promise<Principal> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.issuer,
      audience: this.audience
    });
    return principalFromClaims(payload);
  }
}

export class RejectingTokenVerifier implements AuthTokenVerifier {
  async verify(_token: string): Promise<Principal> {
    throw new Error("AUTH_NOT_CONFIGURED");
  }
}

export function principalFromClaims(claims: JWTPayload): Principal {
  if (!claims.sub) throw new Error("JWT_SUBJECT_MISSING");
  return { kind: "ACCOUNT", id: claims.sub };
}

