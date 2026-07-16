import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { Principal } from "../matches/match.service.js";
import { AUTH_TOKEN_VERIFIER, type AuthTokenVerifier } from "./token-verifier.js";
import { GuestSessionService } from "./guest-session.service.js";

const PUBLIC_ROUTE = "public-route";

export const Public = () => SetMetadata(PUBLIC_ROUTE, true);

export interface PrincipalRequest extends Request {
  principal?: Principal;
}

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => {
    const request = context.switchToHttp().getRequest<PrincipalRequest>();
    if (!request.principal) throw new UnauthorizedException();
    return request.principal;
  }
);

@Injectable()
export class PrincipalGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AUTH_TOKEN_VERIFIER) private readonly tokenVerifier: AuthTokenVerifier,
    @Inject(GuestSessionService) private readonly guestSessions: GuestSessionService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()])) {
      return true;
    }
    const request = context.switchToHttp().getRequest<PrincipalRequest>();
    const raw = request.header("x-test-principal");
    if (process.env.NODE_ENV !== "production" && raw) {
      const [kind, ...idParts] = raw.split(":");
      const id = idParts.join(":");
      if ((kind === "ACCOUNT" || kind === "GUEST") && id) {
        request.principal = { kind, id };
        return true;
      }
    }
    const authorization = request.header("authorization");
    if (authorization?.startsWith("Bearer ")) {
      try {
        request.principal = await this.tokenVerifier.verify(authorization.slice(7));
        return true;
      } catch {
        throw new UnauthorizedException();
      }
    }
    const guestToken = this.guestSessions.readCookie(request.header("cookie"));
    if (guestToken) {
      try {
        request.principal = await this.guestSessions.verify(guestToken);
        return true;
      } catch {
        throw new UnauthorizedException();
      }
    }
    throw new UnauthorizedException();
  }
}
