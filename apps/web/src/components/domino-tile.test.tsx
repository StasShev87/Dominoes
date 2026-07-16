import { fireEvent, render, screen } from "@testing-library/react";
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
});

