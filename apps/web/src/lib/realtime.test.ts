import { beforeEach, describe, expect, test, vi } from "vitest";

const emit = vi.fn();
const on = vi.fn();
const close = vi.fn();
const io = vi.fn(() => ({ emit, on, close }));

vi.mock("socket.io-client", () => ({ io }));
vi.mock("./auth.js", () => ({ getAccessToken: vi.fn(async () => "signed-token") }));

describe("match realtime subscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.test/v1";
  });

  test("authenticates, joins the room, and can unsubscribe", async () => {
    const { subscribeToMatch } = await import("./realtime.js");
    const unsubscribe = await subscribeToMatch(
      "match-1",
      "ACCOUNT:local-account",
      { onSnapshot: vi.fn(), onError: vi.fn() }
    );

    expect(io).toHaveBeenCalledWith("https://api.example.test/matches", {
      auth: { token: "signed-token" },
      transports: ["websocket"],
      withCredentials: true
    });

    const connectHandler = on.mock.calls.find(([event]) => event === "connect")?.[1];
    connectHandler();
    expect(emit).toHaveBeenCalledWith("match:join", { matchId: "match-1" });

    unsubscribe();
    expect(close).toHaveBeenCalled();
  });
});
