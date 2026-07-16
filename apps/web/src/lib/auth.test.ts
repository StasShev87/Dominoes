import { describe, expect, test } from "vitest";
import { passwordCredentials } from "./auth.js";

describe("passwordCredentials", () => {
  test("uses email credentials for an email identifier", () => {
    expect(passwordCredentials(" Player@Example.com ", "secret-pass"))
      .toEqual({ email: "player@example.com", password: "secret-pass" });
  });

  test("uses E.164 phone credentials for a phone identifier", () => {
    expect(passwordCredentials("+380 50 123 45 67", "secret-pass"))
      .toEqual({ phone: "+380501234567", password: "secret-pass" });
  });

  test("rejects an ambiguous identifier", () => {
    expect(() => passwordCredentials("player-name", "secret-pass")).toThrow("INVALID_IDENTIFIER");
  });
});

