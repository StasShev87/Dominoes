import { describe, expect, test } from "vitest";
import type { PlayerView } from "@dominoes/contracts";
import { layoutDominoChain } from "./domino-chain-layout.js";

type PlacedTile = PlayerView["chain"][number];

describe("layoutDominoChain", () => {
  test("orders visible pips along both branches around move zero", () => {
    const chain = [
      placedValues(2, 3, 5),
      placedValues(1, 5, 5),
      placedValues(0, 5, 0),
      placedValues(3, 0, 2),
      placedValues(4, 2, 4)
    ];

    const layout = layoutDominoChain(chain, 800);

    expect(layout.tiles.map(({ visualTile }) => [visualTile.left, visualTile.right]))
      .toEqual([[3, 5], [5, 5], [5, 0], [0, 2], [2, 4]]);
  });

  test("follows logical pip order through turns and reversed rows", () => {
    const chain = [
      placedValues(9, 0, 1),
      placedValues(7, 1, 2),
      placedValues(5, 2, 3),
      placedValues(3, 3, 4),
      placedValues(1, 4, 5),
      placedValues(0, 5, 6),
      placedValues(2, 6, 4),
      placedValues(4, 4, 3),
      placedValues(6, 3, 2),
      placedValues(8, 2, 1),
      placedValues(10, 1, 0)
    ];

    const layout = layoutDominoChain(chain, 300);
    const byMove = (moveNumber: number) =>
      layout.tiles.find(({ tile }) => tile.moveNumber === moveNumber)!;

    expect(byMove(3).orientation).toBe("vertical");
    expect([byMove(3).visualTile.left, byMove(3).visualTile.right]).toEqual([3, 4]);
    expect(byMove(4).orientation).toBe("vertical");
    expect([byMove(4).visualTile.left, byMove(4).visualTile.right]).toEqual([4, 3]);
    expect([byMove(5).visualTile.left, byMove(5).visualTile.right]).toEqual([3, 2]);
    expect([byMove(6).visualTile.left, byMove(6).visualTile.right]).toEqual([2, 3]);
  });

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

function placedValues(
  moveNumber: number,
  left: PlacedTile["left"],
  right: PlacedTile["right"]
): PlacedTile {
  const [canonicalLeft, canonicalRight] = left <= right ? [left, right] : [right, left];
  return {
    tile: { id: `${canonicalLeft}-${canonicalRight}`, left: canonicalLeft, right: canonicalRight },
    left,
    right,
    moveNumber
  };
}
