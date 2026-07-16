import { describe, expect, test } from "vitest";
import { AppError, InMemoryMatchRepository, MatchService, type Principal } from "./match.service.js";

const owner: Principal = { kind: "ACCOUNT", id: "account-owner" };
const guest: Principal = { kind: "GUEST", id: "guest-player" };

describe("MatchService", () => {
  test("creates an AI match settled at the human turn", async () => {
    const service = new MatchService(new InMemoryMatchRepository());

    const created = await service.createAiMatch(owner, 42);

    expect(created.snapshot.currentSeat).toBe(0);
    expect(created.snapshot.seats[0]).toEqual({ seat: 0, tileCount: 7 });
    expect(created.snapshot.seats[1]!.tileCount).toBeGreaterThan(0);
    expect(created.snapshot.seats[1]!.tileCount).toBeLessThanOrEqual(7);
    expect(created.snapshot.legalActions.length).toBeGreaterThan(0);
  });

  test("creates a single-use private invite and gives each player a hidden view", async () => {
    const service = new MatchService(new InMemoryMatchRepository());
    const created = await service.createPrivateMatch(owner, 42);

    expect(created.inviteToken).toHaveLength(64);
    const joined = await service.joinPrivateMatch(created.inviteToken, guest);
    const ownerView = await service.getView(created.matchId, owner);
    const guestView = await service.getView(created.matchId, guest);

    expect(joined.matchId).toBe(created.matchId);
    expect(ownerView.hand).toHaveLength(7);
    expect(guestView.hand).toHaveLength(7);
    expect(JSON.stringify(ownerView)).not.toContain(guestView.hand[0]!.id);
    await expect(service.joinPrivateMatch(created.inviteToken, { kind: "GUEST", id: "other" }))
      .rejects.toThrowError(new AppError("INVITE_ALREADY_USED"));
  });

  test("executes a command once when the same command id is retried", async () => {
    const service = new MatchService(new InMemoryMatchRepository());
    const created = await service.createPrivateMatch(owner, 11);
    await service.joinPrivateMatch(created.inviteToken, guest);
    const ownerView = await service.getView(created.matchId, owner);
    const actingPrincipal = ownerView.currentSeat === 0 ? owner : guest;
    const view = await service.getView(created.matchId, actingPrincipal);
    const action = view.legalActions[0]!;
    const command = action.type === "PLAY_TILE"
      ? { type: "PLAY_TILE" as const, tileId: action.tileId, side: action.sides[0]! }
      : { type: action.type };
    const request = {
      commandId: "018f47a2-62f4-7af8-bf65-2f641f9c3e5a",
      expectedVersion: view.version,
      command
    };

    const first = await service.executeCommand(created.matchId, actingPrincipal, request);
    const repeated = await service.executeCommand(created.matchId, actingPrincipal, request);

    expect(repeated).toEqual(first);
    expect((await service.getView(created.matchId, actingPrincipal)).version).toBe(view.version + 1);
  });

  test("rejects a command based on a stale snapshot", async () => {
    const service = new MatchService(new InMemoryMatchRepository());
    const created = await service.createPrivateMatch(owner, 5);
    await service.joinPrivateMatch(created.inviteToken, guest);
    const view = await service.getView(created.matchId, owner);

    await expect(service.executeCommand(created.matchId, owner, {
      commandId: "018f47a2-62f4-7af8-bf65-2f641f9c3e5a",
      expectedVersion: view.version + 1,
      command: { type: "PASS" }
    })).rejects.toThrowError(new AppError("STALE_VERSION"));
  });

  test("allows the waiting player to claim a forfeit after 24 hours", async () => {
    let now = 1_000;
    const service = new MatchService(new InMemoryMatchRepository(), () => now);
    const created = await service.createPrivateMatch(owner, 9);
    await service.joinPrivateMatch(created.inviteToken, guest);
    const ownerView = await service.getView(created.matchId, owner);
    const claimant = ownerView.currentSeat === 0 ? guest : owner;
    const view = await service.getView(created.matchId, claimant);
    const request = {
      commandId: "018f47a2-62f4-7af8-bf65-2f641f9c3e5c",
      expectedVersion: view.version,
      command: { type: "CLAIM_FORFEIT" as const }
    };

    await expect(service.executeCommand(created.matchId, claimant, request))
      .rejects.toThrowError(new AppError("FORFEIT_NOT_AVAILABLE"));
    now += 24 * 60 * 60 * 1000;
    expect((await service.getView(created.matchId, claimant)).legalActions)
      .toContainEqual({ type: "CLAIM_FORFEIT" });
    const result = await service.executeCommand(created.matchId, claimant, request);

    expect(result.snapshot.status).toBe("FINISHED");
    expect(result.snapshot.winnerSeat).toBe(ownerView.currentSeat === 0 ? 1 : 0);
    expect(result.events).toContainEqual({ type: "MATCH_FINISHED", winnerSeat: result.snapshot.winnerSeat });
  });
});
