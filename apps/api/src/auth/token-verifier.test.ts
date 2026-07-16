import { describe, expect, test } from "vitest";
import { principalFromClaims } from "./token-verifier.js";

describe("principalFromClaims", () => {
  test("uses the verified subject as the account identity", () => {
    expect(principalFromClaims({ sub: "018f47a2-62f4-7af8-bf65-2f641f9c3e5a", role: "authenticated" }))
      .toEqual({ kind: "ACCOUNT", id: "018f47a2-62f4-7af8-bf65-2f641f9c3e5a" });
  });

  test("rejects claims without a subject", () => {
    expect(() => principalFromClaims({ role: "authenticated" })).toThrow("JWT_SUBJECT_MISSING");
  });
});

