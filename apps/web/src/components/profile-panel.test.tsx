import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../lib/client-api.js", () => ({
  getOrCreatePrincipal: () => "ACCOUNT:local",
  clientRequest: vi.fn(async () => ({ username: "player_01", locale: "en", createdAt: new Date().toISOString() }))
}));
vi.mock("../lib/auth.js", () => ({ getSupabaseBrowserClient: vi.fn() }));

import { ProfilePanel } from "./profile-panel.js";

describe("ProfilePanel", () => {
  test("loads the current public username", async () => {
    render(<ProfilePanel locale="en" />);
    expect(await screen.findByText("player_01")).toBeVisible();
  });
});
