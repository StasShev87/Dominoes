import {
  CreateProfileRequestSchema,
  ProfileSchema,
  type CreateProfileRequest,
  type Profile
} from "@dominoes/contracts";
import { AppError, type Principal } from "../matches/match.service.js";
import { Prisma, type PrismaClient } from "@prisma/client";

export interface ProfileRepository {
  create(profile: Profile): Promise<boolean>;
  findByAccountId(accountId: string): Promise<Profile | undefined>;
}

export class InMemoryProfileRepository implements ProfileRepository {
  private readonly byAccount = new Map<string, Profile>();
  private readonly accountByUsername = new Map<string, string>();

  async create(profile: Profile): Promise<boolean> {
    if (this.accountByUsername.has(profile.username)) return false;
    this.byAccount.set(profile.id, profile);
    this.accountByUsername.set(profile.username, profile.id);
    return true;
  }

  async findByAccountId(accountId: string): Promise<Profile | undefined> {
    return this.byAccount.get(accountId);
  }
}

export class PrismaProfileRepository implements ProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(profile: Profile): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.account.upsert({
          where: { id: profile.id },
          create: { id: profile.id },
          update: {}
        });
        await transaction.profile.create({
          data: {
            accountId: profile.id,
            username: profile.username,
            usernameNormalized: profile.username,
            locale: profile.locale,
            createdAt: new Date(profile.createdAt)
          }
        });
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return false;
      throw error;
    }
  }

  async findByAccountId(accountId: string): Promise<Profile | undefined> {
    const profile = await this.prisma.profile.findUnique({ where: { accountId } });
    if (!profile) return undefined;
    return ProfileSchema.parse({
      id: profile.accountId,
      username: profile.username,
      locale: profile.locale,
      createdAt: profile.createdAt.toISOString()
    });
  }
}

export class ProfileService {
  constructor(
    private readonly repository: ProfileRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async create(principal: Principal, input: CreateProfileRequest): Promise<Profile> {
    if (principal.kind !== "ACCOUNT") throw new AppError("FORBIDDEN");
    const request = CreateProfileRequestSchema.parse(input);
    const profile = ProfileSchema.parse({
      id: principal.id,
      username: request.username,
      locale: request.locale,
      createdAt: this.now().toISOString()
    });
    if (!await this.repository.create(profile)) throw new AppError("USERNAME_TAKEN");
    return profile;
  }

  async getMe(principal: Principal): Promise<Profile> {
    if (principal.kind !== "ACCOUNT") throw new AppError("FORBIDDEN");
    const profile = await this.repository.findByAccountId(principal.id);
    if (!profile) throw new AppError("FORBIDDEN");
    return profile;
  }
}
