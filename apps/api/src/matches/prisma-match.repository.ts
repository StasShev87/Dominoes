import {
  InviteStatus,
  MatchMode,
  MatchStatus,
  ParticipantKind,
  Prisma,
  type PrismaClient
} from "@prisma/client";
import { createHash } from "node:crypto";
import type { GameEvent, MatchState } from "@dominoes/game-engine";
import { AppError } from "./match.service.js";
import type {
  CommandResult,
  MatchRepository,
  Principal,
  StoredMatch
} from "./match.service.js";

const matchInclude = {
  seats: true,
  invites: { orderBy: { createdAt: "desc" as const } },
  commands: { orderBy: { createdAt: "asc" as const } },
  events: { orderBy: { sequence: "asc" as const } }
} satisfies Prisma.MatchInclude;

type MatchRecord = Prisma.MatchGetPayload<{ include: typeof matchInclude }>;

export class PrismaMatchRepository implements MatchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(match: StoredMatch): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await ensureParticipants(transaction, match);
      await transaction.match.create({
        data: {
          id: match.id,
          mode: match.invite ? MatchMode.PRIVATE : MatchMode.AI,
          status: match.invite ? MatchStatus.WAITING : MatchStatus.ACTIVE,
          targetScore: match.state.targetScore,
          version: match.state.version,
          seed: match.state.seed,
          state: toJson(match.state),
          lastActivityAt: new Date(match.lastActivityAt),
          seats: { create: seatRows(match) },
          ...(match.invite ? {
            invites: {
              create: {
                tokenHash: match.invite.tokenHash,
                expiresAt: new Date(match.invite.expiresAt)
              }
            }
          } : {})
        }
      });
    });
  }

  async save(match: StoredMatch): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await ensureParticipants(transaction, match);
      const updated = await transaction.match.updateMany({
        where: { id: match.id, version: match.persistedVersion },
        data: {
          state: toJson(match.state),
          version: match.state.version,
          status: match.state.status === "FINISHED" ? MatchStatus.FINISHED : MatchStatus.ACTIVE,
          lastActivityAt: new Date(match.lastActivityAt),
          ...(match.state.status === "FINISHED" ? { finishedAt: new Date(match.lastActivityAt) } : {})
        }
      });
      if (updated.count !== 1) throw new AppError("STALE_VERSION");
      for (const seat of seatRows(match)) {
        await transaction.matchSeat.upsert({
          where: { matchId_seat: { matchId: match.id, seat: seat.seat } },
          create: { ...seat, matchId: match.id },
          update: seat
        });
      }
      if (match.invite) {
        await transaction.invite.update({
          where: { tokenHash: match.invite.tokenHash },
          data: {
            status: match.invite.used ? InviteStatus.USED : InviteStatus.ACTIVE,
            ...(match.invite.used ? { usedAt: new Date() } : {})
          }
        });
      }
      for (const [commandId, result] of match.processedCommands) {
        await transaction.gameCommand.upsert({
          where: { matchId_commandId: { matchId: match.id, commandId } },
          create: {
            matchId: match.id,
            commandId,
            expectedVersion: Math.max(0, result.snapshot.version - 1),
            principalKey: "persisted",
            payload: {},
            result: toJson(result)
          },
          update: {}
        });
      }
      for (const [index, event] of match.events.entries()) {
        await transaction.gameEvent.upsert({
          where: { matchId_sequence: { matchId: match.id, sequence: index + 1 } },
          create: {
            matchId: match.id,
            sequence: index + 1,
            type: event.type,
            payload: toJson(event)
          },
          update: {}
        });
      }
    });
    match.persistedVersion = match.state.version;
  }

  async get(matchId: string): Promise<StoredMatch | undefined> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId }, include: matchInclude });
    return match ? hydrate(match) : undefined;
  }

  async findByInviteHash(tokenHash: string): Promise<StoredMatch | undefined> {
    const invite = await this.prisma.invite.findUnique({ where: { tokenHash }, select: { matchId: true } });
    return invite ? this.get(invite.matchId) : undefined;
  }
}

function hydrate(match: MatchRecord): StoredMatch {
  const state = normalizeMatchState(match.state);
  const seats: StoredMatch["seats"] = Array.from({ length: state.scores.length }, () => null);
  for (const seat of match.seats) {
    seats[seat.seat] = seat.participantKind === ParticipantKind.AI
      ? { kind: "AI", id: "medium" }
      : seat.participantKind === ParticipantKind.ACCOUNT && seat.accountId
        ? { kind: "ACCOUNT", id: seat.accountId }
        : seat.guestSessionId
          ? { kind: "GUEST", id: seat.guestSessionId }
          : null;
  }
  const invite = match.invites[0];
  return {
    id: match.id,
    state,
    seats,
    invite: invite ? {
      tokenHash: invite.tokenHash,
      expiresAt: invite.expiresAt.getTime(),
      used: invite.status === InviteStatus.USED
    } : null,
    processedCommands: new Map(match.commands.map((command) => [
      command.commandId,
      command.result as unknown as CommandResult
    ])),
    events: match.events.map((event) => event.payload as unknown as GameEvent),
    lastActivityAt: match.lastActivityAt.getTime(),
    persistedVersion: match.version
  };
}

export function normalizeMatchState(value: unknown): MatchState {
  const state = value as MatchState;
  const chain = state.round.chain as Array<MatchState["round"]["chain"][number] & { moveNumber?: number }>;
  const highestStored = chain.reduce((highest, placed) =>
    Number.isInteger(placed.moveNumber) && placed.moveNumber! >= 0 ? Math.max(highest, placed.moveNumber!) : highest, -1);
  let nextMoveNumber = highestStored + 1;
  const normalizedChain = chain.map((placed, index) => ({
    ...placed,
    moveNumber: Number.isInteger(placed.moveNumber) && placed.moveNumber! >= 0
      ? placed.moveNumber!
      : highestStored < 0 ? index : nextMoveNumber++
  }));

  return { ...state, round: { ...state.round, chain: normalizedChain } };
}

function seatRows(match: StoredMatch) {
  return match.seats.flatMap((participant, seat) => participant ? [{
    seat,
    participantKind: participant.kind === "ACCOUNT"
      ? ParticipantKind.ACCOUNT
      : participant.kind === "GUEST"
        ? ParticipantKind.GUEST
        : ParticipantKind.AI,
    accountId: participant.kind === "ACCOUNT" ? participant.id : null,
    guestSessionId: participant.kind === "GUEST" ? participant.id : null
  }] : []);
}

async function ensureParticipants(
  transaction: Prisma.TransactionClient,
  match: StoredMatch
): Promise<void> {
  for (const participant of match.seats) {
    if (participant?.kind === "ACCOUNT") {
      await transaction.account.upsert({ where: { id: participant.id }, create: { id: participant.id }, update: {} });
    }
    if (participant?.kind === "GUEST") {
      await transaction.guestSession.upsert({
        where: { id: participant.id },
        create: {
          id: participant.id,
          tokenHash: hashGuest(participant),
          name: "Guest",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        },
        update: {}
      });
    }
  }
}

function hashGuest(principal: Principal): string {
  return createHash("sha256").update(`guest:${principal.id}`).digest("hex");
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
