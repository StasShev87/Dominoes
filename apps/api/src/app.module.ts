import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { PrincipalGuard } from "./auth/principal.js";
import { HealthController } from "./health.controller.js";
import { InMemoryMatchRepository, MatchService } from "./matches/match.service.js";
import { MatchesController } from "./matches/matches.controller.js";
import { AppErrorFilter } from "./errors/app-error.filter.js";
import {
  InMemoryProfileRepository,
  PrismaProfileRepository,
  ProfileService
} from "./profiles/profile.service.js";
import { ProfilesController } from "./profiles/profiles.controller.js";
import {
  AUTH_TOKEN_VERIFIER,
  RejectingTokenVerifier,
  SupabaseTokenVerifier
} from "./auth/token-verifier.js";
import { PrismaService } from "./database/prisma.service.js";
import { PrismaMatchRepository } from "./matches/prisma-match.repository.js";
import { MatchesGateway } from "./matches/matches.gateway.js";
import { GuestSessionService } from "./auth/guest-session.service.js";
import { GuestSessionsController } from "./auth/guest-sessions.controller.js";
import { CorrelationIdGuard } from "./security/correlation-id.guard.js";
import { RateLimitGuard } from "./security/rate-limit.guard.js";

const MATCH_REPOSITORY = Symbol("MATCH_REPOSITORY");
const PROFILE_REPOSITORY = Symbol("PROFILE_REPOSITORY");

@Module({
  controllers: [HealthController, MatchesController, ProfilesController, GuestSessionsController],
  providers: [
    PrismaService,
    GuestSessionService,
    {
      provide: MATCH_REPOSITORY,
      useFactory: (prisma: PrismaService) => process.env.DATABASE_URL && process.env.NODE_ENV !== "test"
        ? new PrismaMatchRepository(prisma)
        : new InMemoryMatchRepository(),
      inject: [PrismaService]
    },
    {
      provide: MatchService,
      useFactory: (repository: InMemoryMatchRepository) => new MatchService(repository),
      inject: [MATCH_REPOSITORY]
    },
    {
      provide: PROFILE_REPOSITORY,
      useFactory: (prisma: PrismaService) => process.env.DATABASE_URL && process.env.NODE_ENV !== "test"
        ? new PrismaProfileRepository(prisma)
        : new InMemoryProfileRepository(),
      inject: [PrismaService]
    },
    {
      provide: ProfileService,
      useFactory: (repository: InMemoryProfileRepository) => new ProfileService(repository),
      inject: [PROFILE_REPOSITORY]
    },
    {
      provide: AUTH_TOKEN_VERIFIER,
      useFactory: () => process.env.SUPABASE_URL
        ? new SupabaseTokenVerifier(process.env.SUPABASE_URL, process.env.SUPABASE_JWT_AUDIENCE ?? "authenticated")
        : new RejectingTokenVerifier()
    },
    { provide: APP_GUARD, useClass: CorrelationIdGuard },
    { provide: APP_GUARD, useClass: PrincipalGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_FILTER, useClass: AppErrorFilter },
    MatchesGateway
  ]
})
export class AppModule {}
