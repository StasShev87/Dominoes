import { expect, test, type Locator, type Page } from "@playwright/test";
import type { PlayerView } from "@dominoes/contracts";

type PlacedTile = PlayerView["chain"][number];

interface HalfGeometry {
  readonly x: number;
  readonly y: number;
  readonly pips: number;
}

interface TileGeometry {
  readonly center: { readonly x: number; readonly y: number };
  readonly orientation: "horizontal" | "vertical";
  readonly halves: readonly HalfGeometry[];
}

function placed(moveNumber: number, left: number, right: number): PlacedTile {
  const low = Math.min(left, right) as PlacedTile["left"];
  const high = Math.max(left, right) as PlacedTile["right"];
  return {
    tile: { id: `${low}-${high}`, left: low, right: high },
    left: left as PlacedTile["left"],
    right: right as PlacedTile["right"],
    moveNumber
  };
}

function chain(pips: number[], moves: number[]): PlacedTile[] {
  return moves.map((move, index) => placed(move, pips[index]!, pips[index + 1]!));
}

function view(matchId: string, placedChain: PlacedTile[]): PlayerView {
  return {
    matchId,
    seat: 0,
    version: 1,
    status: "ACTIVE",
    scores: [0, 0],
    targetScore: 100,
    winnerSeat: null,
    roundNumber: 1,
    currentSeat: 0,
    hand: [],
    seats: [{ seat: 0, tileCount: 0 }, { seat: 1, tileCount: 0 }],
    boneyardCount: 0,
    chain: placedChain,
    openEnds: placedChain.length
      ? [placedChain[0]!.left, placedChain.at(-1)!.right]
      : null,
    legalActions: []
  };
}

async function loadScenario(
  page: Page,
  name: string,
  placedChain: PlacedTile[],
  viewportWidth = 560
): Promise<void> {
  test.skip(test.info().project.name !== "desktop-chromium", "desktop visual proof");
  await page.setViewportSize({ width: viewportWidth, height: 900 });
  await page.routeWebSocket(/\/socket\.io\//, () => {});
  await page.route(`**/v1/matches/${name}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(view(name, placedChain))
    })
  );
  await page.goto(`/en/game/${name}`);
  await page.addStyleTag({ content: ".chain-tile { transition: none !important; }" });
  await expect(page.locator(".chain-tile")).toHaveCount(placedChain.length);
}

async function screenshotScenario(
  page: Page,
  name: string,
  placedChain: PlacedTile[],
  file: string,
  assertion: () => Promise<void>
): Promise<void> {
  await loadScenario(page, name, placedChain);
  await assertMatchingPipsAtEveryJoin(page);
  await assertion();
  await page.locator(".board-zone").screenshot({ path: file });
}

async function readTileGeometry(tile: Locator): Promise<TileGeometry> {
  return tile.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const domino = element.querySelector<HTMLElement>("[data-orientation]");
    if (!domino || (domino.dataset.orientation !== "horizontal" && domino.dataset.orientation !== "vertical")) {
      throw new Error("Expected a positioned domino with a valid orientation");
    }
    const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    const pipCounts = Array.from(element.querySelectorAll(".pip-grid"), (half) =>
      half.querySelectorAll(".pip").length
    );
    if (pipCounts.length !== 2) throw new Error("Expected each domino to have two pip halves");
    const halfCenters = domino.dataset.orientation === "horizontal"
      ? [
          { x: center.x - bounds.width / 4, y: center.y },
          { x: center.x + bounds.width / 4, y: center.y }
        ]
      : [
          { x: center.x, y: center.y - bounds.height / 4 },
          { x: center.x, y: center.y + bounds.height / 4 }
        ];
    return {
      center,
      orientation: domino.dataset.orientation,
      halves: halfCenters.map((half, index) => ({ ...half, pips: pipCounts[index]! }))
    };
  });
}

async function geometryForMove(page: Page, moveNumber: number): Promise<TileGeometry> {
  const tile = page.locator(`[data-move-number="${moveNumber}"]`);
  await expect(tile).toHaveCount(1);
  return readTileGeometry(tile);
}

function nearestHalf(first: TileGeometry, second: TileGeometry): [HalfGeometry, HalfGeometry] {
  const direction = {
    x: second.center.x - first.center.x,
    y: second.center.y - first.center.y
  };
  const pairs = first.halves.flatMap((left) => second.halves.map((right) => ({
    left,
    right,
    distance: Math.hypot(left.x - right.x, left.y - right.y),
    facing: (left.x - first.center.x) * direction.x +
      (left.y - first.center.y) * direction.y +
      (right.x - second.center.x) * -direction.x +
      (right.y - second.center.y) * -direction.y
  })));
  const closest = pairs.sort((left, right) =>
    left.distance - right.distance || right.facing - left.facing
  )[0];
  if (!closest) throw new Error("Expected each domino to have two pip halves");
  return [closest.left, closest.right];
}

async function assertMatchingPipsAtEveryJoin(page: Page): Promise<void> {
  const tiles = page.locator(".chain-tile");
  const count = await tiles.count();
  for (let index = 0; index < count - 1; index += 1) {
    const [first, second] = await Promise.all([
      readTileGeometry(tiles.nth(index)),
      readTileGeometry(tiles.nth(index + 1))
    ]);
    const [firstHalf, secondHalf] = nearestHalf(first, second);
    expect(firstHalf.pips, `join ${index}-${index + 1}`).toBe(secondHalf.pips);
  }
}

function nearestHalfByRow(tile: TileGeometry, row: number): HalfGeometry {
  return [...tile.halves].sort((left, right) => Math.abs(left.y - row) - Math.abs(right.y - row))[0]!;
}

function assertCornerContinuesVertically(
  incoming: TileGeometry,
  corner: TileGeometry,
  outgoing: TileGeometry,
  verticalDirection: -1 | 1
): void {
  expect(corner.orientation).toBe("vertical");
  const incomingHalf = nearestHalfByRow(corner, incoming.center.y);
  const outgoingHalf = nearestHalfByRow(corner, outgoing.center.y);
  expect(Math.abs(incomingHalf.y - incoming.center.y)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(outgoingHalf.y - outgoing.center.y)).toBeLessThanOrEqual(0.5);
  expect((outgoing.center.y - incoming.center.y) * verticalDirection).toBeGreaterThan(0);
  expect((outgoingHalf.y - incomingHalf.y) * verticalDirection).toBeGreaterThan(0);
}

async function assertMoveCorner(
  page: Page,
  moveNumber: number,
  verticalDirection: -1 | 1
): Promise<void> {
  const [incoming, corner, outgoing] = await Promise.all([
    geometryForMove(page, moveNumber - 1),
    geometryForMove(page, moveNumber),
    geometryForMove(page, moveNumber + 1)
  ]);
  assertCornerContinuesVertically(incoming, corner, outgoing, verticalDirection);
}

async function assertRepeatedBranchCorners(page: Page): Promise<void> {
  const moveNumbers = await page.locator(".chain-tile").evaluateAll((tiles) =>
    tiles.map((tile) => Number(tile.getAttribute("data-move-number")))
  );
  let verifiedCorners = 0;
  const verifiedDirections = new Set<-1 | 1>();
  for (const moveNumber of moveNumbers) {
    if (moveNumber === 0 || !moveNumbers.includes(moveNumber - 2) || !moveNumbers.includes(moveNumber + 2)) continue;
    const corner = await geometryForMove(page, moveNumber);
    if (corner.orientation !== "vertical") continue;
    const verticalDirection = moveNumber % 2 === 0 ? 1 : -1;
    const [incoming, outgoing] = await Promise.all([
      geometryForMove(page, moveNumber - 2),
      geometryForMove(page, moveNumber + 2)
    ]);
    assertCornerContinuesVertically(incoming, corner, outgoing, verticalDirection);
    verifiedCorners += 1;
    verifiedDirections.add(verticalDirection);
  }
  expect(verifiedCorners).toBeGreaterThanOrEqual(3);
  expect(verifiedDirections).toEqual(new Set([-1, 1]));
}

async function assertNarrowFirstDoubleBranchIsTotal(page: Page): Promise<void> {
  const firstBranchDouble = chain([1, 5, 5, 3, 1], [0, 1, 2, 3]);
  await loadScenario(page, "turn-first-double-narrow", firstBranchDouble, 320);
  const tiles = page.locator(".chain-tile");
  await expect(tiles).toHaveCount(firstBranchDouble.length);
  const transforms = await tiles.evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element).transform)
  );
  expect(transforms.every((transform) => !/NaN|undefined/.test(transform))).toBe(true);
}

const normal = chain(
  [1, 5, 3, 2, 4, 0],
  [0, 1, 2, 3, 4]
);
const throughDouble = chain(
  [1, 5, 3, 3, 2, 4, 0],
  [0, 1, 2, 3, 4, 5]
);
const repeated = chain(
  [0, 1, 2, 3, 4, 5, 6, 0, 2, 4, 6, 5, 3, 1, 0, 3, 6, 2, 5, 1, 4],
  [19, 17, 15, 13, 11, 9, 7, 5, 3, 1, 0, 2, 4, 6, 8, 10, 12, 14, 16, 18]
);

test.beforeEach(() => {
  test.skip(test.info().project.name !== "desktop-chromium", "desktop visual proof");
});

test("captures a normal penultimate-tile turn", async ({ page }) => {
  await assertNarrowFirstDoubleBranchIsTotal(page);
  await screenshotScenario(page, "turn-penultimate", normal, "artifacts/domino-turn-penultimate.png", () =>
    assertMoveCorner(page, 3, 1)
  );
});

test("captures rollback through a double", async ({ page }) => {
  await screenshotScenario(page, "turn-through-double", throughDouble, "artifacts/domino-turn-through-double.png", () =>
    assertMoveCorner(page, 1, 1)
  );
});

test("captures half-center row alignment", async ({ page }) => {
  await screenshotScenario(page, "turn-half-alignment", normal, "artifacts/domino-turn-half-alignment.png", () =>
    assertMoveCorner(page, 3, 1)
  );
});

test("captures both branches and repeated turns", async ({ page }) => {
  await screenshotScenario(page, "turn-both-branches", repeated, "artifacts/domino-turn-both-branches.png", () =>
    assertRepeatedBranchCorners(page)
  );
});

test("captures matching pips at every join", async ({ page }) => {
  await screenshotScenario(page, "turn-matching-pips", repeated, "artifacts/domino-turn-matching-pips.png", async () => {});
});
