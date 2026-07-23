# Domino Chain Orientation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render every domino with matching pip values at adjacent chain ends, including both branches, reversed snake rows, and vertical turns.

**Architecture:** Keep the game engine's normalized `PlacedTile.left/right` as the logical source of truth. Extend the web layout result with a visually ordered tile derived from the local path direction, then render that tile without changing persisted state or API contracts.

**Tech Stack:** TypeScript, React, Vitest, Testing Library, Playwright

## Global Constraints

- Do not change API, persistence, game-engine, or contract schemas.
- Preserve the canonical nested `PlacedTile.tile`.
- Keep move zero centered, the left branch turning upward, and the right branch turning downward.
- Doubles remain perpendicular to local travel.
- Do not include the unrelated `apps/web/next-env.d.ts` working-tree change.

---

### Task 1: Derive Visual Pip Order in the Responsive Layout

**Files:**
- Modify: `apps/web/src/components/domino-chain-layout.ts`
- Test: `apps/web/src/components/domino-chain-layout.test.ts`

**Interfaces:**
- Consumes: `PlayerView["chain"][number]` with normalized `left`, `right`, and `moveNumber`.
- Produces: `PositionedTile.visualTile`, a `Tile`-shaped value whose `left/right` fields are ordered left-to-right for horizontal tiles and top-to-bottom for vertical tiles.

- [ ] **Step 1: Write failing straight-chain and two-branch tests**

Add a helper that can make canonical and normalized values differ:

```ts
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
```

Test a chain whose move-zero tile is in the middle:

```ts
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
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm --filter @dominoes/web test -- domino-chain-layout.test.ts
```

Expected: FAIL because `PositionedTile` has no `visualTile`.

- [ ] **Step 3: Add the minimal visual-order model**

Extend `PositionedTile` and `RawTile`:

```ts
export interface PositionedTile {
  readonly tile: PlacedTile;
  readonly visualTile: PlacedTile["tile"];
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly orientation: DominoOrientation;
}
```

Pass a logical-flow sign into `rawTile`. A positive sign means logical
`left -> right` is displayed left-to-right or top-to-bottom:

```ts
function visuallyOrderTile(tile: PlacedTile, flowDirection: -1 | 1): PlacedTile["tile"] {
  return flowDirection === 1
    ? { id: tile.tile.id, left: tile.left, right: tile.right }
    : { id: tile.tile.id, left: tile.right, right: tile.left };
}
```

For the origin use `1`. For horizontal branch tiles use
`horizontalDirection * indexStep`; for vertical turns use
`verticalDirection * indexStep`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
pnpm --filter @dominoes/web test -- domino-chain-layout.test.ts
```

Expected: all layout tests PASS.

- [ ] **Step 5: Add failing snake-direction tests**

Add this narrow-board case, where moves 3 and 4 are the first vertical turns
and moves 5 and 6 start the reversed rows:

```ts
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
```

- [ ] **Step 6: Run the focused test and verify RED**

Run the same focused Vitest command. Expected: FAIL at the first incorrect
turn or reversed-row assertion.

- [ ] **Step 7: Complete flow-direction propagation**

Use the branch's current horizontal direction before each placement. When a
boundary is crossed, orient by `verticalDirection * indexStep`, then reverse
`horizontalDirection` for subsequent tiles. Preserve double orientation and
use the same value-order helper; equal halves make the swap harmless.

- [ ] **Step 8: Run layout tests and commit**

Run:

```bash
pnpm --filter @dominoes/web test -- domino-chain-layout.test.ts
```

Expected: PASS.

Commit:

```bash
git add apps/web/src/components/domino-chain-layout.ts apps/web/src/components/domino-chain-layout.test.ts
git commit -m "fix: orient pips along domino chain path"
```

### Task 2: Render Layout-Ordered Values on the Board

**Files:**
- Modify: `apps/web/src/components/game-board.tsx`
- Test: `apps/web/src/components/game-board.test.tsx`

**Interfaces:**
- Consumes: `PositionedTile.visualTile` from Task 1.
- Produces: board DOM whose pip grids represent the normalized, visually ordered chain values.

- [ ] **Step 1: Write a failing component test**

Render a placed tile whose canonical order differs from its normalized order:

```ts
const reversedView = {
  ...view,
  chain: [{
    tile: { id: "2-5", left: 2, right: 5 },
    left: 5,
    right: 2,
    moveNumber: 0
  }]
} satisfies PlayerView;

render(<GameBoard view={reversedView} onCommand={vi.fn()} />);

const origin = document.querySelector('[data-move-number="0"]')!;
expect(origin.querySelectorAll(".pip-grid")[0]?.querySelectorAll(".pip")).toHaveLength(5);
expect(origin.querySelectorAll(".pip-grid")[1]?.querySelectorAll(".pip")).toHaveLength(2);
```

- [ ] **Step 2: Run the component test and verify RED**

Run:

```bash
pnpm --filter @dominoes/web test -- game-board.test.tsx
```

Expected: FAIL because the board still renders canonical `2 | 5`.

- [ ] **Step 3: Render the visual tile**

Change the chain renderer from:

```tsx
<DominoTile tile={placed.tile.tile} compact orientation={placed.orientation} />
```

to:

```tsx
<DominoTile tile={placed.visualTile} compact orientation={placed.orientation} />
```

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
pnpm --filter @dominoes/web test -- game-board.test.tsx
pnpm check
pnpm test:e2e
```

Expected: focused test PASS, repository check PASS, and all desktop/mobile
Playwright scenarios PASS.

- [ ] **Step 5: Capture Chrome evidence and commit**

Run the game in real Chrome, play enough tiles to include reversed and
vertical segments, and save a screenshot under `artifacts/`.

Commit only task files and the new screenshot:

```bash
git add apps/web/src/components/game-board.tsx apps/web/src/components/game-board.test.tsx artifacts/domino-chain-orientation-chrome.png
git commit -m "test: verify oriented domino chain in Chrome"
```
