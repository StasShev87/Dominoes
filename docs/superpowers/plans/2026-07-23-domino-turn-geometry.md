# Domino Turn Geometry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backtrack every snake turn to the nearest previous non-double, align adjacent rows with the corner tile's half-centers, and produce five deterministic visual proofs.

**Architecture:** Keep responsive geometry in `layoutDominoChain`. Extend its branch placer with a replay queue and current-row history so overflow can roll back to a non-double corner and reflow later tiles on the next row. Add a Playwright-only network fixture that renders synthetic `PlayerView` chains through the real game page without adding production endpoints.

**Tech Stack:** TypeScript, Vitest, Next.js, Playwright 1.61

## Global Constraints

- Every turn uses one vertical non-double corner tile.
- If overflow occurs after a double, move the turn backward to the nearest previous non-double and reflow the double on the next row.
- Previous and next horizontal row centers equal the incoming and outgoing half-centers of the corner tile.
- Left branch turns upward; right branch turns downward.
- Visible pip values match at every geometric connection.
- Preserve opening-tile behavior, responsive centering, game engine, API, persistence, contracts, CSS, and `DominoTile`.
- Save the five required PNG files under `artifacts/`.

---

### Task 1: Backtracking Turn Layout

**Files:**
- Modify: `apps/web/src/components/domino-chain-layout.ts`
- Test: `apps/web/src/components/domino-chain-layout.test.ts`

**Interfaces:**
- Consumes: `layoutDominoChain(chain: readonly PlacedTile[], containerWidth: number)`.
- Produces: the unchanged `DominoChainLayout` interface with corrected coordinates, orientations, and visual pip order.

- [ ] **Step 1: Add geometry helpers to the test**

Add:

```ts
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
```

- [ ] **Step 2: Write failing tests for normal backtracking and half alignment**

Add:

```ts
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
```

Run:

```bash
pnpm --filter @dominoes/web exec vitest run src/components/domino-chain-layout.test.ts
```

Expected: FAIL because the overflow tile, not move 2, becomes the corner and the outgoing row uses the corner midpoint.

- [ ] **Step 3: Write the failing rollback-across-double test**

Add:

```ts
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
```

Run the focused command again. Expected: FAIL because the current algorithm does not roll an already placed double onto the next row.

- [ ] **Step 4: Implement row history and replay**

Add:

```ts
interface RowEntry {
  readonly index: number;
  readonly raw: RawTile;
}

function isDouble(tile: PlacedTile): boolean {
  return tile.tile.left === tile.tile.right;
}

function branchIndices(length: number, firstIndex: number, step: -1 | 1): number[] {
  const result: number[] = [];
  for (let index = firstIndex; index >= 0 && index < length; index += step) {
    result.push(index);
  }
  return result;
}
```

Replace the `for` loop inside `placeBranch` with a pending queue. Keep
`rowAnchor`, `rowCenterY`, and the horizontal `row` history:

```ts
const pending = branchIndices(chain.length, firstIndex, indexStep);
let rowAnchor = origin;
let rowCenterY = origin.centerY;
let row: RowEntry[] = [];

while (pending.length) {
  const index = pending.shift()!;
  const tile = chain[index]!;
  const orientation = tileOrientation(tile, "horizontal");
  const dimensions = tileDimensions(orientation);
  const centerX = previous.centerX +
    horizontalDirection * (previous.width / 2 + dimensions.width / 2 + GAP);
  const minCenterX = PADDING + dimensions.width / 2;
  const maxCenterX = width - PADDING - dimensions.width / 2;
  const crossesBoundary =
    centerX < minCenterX - GAP || centerX > maxCenterX + GAP;

  if (!crossesBoundary) {
    const placed = rawTile(
      tile,
      Math.min(maxCenterX, Math.max(minCenterX, centerX)),
      rowCenterY,
      orientation,
      flowDirection(horizontalDirection, indexStep)
    );
    output.set(index, placed);
    row.push({ index, raw: placed });
    previous = placed;
    continue;
  }

  const cornerAt = row.findLastIndex(({ raw }) => !isDouble(raw.tile));
  const currentBecomesCorner = cornerAt < 0 && !isDouble(tile);
  if (cornerAt < 0 && !currentBecomesCorner) {
    // A legal double-six chain cannot contain two distinct adjacent doubles
    // with the same open value. Keep the layout total for malformed fixture
    // data by placing the double on the current row and trying again later.
    const fallback = rawTile(
      tile,
      Math.min(maxCenterX, Math.max(minCenterX, centerX)),
      rowCenterY,
      orientation,
      flowDirection(horizontalDirection, indexStep)
    );
    output.set(index, fallback);
    row.push({ index, raw: fallback });
    previous = fallback;
    continue;
  }

  const cornerEntry = currentBecomesCorner
    ? { index, raw: rawTile(tile, centerX, rowCenterY, orientation,
        flowDirection(horizontalDirection, indexStep)) }
    : row[cornerAt]!;
  const replay = currentBecomesCorner
    ? []
    : row.slice(cornerAt + 1).map(({ index: replayIndex }) => replayIndex);
  const beforeCorner = currentBecomesCorner
    ? rowAnchor
    : cornerAt > 0 ? row[cornerAt - 1]!.raw : rowAnchor;
  if (!currentBecomesCorner) {
    row.slice(cornerAt).forEach(({ index: removedIndex }) => output.delete(removedIndex));
  }

  const cornerOrientation: DominoOrientation = "vertical";
  const cornerDimensions = tileDimensions(cornerOrientation);
  const cornerCenterX = beforeCorner.centerX + horizontalDirection *
    (beforeCorner.width / 2 + cornerDimensions.width / 2 + GAP);
  const cornerCenterY = rowCenterY + verticalDirection * cornerDimensions.height / 4;
  const corner = rawTile(
    cornerEntry.raw.tile,
    cornerCenterX,
    cornerCenterY,
    cornerOrientation,
    flowDirection(verticalDirection, indexStep)
  );
  output.set(cornerEntry.index, corner);

  if (!currentBecomesCorner) {
    pending.unshift(...replay, index);
  }
  horizontalDirection = horizontalDirection === -1 ? 1 : -1;
  rowCenterY = cornerCenterY + verticalDirection * corner.height / 4;
  rowAnchor = corner;
  previous = corner;
  row = [];
}
```

Keep the existing origin construction and final vertical centering logic.

The `currentBecomesCorner` path is required for very narrow responsive
containers where the first non-double branch tile itself reaches the boundary.
It prevents a runtime exception while preserving the centered origin and the
same half-center alignment.

- [ ] **Step 5: Verify the first GREEN**

Run the focused Vitest command. Expected: all layout tests PASS.

- [ ] **Step 6: Add both-branch, repeated-turn, and pip-connection tests**

Add a long connected chain:

```ts
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
```

If a double is needed to distinguish a perpendicular regular double from a
corner, use `isDouble(tile.tile)` in the test rather than orientation alone.

- [ ] **Step 7: Run focused and full web tests**

```bash
pnpm --filter @dominoes/web exec vitest run src/components/domino-chain-layout.test.ts
pnpm --filter @dominoes/web test
```

Expected: all layout and web tests PASS.

- [ ] **Step 8: Commit Task 1**

```bash
git add apps/web/src/components/domino-chain-layout.ts apps/web/src/components/domino-chain-layout.test.ts
git commit -m "fix: align domino snake turns"
```

### Task 2: Deterministic Visual Proofs

**Files:**
- Create: `tests/e2e/domino-turn-visual.spec.ts`
- Create: `artifacts/domino-turn-penultimate.png`
- Create: `artifacts/domino-turn-through-double.png`
- Create: `artifacts/domino-turn-half-alignment.png`
- Create: `artifacts/domino-turn-both-branches.png`
- Create: `artifacts/domino-turn-matching-pips.png`

**Interfaces:**
- Consumes: the public game page and `PlayerView` wire shape.
- Produces: five Playwright assertions and five stable PNG artifacts.

- [ ] **Step 1: Create typed visual fixtures**

Start the test file with:

```ts
import { expect, test, type Page } from "@playwright/test";
import type { PlayerView } from "@dominoes/contracts";

type PlacedTile = PlayerView["chain"][number];

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
```

- [ ] **Step 2: Add the real-page screenshot helper**

```ts
async function screenshotScenario(
  page: Page,
  name: string,
  placedChain: PlacedTile[],
  file: string
): Promise<void> {
  test.skip(test.info().project.name !== "desktop-chromium", "desktop visual proof");
  await page.setViewportSize({ width: 560, height: 900 });
  await page.routeWebSocket(/\/socket\.io\//, () => {});
  await page.route(`**/v1/matches/${name}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(view(name, placedChain))
    })
  );
  await page.goto(`/en/game/${name}`);
  await expect(page.locator(".chain-tile")).toHaveCount(placedChain.length);
  await page.locator(".board-zone").screenshot({ path: file });
}
```

- [ ] **Step 3: Add five screenshot cases**

```ts
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

test("captures a normal penultimate-tile turn", async ({ page }) => {
  await screenshotScenario(page, "turn-penultimate", normal, "artifacts/domino-turn-penultimate.png");
});

test("captures rollback through a double", async ({ page }) => {
  await screenshotScenario(page, "turn-through-double", throughDouble, "artifacts/domino-turn-through-double.png");
});

test("captures half-center row alignment", async ({ page }) => {
  await screenshotScenario(page, "turn-half-alignment", normal, "artifacts/domino-turn-half-alignment.png");
});

test("captures both branches and repeated turns", async ({ page }) => {
  await screenshotScenario(page, "turn-both-branches", repeated, "artifacts/domino-turn-both-branches.png");
});

test("captures matching pips at every join", async ({ page }) => {
  await screenshotScenario(page, "turn-matching-pips", repeated, "artifacts/domino-turn-matching-pips.png");
});
```

- [ ] **Step 4: Add visual assertions before each screenshot**

For normal and double fixtures, inspect `.chain-tile` bounding boxes and assert
the corner's incoming/outgoing half-center alignment within `0.5` px. For all
fixtures, read each tile's two `.pip-grid` counts and compare the nearest
geometric half pair for every adjacent chain index. Assert the values match
before saving the PNG.

- [ ] **Step 5: Run visual and complete verification**

```bash
pnpm exec playwright test tests/e2e/domino-turn-visual.spec.ts --project=desktop-chromium
pnpm check
pnpm test:e2e
```

Expected: five visual tests PASS, all repository checks PASS, and the complete
desktop/mobile E2E suite PASS. Open all five PNGs and verify that the requested
turns are clearly visible and not clipped.

- [ ] **Step 6: Commit Task 2**

```bash
git add tests/e2e/domino-turn-visual.spec.ts artifacts/domino-turn-penultimate.png artifacts/domino-turn-through-double.png artifacts/domino-turn-half-alignment.png artifacts/domino-turn-both-branches.png artifacts/domino-turn-matching-pips.png
git commit -m "test: capture domino turn geometry"
```
