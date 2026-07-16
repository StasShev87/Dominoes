import { describe, expect, test } from "vitest";
import {
  ApiErrorSchema,
  CommandRequestSchema,
  CreateMatchRequestSchema,
  ProfileSchema,
  UsernameSchema
} from "./index.js";

describe("public API contracts", () => {
  test("normalizes a valid username", () => {
    expect(UsernameSchema.parse("Player_01")).toBe("player_01");
  });

  test.each(["ab", "has-dash", "привіт", "name with space", "a".repeat(21)])(
    "rejects invalid username %s",
    (username) => expect(UsernameSchema.safeParse(username).success).toBe(false)
  );

  test("accepts a versioned idempotent play command", () => {
    expect(CommandRequestSchema.parse({
      commandId: "018f47a2-62f4-7af8-bf65-2f641f9c3e5a",
      expectedVersion: 4,
      command: { type: "PLAY_TILE", tileId: "1-2", side: "LEFT" }
    })).toEqual({
      commandId: "018f47a2-62f4-7af8-bf65-2f641f9c3e5a",
      expectedVersion: 4,
      command: { type: "PLAY_TILE", tileId: "1-2", side: "LEFT" }
    });
  });

  test("rejects malformed commands and unknown fields", () => {
    expect(CommandRequestSchema.safeParse({
      commandId: "not-a-uuid",
      expectedVersion: -1,
      command: { type: "PLAY_TILE", tileId: "9-9", side: "MIDDLE" },
      seat: 1
    }).success).toBe(false);
  });

  test("limits match creation to supported modes and score", () => {
    expect(CreateMatchRequestSchema.parse({ mode: "AI" })).toEqual({ mode: "AI", targetScore: 100 });
    expect(CreateMatchRequestSchema.safeParse({ mode: "RANKED", targetScore: 50 }).success).toBe(false);
  });

  test("publishes stable structured errors", () => {
    expect(ApiErrorSchema.parse({
      code: "STALE_VERSION",
      message: "State changed",
      correlationId: "req-123"
    }).code).toBe("STALE_VERSION");
    expect(ApiErrorSchema.safeParse({ code: "SOMETHING_RANDOM", message: "x" }).success).toBe(false);
  });

  test("keeps profiles free of authentication identifiers", () => {
    const profile = ProfileSchema.parse({
      id: "018f47a2-62f4-7af8-bf65-2f641f9c3e5a",
      username: "player_01",
      locale: "uk",
      createdAt: "2026-07-16T00:00:00.000Z"
    });
    expect(profile).not.toHaveProperty("email");
    expect(profile).not.toHaveProperty("phone");
  });
});

