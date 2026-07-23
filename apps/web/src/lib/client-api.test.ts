import { beforeEach, describe, expect, test, vi } from "vitest";
import { clientRequest, getOrCreatePrincipal } from "./client-api.js";

vi.mock("./auth.js", () => ({ getAccessToken: vi.fn(async () => null) }));

describe("API client", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })));
  });

  test("includes HttpOnly guest cookies in cross-origin requests", async () => {
    await clientRequest("/health", "GUEST:guest-id");
    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ credentials: "include" }));
  });

  test("creates a UUID when randomUUID is unavailable on LAN HTTP", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
        return bytes;
      }
    });

    const principal = getOrCreatePrincipal("ACCOUNT");

    expect(principal).toBe("ACCOUNT:00010203-0405-4607-8809-0a0b0c0d0e0f");
    expect(window.localStorage.getItem("dominoes-account-principal"))
      .toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
  });
});
