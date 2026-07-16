import { beforeEach, describe, expect, test, vi } from "vitest";
import { clientRequest } from "./client-api.js";

vi.mock("./auth.js", () => ({ getAccessToken: vi.fn(async () => null) }));

describe("API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })));
  });

  test("includes HttpOnly guest cookies in cross-origin requests", async () => {
    await clientRequest("/health", "GUEST:guest-id");
    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ credentials: "include" }));
  });
});
