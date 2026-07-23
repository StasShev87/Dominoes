import { describe, expect, test } from "vitest";
import type { PlayerView } from "@dominoes/contracts";
import { layoutDominoChain } from "./domino-chain-layout.js";

type PlacedTile = PlayerView["chain"][number];

function center(tile: ReturnType<typeof layoutDominoChain>["tiles"][number]) {
  return { x: tile.x + tile.width / 2, y: tile.y + tile.height / 2 };
}

function halfCenters(tile: ReturnType<typeof layoutDominoChain>["tiles"][number]) {
  const { x, y } = center(tile);
  return tile.orientation === "horizontal"
    ? [
        { x: x - tile.width / 4, y, value: tile.visualTile.left },
        { x: x + tile.width / 4, y, value: tile.visualTile.right }
      ]
    : [
        { x, y: y - tile.height / 4, value: tile.visualTile.left },
        { x, y: y + tile.height / 4, value: tile.visualTile.right }
      ];
}

function closestHalves(
  first: ReturnType<typeof layoutDominoChain>["tiles"][number],
  second: ReturnType<typeof layoutDominoChain>["tiles"][number]
) {
  return halfCenters(first).flatMap((left) =>
    halfCenters(second).map((right) => ({
      left,
      right,
      distance: Math.hypot(left.x - right.x, left.y - right.y)
    }))
  ).sort((left, right) => left.distance - right.distance)[0]!;
}

function overlapArea(
  first: ReturnType<typeof layoutDominoChain>["tiles"][number],
  second: ReturnType<typeof layoutDominoChain>["tiles"][number]
): number {
  return Math.max(0, Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x)) *
    Math.max(0, Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y));
}

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

    expect(byMove(1).orientation).toBe("vertical");
    expect([byMove(1).visualTile.left, byMove(1).visualTile.right]).toEqual([4, 5]);
    expect(byMove(2).orientation).toBe("vertical");
    expect([byMove(2).visualTile.left, byMove(2).visualTile.right]).toEqual([6, 4]);
    expect([byMove(3).visualTile.left, byMove(3).visualTile.right]).toEqual([4, 3]);
    expect([byMove(4).visualTile.left, byMove(4).visualTile.right]).toEqual([3, 4]);
    expect([byMove(5).visualTile.left, byMove(5).visualTile.right]).toEqual([2, 3]);
    expect([byMove(6).visualTile.left, byMove(6).visualTile.right]).toEqual([3, 2]);
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

  test("places an opening double perpendicular to the future chain", () => {
    const layout = layoutDominoChain([placed(0, true)], 600);
    const origin = layout.tiles[0]!;

    expect(origin.orientation).toBe("vertical");
    expect(origin.x + origin.width / 2).toBe(300);
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
    expect(layout.height).toBeGreaterThanOrEqual(280);
  });

  test("places doubles perpendicular to travel", () => {
    const chain = [placed(1, true), placed(0), placed(2, true)];
    const layout = layoutDominoChain(chain, 600);

    expect(layout.tiles.find(({ tile }) => tile.moveNumber === 1)?.orientation).toBe("vertical");
    expect(layout.tiles.find(({ tile }) => tile.moveNumber === 2)?.orientation).toBe("vertical");
  });

  test("turns the penultimate non-double and aligns rows with its halves", () => {
    const chain = [
      placedValues(0, 1, 5),
      placedValues(1, 5, 3),
      placedValues(2, 3, 2),
      placedValues(3, 2, 4)
    ];
    const layout = layoutDominoChain(chain, 430);
    const byMove = (move: number) =>
      layout.tiles.find(({ tile }) => tile.moveNumber === move)!;
    const corner = byMove(2);
    const incoming = byMove(1);
    const outgoing = byMove(3);
    const cornerHalves = halfCenters(corner);

    expect(corner.orientation).toBe("vertical");
    expect(center(incoming).y).toBe(cornerHalves[0]!.y);
    expect(center(outgoing).y).toBe(cornerHalves[1]!.y);
    expect(center(outgoing).x).toBeLessThan(center(corner).x);
  });

  test("rolls the corner backward when a narrow clamp would obscure the previous tile", () => {
    const chain = [
      placedValues(0, 1, 5),
      placedValues(1, 5, 3),
      placedValues(2, 3, 2)
    ];
    const layout = layoutDominoChain(chain, 300);
    const byMove = (move: number) =>
      layout.tiles.find(({ tile }) => tile.moveNumber === move)!;
    const incoming = byMove(0);
    const corner = byMove(1);
    const outgoing = byMove(2);
    const cornerHalves = halfCenters(corner);

    expect(corner.orientation).toBe("vertical");
    expect(outgoing.orientation).toBe("horizontal");
    expect(center(incoming).y).toBe(cornerHalves[0]!.y);
    expect(center(outgoing).y).toBe(cornerHalves[1]!.y);
    expect(overlapArea(corner, outgoing))
      .toBeLessThan(Math.min(corner.width * corner.height, outgoing.width * outgoing.height) / 4);
  });

  test("moves a turn backward across a double", () => {
    const chain = [
      placedValues(0, 1, 5),
      placedValues(1, 5, 3),
      placedValues(2, 3, 3),
      placedValues(3, 3, 2),
      placedValues(4, 2, 4)
    ];
    const layout = layoutDominoChain(chain, 430);
    const byMove = (move: number) =>
      layout.tiles.find(({ tile }) => tile.moveNumber === move)!;

    expect(byMove(1).orientation).toBe("vertical");
    expect(byMove(2).orientation).toBe("vertical");
    expect(center(byMove(2)).y).toBe(center(byMove(3)).y);
    expect(center(byMove(2)).x).toBeGreaterThan(center(byMove(3)).x);
  });

  test("turns both branches repeatedly and keeps connecting pips equal", () => {
    const pips = [0, 1, 2, 3, 4, 5, 6, 0, 2, 4, 6, 5, 3, 1, 0, 3, 6, 2, 5, 1, 4];
    const moves = [19, 17, 15, 13, 11, 9, 7, 5, 3, 1, 0, 2, 4, 6, 8, 10, 12, 14, 16, 18];
    const chain = moves.map((move, index) =>
      placedValues(move, pips[index]!, pips[index + 1]!)
    );
    const layout = layoutDominoChain(chain, 430);
    const origin = layout.tiles.find(({ tile }) => tile.moveNumber === 0)!;
    const leftCorners = layout.tiles.filter(({ orientation, tile }) =>
      orientation === "vertical" && tile.moveNumber % 2 === 1 && tile.moveNumber !== 0
    );
    const rightCorners = layout.tiles.filter(({ orientation, tile }) =>
      orientation === "vertical" && tile.moveNumber % 2 === 0 && tile.moveNumber !== 0
    );

    expect(leftCorners.length).toBeGreaterThanOrEqual(2);
    expect(rightCorners.length).toBeGreaterThanOrEqual(2);
    expect(Math.min(...leftCorners.map(({ y }) => y))).toBeLessThan(origin.y);
    expect(Math.max(...rightCorners.map(({ y }) => y))).toBeGreaterThan(origin.y);

    for (let index = 0; index < layout.tiles.length - 1; index += 1) {
      const connection = closestHalves(layout.tiles[index]!, layout.tiles[index + 1]!);
      expect(connection.left.value).toBe(connection.right.value);
    }
  });

  test("grows tall layouts with symmetric vertical margins", () => {
    const pips = [1, 5, 3, 2, 4, 0, 6, 1, 3, 5, 2, 6, 4, 1, 0, 2, 5, 6];
    const chain = pips.slice(0, -1).map((pip, moveNumber) =>
      placedValues(moveNumber, pip!, pips[moveNumber + 1]!)
    );
    const layout = layoutDominoChain(chain, 300);
    const top = Math.min(...layout.tiles.map(({ y }) => y));
    const bottom = Math.max(...layout.tiles.map(({ y, height }) => y + height));

    expect(layout.height).toBeGreaterThan(280);
    expect(top).toBeCloseTo(layout.height - bottom, 5);
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
