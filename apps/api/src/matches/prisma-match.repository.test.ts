import { createMatch } from "@dominoes/game-engine";
import { describe, expect, test, vi } from "vitest";
import { AppError, type StoredMatch } from "./match.service.js";
import { normalizeMatchState, PrismaMatchRepository } from "./prisma-match.repository.js";

describe("PrismaMatchRepository", () => {
  test("normalizes move numbers in legacy persisted chains", () => {
    const state = createMatch({ matchId: "legacy", seed: 1 });
    const legacy = {
      ...state,
      round: {
        ...state.round,
        chain: [
          { tile: { id: "1-2", left: 1, right: 2 }, left: 1, right: 2 },
          { tile: { id: "2-3", left: 2, right: 3 }, left: 2, right: 3 }
        ]
      }
    };

    expect(normalizeMatchState(legacy).round.chain.map(({ moveNumber }) => moveNumber)).toEqual([0, 1]);
  });
  test("rejects a stale concurrent save", async () => {
    const transaction = {
      account: { upsert: vi.fn(async () => undefined) },
      match: {
        update: vi.fn(async () => undefined),
        updateMany: vi.fn(async () => ({ count: 0 }))
      },
      matchSeat: { upsert: vi.fn(async () => undefined) },
      gameCommand: { upsert: vi.fn(async () => undefined) },
      gameEvent: { upsert: vi.fn(async () => undefined) }
    };
    const prisma = { $transaction: async (work: (tx: typeof transaction) => unknown) => work(transaction) };
    const repository = new PrismaMatchRepository(prisma as never);
    const match: StoredMatch = {
      id: "018f47a2-62f4-7af8-bf65-2f641f9c3e5a",
      state: createMatch({ matchId: "018f47a2-62f4-7af8-bf65-2f641f9c3e5a", seed: 1 }),
      seats: [{ kind: "ACCOUNT", id: "018f47a2-62f4-7af8-bf65-2f641f9c3e5b" }, { kind: "AI", id: "medium" }],
      invite: null,
      processedCommands: new Map(),
      events: [],
      lastActivityAt: 1,
      persistedVersion: 0
    };
    match.state = { ...match.state, version: 1 };

    await expect(repository.save(match)).rejects.toThrowError(new AppError("STALE_VERSION"));
  });
});
