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

interface TilePlacement {
  readonly transform: string;
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

const DOUBLE_SIX_TILES: PlayerView["hand"] =
  Array.from({ length: 7 }, (_, left) =>
    Array.from({ length: 7 - left }, (_, offset) => ({
      id: `${left}-${left + offset}`,
      left,
      right: left + offset
    }))
  ).flat();
const DOUBLE_SIX_TILE_IDS = new Set(DOUBLE_SIX_TILES.map(({ id }) => id));

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

function remainingDoubleSixTiles(placedChain: PlacedTile[]): PlayerView["hand"] {
  const ids = placedChain.map(({ tile }) => tile.id);
  if (ids.some((id) => !DOUBLE_SIX_TILE_IDS.has(id)) || new Set(ids).size !== ids.length) {
    throw new Error("Visual fixtures must use unique physical tiles from a double-six set");
  }
  return DOUBLE_SIX_TILES.filter(({ id }) => !ids.includes(id));
}

interface ActiveFixtureState {
  readonly hand: PlayerView["hand"];
  readonly opponentTileCount: number;
  readonly boneyardCount: number;
  readonly legalActions: PlayerView["legalActions"];
}

function activeFixtureState(placedChain: PlacedTile[], openEnds: readonly [number, number] | null): ActiveFixtureState {
  const remainingTiles = remainingDoubleSixTiles(placedChain);
  const chainLength = placedChain.length;
  const boneyardCount = chainLength <= 14 ? 14 : 0;
  const currentHandCount = chainLength <= 14 ? 7 - Math.floor(chainLength / 2) : 4;
  const opponentTileCount = remainingTiles.length - currentHandCount - boneyardCount;
  const hand = remainingTiles.filter(({ left, right }) =>
    !openEnds || (left !== openEnds[0] && left !== openEnds[1] && right !== openEnds[0] && right !== openEnds[1])
  ).slice(0, currentHandCount);
  const total = chainLength + hand.length + opponentTileCount + boneyardCount;
  if (
    boneyardCount < 0 || boneyardCount > 14 ||
    opponentTileCount < 1 || hand.length !== currentHandCount ||
    new Set(hand.map(({ id }) => id)).size !== hand.length ||
    hand.some(({ id }) => placedChain.some(({ tile }) => tile.id === id)) ||
    total !== DOUBLE_SIX_TILES.length
  ) {
    throw new Error("Active visual fixtures must account for a reachable double-six deal");
  }
  return {
    hand,
    opponentTileCount,
    boneyardCount,
    legalActions: boneyardCount ? [{ type: "DRAW_TILE" }] : [{ type: "PASS" }]
  };
}

function view(matchId: string, placedChain: PlacedTile[]): PlayerView {
  const openEnds = placedChain.length
    ? [placedChain[0]!.left, placedChain.at(-1)!.right] as const
    : null;
  const fixture = activeFixtureState(placedChain, openEnds);
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
    hand: fixture.hand,
    seats: [{ seat: 0, tileCount: fixture.hand.length }, { seat: 1, tileCount: fixture.opponentTileCount }],
    boneyardCount: fixture.boneyardCount,
    chain: placedChain,
    openEnds,
    legalActions: fixture.legalActions
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
  await page.context().route("**/sw.js", (route) => route.abort());
  await page.routeWebSocket(/\/socket\.io\//, () => {});
  await page.route(`**/v1/matches/${name}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(view(name, placedChain))
    })
  );
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL) throw new Error("Visual proof requires a Playwright base URL");
  await page.goto(new URL(`/en/game/${name}`, baseURL).toString());
  await page.addStyleTag({ content: ".chain-tile { transition: none !important; }" });
  await waitForResponsiveBoardLayout(page, placedChain.length);
}

async function waitForResponsiveBoardLayout(page: Page, expectedTileCount: number): Promise<void> {
  const tiles = page.locator(".chain-tile");
  await expect(tiles).toHaveCount(expectedTileCount);
  const readPositions = () => tiles.evaluateAll((elements) => elements.map((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      transform: element.getAttribute("style") ?? "",
      left: bounds.left,
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom,
      width: bounds.width,
      height: bounds.height
    };
  }));
  const readLayout = () => page.locator(".chain-layout").evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom };
  });
  let previous: Awaited<ReturnType<typeof readPositions>> | undefined;
  await expect.poll(async () => {
    const current = await readPositions();
    const layout = await readLayout();
    const withinResponsiveBounds = current.every((placement) =>
      placement.left >= layout.left - 0.5 &&
      placement.right <= layout.right + 0.5 &&
      placement.top >= layout.top - 0.5 &&
      placement.bottom <= layout.bottom + 0.5
    );
    const settled = previous !== undefined && JSON.stringify(current) === JSON.stringify(previous);
    previous = current;
    return settled && withinResponsiveBounds;
  }, { timeout: 5_000 }).toBe(true);
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
  const originIndex = moveNumbers.indexOf(0);
  expect(originIndex).toBeGreaterThan(0);
  expect(originIndex).toBeLessThan(moveNumbers.length - 1);
  const branches = [
    { name: "left", verticalDirection: -1 as const, moves: moveNumbers.slice(0, originIndex).reverse() },
    { name: "right", verticalDirection: 1 as const, moves: moveNumbers.slice(originIndex + 1) }
  ];

  for (const branch of branches) {
    let verifiedCorners = 0;
    for (let index = 0; index < branch.moves.length - 1; index += 1) {
      const moveNumber = branch.moves[index]!;
      const corner = await geometryForMove(page, moveNumber);
      if (corner.orientation !== "vertical") continue;
      const incomingMove = index === 0 ? 0 : branch.moves[index - 1]!;
      const outgoingMove = branch.moves[index + 1]!;
      const [incoming, outgoing] = await Promise.all([
        geometryForMove(page, incomingMove),
        geometryForMove(page, outgoingMove)
      ]);
      assertCornerContinuesVertically(incoming, corner, outgoing, branch.verticalDirection);
      verifiedCorners += 1;
    }
    expect(verifiedCorners, `${branch.name} branch`).toBeGreaterThanOrEqual(2);
  }
}

async function assertNarrowFirstDoubleBranchIsTotal(page: Page): Promise<void> {
  const firstBranchDouble = chain([1, 5, 5, 3, 1], [0, 1, 2, 3]);
  await loadScenario(page, "turn-first-double-narrow", firstBranchDouble, 320);
  const tiles = page.locator(".chain-tile");
  await expect(tiles).toHaveCount(firstBranchDouble.length);
  const board = await page.locator(".chain-layout").boundingBox();
  expect(board).not.toBeNull();
  const placements = await tiles.evaluateAll<TilePlacement[]>((elements) => elements.map((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      transform: element.getAttribute("style") ?? "",
      left: bounds.left,
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom,
      width: bounds.width,
      height: bounds.height
    };
  }));
  for (const placement of placements) {
    const match = placement.transform.match(/transform:\s*translate\(\s*([^\s,]+)px,\s*([^\s,)]+)px\s*\)/);
    expect(match).not.toBeNull();
    expect(placement.transform).not.toMatch(/NaN|undefined/);
    const coordinates = [Number(match![1]), Number(match![2])];
    expect(coordinates.every(Number.isFinite)).toBe(true);
    expect(Object.values(placement).filter((value) => typeof value === "number").every(Number.isFinite)).toBe(true);
    expect(placement.width).toBeGreaterThan(0);
    expect(placement.height).toBeGreaterThan(0);
    expect(placement.right).toBeGreaterThan(board!.x);
    expect(placement.left).toBeLessThan(board!.x + board!.width);
    expect(placement.bottom).toBeGreaterThan(board!.y);
    expect(placement.top).toBeLessThan(board!.y + board!.height);
  }
  expect(new Set(placements.map(({ left, top }) => `${left}:${top}`)).size).toBe(placements.length);
  for (let index = 0; index < placements.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < placements.length; otherIndex += 1) {
      const first = placements[index]!;
      const second = placements[otherIndex]!;
      const overlap = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left)) *
        Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
      expect(overlap).toBeLessThan(Math.min(first.width * first.height, second.width * second.height) / 4);
    }
  }
}

async function assertNarrowOrdinaryChainRollsCornerBackward(page: Page): Promise<void> {
  const narrowOrdinary = chain([1, 5, 3, 2], [0, 1, 2]);
  await loadScenario(page, "turn-ordinary-narrow", narrowOrdinary, 320);
  const [incoming, corner, outgoing] = await Promise.all([
    geometryForMove(page, 0),
    geometryForMove(page, 1),
    geometryForMove(page, 2)
  ]);
  assertCornerContinuesVertically(incoming, corner, outgoing, 1);
  expect(outgoing.orientation).toBe("horizontal");

  const [cornerBounds, outgoingBounds] = await Promise.all([
    page.locator('[data-move-number="1"]').boundingBox(),
    page.locator('[data-move-number="2"]').boundingBox()
  ]);
  expect(cornerBounds).not.toBeNull();
  expect(outgoingBounds).not.toBeNull();
  const overlap = Math.max(
    0,
    Math.min(cornerBounds!.x + cornerBounds!.width, outgoingBounds!.x + outgoingBounds!.width) -
      Math.max(cornerBounds!.x, outgoingBounds!.x)
  ) * Math.max(
    0,
    Math.min(cornerBounds!.y + cornerBounds!.height, outgoingBounds!.y + outgoingBounds!.height) -
      Math.max(cornerBounds!.y, outgoingBounds!.y)
  );
  expect(overlap).toBeLessThan(Math.min(
    cornerBounds!.width * cornerBounds!.height,
    outgoingBounds!.width * outgoingBounds!.height
  ) / 4);
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
  [0, 1, 2, 0, 3, 1, 4, 0, 5, 1, 6, 2, 3, 4, 2, 5, 3, 6, 4, 5, 6, 0],
  [19, 17, 15, 13, 11, 9, 7, 5, 3, 1, 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]
);

test.beforeEach(() => {
  test.skip(test.info().project.name !== "desktop-chromium", "desktop visual proof");
});

test("captures a normal penultimate-tile turn", async ({ page }) => {
  await assertNarrowFirstDoubleBranchIsTotal(page);
  await assertNarrowOrdinaryChainRollsCornerBackward(page);
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
