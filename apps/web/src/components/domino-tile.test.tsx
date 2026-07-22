import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { DominoTile } from "./domino-tile.js";

describe("DominoTile", () => {
  test("is keyboard accessible and reports selection", () => {
    const onSelect = vi.fn();
    render(
      <DominoTile
        tile={{ id: "2-5", left: 2, right: 5 }}
        selectable
        onSelect={onSelect}
      />
    );

    const tile = screen.getByRole("button", { name: "Tile 2-5" });
    tile.focus();
    fireEvent.click(tile);

    expect(tile).toHaveFocus();
    expect(onSelect).toHaveBeenCalledWith("2-5");
  });

  test("renders a non-interactive board tile as an image", () => {
    render(<DominoTile tile={{ id: "0-6", left: 0, right: 6 }} />);
    expect(screen.getByRole("img", { name: "Tile 0-6" })).toBeVisible();
  });

  test.each([
    [0, []],
    [1, ["middle-center"]],
    [2, ["top-left", "bottom-right"]],
    [3, ["top-left", "middle-center", "bottom-right"]],
    [4, ["top-left", "top-right", "bottom-left", "bottom-right"]],
    [5, ["top-left", "top-right", "middle-center", "bottom-left", "bottom-right"]],
    [6, ["top-left", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-right"]]
  ] as const)("places value %i pips like a real domino", (value, expectedPositions) => {
    const { container } = render(<DominoTile tile={{ id: `${value}-0`, left: value, right: 0 }} />);
    const firstHalf = container.querySelector(".pip-grid");

    expect(Array.from(firstHalf?.querySelectorAll(".pip") ?? []).map((pip) => pip.getAttribute("data-position"))).toEqual(expectedPositions);
    cleanup();
  });

  test("exposes its requested board orientation", () => {
    render(<DominoTile tile={{ id: "2-5", left: 2, right: 5 }} orientation="horizontal" />);

    expect(screen.getByRole("img", { name: "Tile 2-5" })).toHaveAttribute("data-orientation", "horizontal");
  });
});

