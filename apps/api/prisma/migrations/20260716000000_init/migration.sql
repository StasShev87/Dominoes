CREATE TYPE "IdentityProvider" AS ENUM ('SUPABASE_EMAIL', 'SUPABASE_PHONE', 'TELEGRAM');
CREATE TYPE "ParticipantKind" AS ENUM ('ACCOUNT', 'GUEST', 'AI');
CREATE TYPE "MatchMode" AS ENUM ('AI', 'PRIVATE');
CREATE TYPE "MatchStatus" AS ENUM ('WAITING', 'ACTIVE', 'FINISHED', 'ARCHIVED');
CREATE TYPE "InviteStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'REVOKED');

CREATE TABLE "Account" (
  "id" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMPTZ(3),
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AccountIdentity" (
  "id" UUID NOT NULL, "accountId" UUID NOT NULL, "provider" "IdentityProvider" NOT NULL,
  "subject" TEXT NOT NULL, "verifiedAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountIdentity_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Profile" (
  "accountId" UUID NOT NULL, "username" VARCHAR(20) NOT NULL,
  "usernameNormalized" VARCHAR(20) NOT NULL, "locale" VARCHAR(2) NOT NULL DEFAULT 'uk',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Profile_pkey" PRIMARY KEY ("accountId")
);
CREATE TABLE "GuestSession" (
  "id" UUID NOT NULL, "tokenHash" CHAR(64) NOT NULL, "name" VARCHAR(20) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL, "claimedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Match" (
  "id" UUID NOT NULL, "mode" "MatchMode" NOT NULL,
  "status" "MatchStatus" NOT NULL DEFAULT 'WAITING', "targetScore" INTEGER NOT NULL DEFAULT 100,
  "version" INTEGER NOT NULL DEFAULT 0, "seed" INTEGER NOT NULL, "state" JSONB NOT NULL,
  "lastActivityAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMPTZ(3), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MatchSeat" (
  "id" UUID NOT NULL, "matchId" UUID NOT NULL, "seat" INTEGER NOT NULL,
  "participantKind" "ParticipantKind" NOT NULL, "accountId" UUID, "guestSessionId" UUID,
  "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchSeat_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "GameCommand" (
  "id" UUID NOT NULL, "matchId" UUID NOT NULL, "commandId" UUID NOT NULL,
  "expectedVersion" INTEGER NOT NULL, "principalKey" VARCHAR(160) NOT NULL,
  "payload" JSONB NOT NULL, "result" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GameCommand_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "GameEvent" (
  "id" BIGSERIAL NOT NULL, "matchId" UUID NOT NULL, "sequence" INTEGER NOT NULL,
  "type" VARCHAR(40) NOT NULL, "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Invite" (
  "id" UUID NOT NULL, "matchId" UUID NOT NULL, "tokenHash" CHAR(64) NOT NULL,
  "status" "InviteStatus" NOT NULL DEFAULT 'ACTIVE', "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "usedAt" TIMESTAMPTZ(3), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MatchResult" (
  "id" UUID NOT NULL, "matchId" UUID NOT NULL, "accountId" UUID,
  "participantKind" "ParticipantKind" NOT NULL, "seat" INTEGER NOT NULL,
  "score" INTEGER NOT NULL, "outcome" VARCHAR(20) NOT NULL, "finishReason" VARCHAR(30) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccountIdentity_accountId_idx" ON "AccountIdentity"("accountId");
CREATE UNIQUE INDEX "AccountIdentity_provider_subject_key" ON "AccountIdentity"("provider", "subject");
CREATE UNIQUE INDEX "Profile_usernameNormalized_key" ON "Profile"("usernameNormalized");
CREATE UNIQUE INDEX "GuestSession_tokenHash_key" ON "GuestSession"("tokenHash");
CREATE INDEX "Match_status_lastActivityAt_idx" ON "Match"("status", "lastActivityAt");
CREATE INDEX "MatchSeat_accountId_idx" ON "MatchSeat"("accountId");
CREATE INDEX "MatchSeat_guestSessionId_idx" ON "MatchSeat"("guestSessionId");
CREATE UNIQUE INDEX "MatchSeat_matchId_seat_key" ON "MatchSeat"("matchId", "seat");
CREATE UNIQUE INDEX "GameCommand_matchId_commandId_key" ON "GameCommand"("matchId", "commandId");
CREATE UNIQUE INDEX "GameEvent_matchId_sequence_key" ON "GameEvent"("matchId", "sequence");
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");
CREATE INDEX "Invite_matchId_idx" ON "Invite"("matchId");
CREATE INDEX "MatchResult_accountId_createdAt_idx" ON "MatchResult"("accountId", "createdAt");
CREATE UNIQUE INDEX "MatchResult_matchId_seat_key" ON "MatchResult"("matchId", "seat");

ALTER TABLE "AccountIdentity" ADD CONSTRAINT "AccountIdentity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchSeat" ADD CONSTRAINT "MatchSeat_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchSeat" ADD CONSTRAINT "MatchSeat_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MatchSeat" ADD CONSTRAINT "MatchSeat_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GameCommand" ADD CONSTRAINT "GameCommand_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
