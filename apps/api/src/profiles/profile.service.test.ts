import { describe, expect, test } from "vitest";
import { AppError } from "../matches/match.service.js";
import { InMemoryProfileRepository, ProfileService } from "./profile.service.js";

const account = { kind: "ACCOUNT" as const, id: "018f47a2-62f4-7af8-bf65-2f641f9c3e5a" };

describe("ProfileService", () => {
  test("creates a normalized public profile", async () => {
    const service = new ProfileService(new InMemoryProfileRepository(), () => new Date("2026-07-16T00:00:00.000Z"));

    await expect(service.create(account, { username: "Player_01", locale: "uk" })).resolves.toEqual({
      id: account.id,
      username: "player_01",
      locale: "uk",
      createdAt: "2026-07-16T00:00:00.000Z"
    });
  });

  test("enforces username uniqueness after normalization", async () => {
    const service = new ProfileService(new InMemoryProfileRepository());
    await service.create(account, { username: "Player_01", locale: "en" });

    await expect(service.create(
      { kind: "ACCOUNT", id: "018f47a2-62f4-7af8-bf65-2f641f9c3e5b" },
      { username: "player_01", locale: "ru" }
    )).rejects.toThrowError(new AppError("USERNAME_TAKEN"));
  });

  test("does not let a guest create an account profile", async () => {
    const service = new ProfileService(new InMemoryProfileRepository());
    await expect(service.create(
      { kind: "GUEST", id: "guest" },
      { username: "guest_name", locale: "uk" }
    )).rejects.toThrowError(new AppError("FORBIDDEN"));
  });
});
