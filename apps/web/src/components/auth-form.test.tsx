import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { vi } from "vitest";
import { AuthForm } from "./auth-form.js";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() })
}));

describe("AuthForm", () => {
  test("reveals username when switching to account creation", () => {
    render(<AuthForm locale="en" />);

    fireEvent.click(screen.getByRole("tab", { name: "Create account" }));

    expect(screen.getByLabelText("Username")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create my account" })).toBeVisible();
  });
});
