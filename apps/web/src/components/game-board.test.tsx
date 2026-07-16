import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { PlayerView } from "@dominoes/contracts";
import { GameBoard } from "./game-board.js";

const view: PlayerView = {
  matchId: "match-1",
  seat: 0,
  version: 3,
  status: "ACTIVE",
  scores: [12, 7],
  targetScore: 100,
  winnerSeat: null,
  roundNumber: 2,
  currentSeat: 0,
  hand: [{ id: "2-5", left: 2, right: 5 }],
  seats: [{ seat: 0, tileCount: 1 }, { seat: 1, tileCount: 4 }],
  boneyardCount: 8,
  chain: [{ tile: { id: "2-4", left: 2, right: 4 }, left: 2, right: 4 }],
  openEnds: [2, 4],
  legalActions: [{ type: "PLAY_TILE", tileId: "2-5", sides: ["LEFT"] }]
};

describe("GameBoard", () => {
  test("submits a server-advertised tile action", () => {
    const onCommand = vi.fn();
    render(<GameBoard view={view} onCommand={onCommand} />);

    fireEvent.click(screen.getByRole("button", { name: "Tile 2-5" }));

    expect(onCommand).toHaveBeenCalledWith({ type: "PLAY_TILE", tileId: "2-5", side: "LEFT" });
    expect(screen.getByText("Opponent · 4 tiles")).toBeVisible();
    expect(screen.getByText("12")).toBeVisible();
  });

  test("shows the result when a match is finished", () => {
    render(<GameBoard view={{ ...view, status: "FINISHED", winnerSeat: 0, legalActions: [] }} onCommand={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("You won");
  });
});
