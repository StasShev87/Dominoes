import { describe, expect, test } from "vitest";
import type { PlayerView } from "@dominoes/contracts";
import { layoutDominoChain } from "./domino-chain-layout.js";

type PlacedTile = PlayerView["chain"][number];

describe("layoutDominoChain", () => {
  test("keeps move zero centered and grows toward both sides", () => {
    const chain = [placed(1), placed(0), placed(2)];
    const layout = layoutDominoChain(chain, 600);
    const origin = layout.tiles.find(({ tile }) => tile.moveNumber === 0)!;
    const beginning = layout.tiles.find(({ tile }) => tile.moveNumber === 1)!;
    const end = layout.tiles.find(({ tile }) => tile.moveNumber === 2)!;

    expect(origin.x + origin.width / 2).toBe(300);
    expect(origin.orientation).toBe("horizontal");
    expect(beginning.x).toBeLessThan(origin.x);
    expect(end.x).toBeGreaterThan(origin.x);
  });

  test("turns the beginning upward and the end downward on a narrow board", () => {
    const chain = [
      placed(9), placed(7), placed(5), placed(3), placed(1), placed(0),
      placed(2), placed(4), placed(6), placed(8), placed(10)
    ];
    const layout = layoutDominoChain(chain, 300);
    const origin = layout.tiles.find(({ tile }) => tile.moveNumber === 0)!;
    const beginningOuter = layout.tiles.find(({ tile }) => tile.moveNumber === 9)!;
    const endOuter = layout.tiles.find(({ tile }) => tile.moveNumber === 10)!;

    expect(beginningOuter.y).toBeLessThan(origin.y);
    expect(endOuter.y).toBeGreaterThan(origin.y);
    expect(layout.tiles.every(({ x, width }) => x >= 12 && x + width <= 288)).toBe(true);
    expect(layout.height).toBeGreaterThan(280);
  });

  test("places doubles perpendicular to travel", () => {
    const chain = [placed(1, true), placed(0), placed(2, true)];
    const layout = layoutDominoChain(chain, 600);

    expect(layout.tiles.find(({ tile }) => tile.moveNumber === 1)?.orientation).toBe("vertical");
    expect(layout.tiles.find(({ tile }) => tile.moveNumber === 2)?.orientation).toBe("vertical");
  });
});

function placed(moveNumber: number, double = false): PlacedTile {
  const left = double ? 2 : 1;
  const right = 2;
  return { tile: { id: `${left}-${right}`, left, right }, left, right, moveNumber };
}
