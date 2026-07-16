import { createHash, randomBytes, randomUUID } from "node:crypto";
import { CommandRequestSchema, type CommandRequest, type ErrorCode } from "@dominoes/contracts";
import {
  applyCommand,
  chooseAiCommand,
  createMatch,
  createPlayerView,
  GameRuleError,
  type GameCommand,
  type GameEvent,
  type MatchState,
  type PlayerView
} from "@dominoes/game-engine";

const POSTGRES_INT4_SEED_MODULUS = 2_147_483_647;

export interface Principal {
  readonly kind: "ACCOUNT" | "GUEST";
  readonly id: string;
}

export class AppError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
    this.name = "AppError";
  }
}

export interface StoredInvite {
  readonly tokenHash: string;
  readonly expiresAt: number;
  used: boolean;
}

export interface CommandResult {
  readonly snapshot: PlayerView;
  readonly events: GameEvent[];
}

export interface StoredMatch {
  readonly id: string;
  state: MatchState;
  readonly seats: Array<Principal | { readonly kind: "AI"; readonly id: "medium" } | null>;
  readonly invite: StoredInvite | null;
  readonly processedCommands: Map<string, CommandResult>;
  readonly events: GameEvent[];
  lastActivityAt: number;
  persistedVersion: number;
}

export interface MatchRepository {
  create(match: StoredMatch): Promise<void>;
  save(match: StoredMatch): Promise<void>;
  get(matchId: string): Promise<StoredMatch | undefined>;
  findByInviteHash(tokenHash: string): Promise<StoredMatch | undefined>;
}

export class InMemoryMatchRepository implements MatchRepository {
  private readonly matches = new Map<string, StoredMatch>();

  async create(match: StoredMatch): Promise<void> {
    match.persistedVersion = match.state.version;
    this.matches.set(match.id, match);
  }

  async save(match: StoredMatch): Promise<void> {
    match.persistedVersion = match.state.version;
    this.matches.set(match.id, match);
  }

  async get(matchId: string): Promise<StoredMatch | undefined> {
    return this.matches.get(matchId);
  }

  async findByInviteHash(tokenHash: string): Promise<StoredMatch | undefined> {
    return [...this.matches.values()].find(({ invite }) => invite?.tokenHash === tokenHash);
  }
}

export class MatchService {
  constructor(
    private readonly repository: MatchRepository,
    private readonly now: () => number = Date.now
  ) {}

  async createAiMatch(owner: Principal, seed: number): Promise<{ matchId: string; snapshot: PlayerView }> {
    const matchId = randomUUID();
    const normalizedSeed = normalizeSeed(seed);
    const match: StoredMatch = {
      id: matchId,
      state: createMatch({ matchId, seed: normalizedSeed }),
      seats: [owner, { kind: "AI", id: "medium" }],
      invite: null,
      processedCommands: new Map(),
      events: [],
      lastActivityAt: this.now(),
      persistedVersion: 0
    };
    await this.repository.create(match);
    match.events.push(...this.settleAiTurns(match));
    await this.repository.save(match);
    return { matchId, snapshot: createPlayerView(match.state, 0) };
  }

  async createPrivateMatch(owner: Principal, seed: number): Promise<{ matchId: string; inviteToken: string }> {
    const matchId = randomUUID();
    const inviteToken = randomBytes(32).toString("hex");
    const normalizedSeed = normalizeSeed(seed);
    await this.repository.create({
      id: matchId,
      state: createMatch({ matchId, seed: normalizedSeed }),
      seats: [owner, null],
      invite: {
        tokenHash: hashToken(inviteToken),
        expiresAt: this.now() + 24 * 60 * 60 * 1000,
        used: false
      },
      processedCommands: new Map(),
      events: [],
      lastActivityAt: this.now(),
      persistedVersion: 0
    });
    return { matchId, inviteToken };
  }

  async joinPrivateMatch(inviteToken: string, principal: Principal): Promise<{ matchId: string; snapshot: PlayerView }> {
    const match = await this.repository.findByInviteHash(hashToken(inviteToken));
    if (!match) throw new AppError("INVITE_EXPIRED");
    if (!match.invite) throw new AppError("INVITE_EXPIRED");
    if (match.invite.used || match.seats[1]) throw new AppError("INVITE_ALREADY_USED");
    if (match.invite.expiresAt <= this.now()) throw new AppError("INVITE_EXPIRED");
    if (samePrincipal(match.seats[0], principal)) throw new AppError("FORBIDDEN");

    match.seats[1] = principal;
    match.invite.used = true;
    match.lastActivityAt = this.now();
    await this.repository.save(match);
    return { matchId: match.id, snapshot: createPlayerView(match.state, 1) };
  }

  async getView(matchId: string, principal: Principal): Promise<PlayerView> {
    const match = await this.requireMatch(matchId);
    const seat = this.requireSeat(match, principal);
    const view = createPlayerView(match.state, seat);
    return this.canClaimForfeit(match, seat)
      ? { ...view, legalActions: [...view.legalActions, { type: "CLAIM_FORFEIT" }] }
      : view;
  }

  async executeCommand(matchId: string, principal: Principal, input: CommandRequest): Promise<CommandResult> {
    const request = CommandRequestSchema.parse(input);
    const match = await this.requireMatch(matchId);
    const seat = this.requireSeat(match, principal);
    const existing = match.processedCommands.get(request.commandId);
    if (existing) return existing;
    if (request.expectedVersion !== match.state.version) throw new AppError("STALE_VERSION");
    if (request.command.type === "CLAIM_FORFEIT") {
      if (!this.canClaimForfeit(match, seat)) throw new AppError("FORFEIT_NOT_AVAILABLE");
      const event: GameEvent = { type: "MATCH_FINISHED", winnerSeat: seat };
      match.state = {
        ...match.state,
        status: "FINISHED",
        winnerSeat: seat,
        version: match.state.version + 1
      };
      const result = { snapshot: createPlayerView(match.state, seat), events: [event] };
      match.processedCommands.set(request.commandId, result);
      match.events.push(event);
      match.lastActivityAt = this.now();
      await this.repository.save(match);
      return result;
    }

    const command: GameCommand = { ...request.command, seat };
    try {
      const transition = applyCommand(match.state, command);
      match.state = transition.state;
      const events = [...transition.events, ...this.settleAiTurns(match)];
      const result = {
        snapshot: createPlayerView(match.state, seat),
        events
      };
      match.processedCommands.set(request.commandId, result);
      match.events.push(...events);
      match.lastActivityAt = this.now();
      await this.repository.save(match);
      return result;
    } catch (error) {
      if (error instanceof GameRuleError) {
        throw new AppError(error.code === "NOT_YOUR_TURN" ? "NOT_YOUR_TURN" : "ILLEGAL_MOVE");
      }
      throw error;
    }
  }

  private settleAiTurns(match: StoredMatch): GameEvent[] {
    const events: GameEvent[] = [];
    const hasAiOpponent = match.seats[1]?.kind === "AI";
    for (
      let step = 0;
      hasAiOpponent && step < 100 && match.state.status === "ACTIVE" && match.state.round.currentSeat === 1;
      step += 1
    ) {
      const transition = applyCommand(match.state, chooseAiCommand(match.state, 1));
      match.state = transition.state;
      events.push(...transition.events);
    }
    return events;
  }

  private canClaimForfeit(match: StoredMatch, seat: number): boolean {
    return match.state.status === "ACTIVE" &&
      match.state.round.currentSeat !== seat &&
      Boolean(match.seats[match.state.round.currentSeat]) &&
      match.seats[match.state.round.currentSeat]?.kind !== "AI" &&
      this.now() - match.lastActivityAt >= 24 * 60 * 60 * 1000;
  }

  private async requireMatch(matchId: string): Promise<StoredMatch> {
    const match = await this.repository.get(matchId);
    if (!match) throw new AppError("MATCH_NOT_FOUND");
    return match;
  }

  private requireSeat(match: StoredMatch, principal: Principal): number {
    const seat = match.seats.findIndex((candidate) => samePrincipal(candidate, principal));
    if (seat < 0) throw new AppError("FORBIDDEN");
    return seat;
  }
}

function samePrincipal(
  left: Principal | { readonly kind: "AI"; readonly id: "medium" } | null | undefined,
  right: Principal
): boolean {
  return left?.kind === right.kind && left.id === right.id;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) return 0;
  const integer = Math.trunc(seed);
  return ((integer % POSTGRES_INT4_SEED_MODULUS) + POSTGRES_INT4_SEED_MODULUS) % POSTGRES_INT4_SEED_MODULUS;
}
