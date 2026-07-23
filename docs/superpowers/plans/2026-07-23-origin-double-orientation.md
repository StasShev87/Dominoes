# Opening Double Orientation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a move-zero double vertically while keeping a move-zero non-double horizontal and centered.

**Architecture:** Keep all board orientation decisions inside `layoutDominoChain`. Replace the opening tile's hard-coded horizontal orientation with the existing `tileOrientation(tile, "horizontal")` rule already used by later tiles.

**Tech Stack:** TypeScript, Vitest, Playwright

## Global Constraints

- A non-double opening tile remains horizontal.
- A double opening tile is vertical, perpendicular to the future horizontal chain.
- The opening tile remains centered.
- No game-engine, API, persistence, contract, CSS, or component changes.

---

### Task 1: Apply the Existing Double Rule to the Opening Tile

**Files:**
- Modify: `apps/web/src/components/domino-chain-layout.ts`
- Test: `apps/web/src/components/domino-chain-layout.test.ts`

**Interfaces:**
- Consumes: `layoutDominoChain(chain: readonly PlacedTile[], containerWidth: number)`.
- Produces: the existing `DominoChainLayout`, with the opening tile orientation derived by `tileOrientation`.

- [ ] **Step 1: Write the failing regression test**

Add this test inside the existing `describe("layoutDominoChain", ...)` block:

```ts
test("places an opening double perpendicular to the future chain", () => {
  const layout = layoutDominoChain([placed(0, true)], 600);
  const origin = layout.tiles[0]!;

  expect(origin.orientation).toBe("vertical");
  expect(origin.x + origin.width / 2).toBe(300);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm --filter @dominoes/web exec vitest run src/components/domino-chain-layout.test.ts
```

Expected: FAIL because the opening double orientation is `"horizontal"` instead of `"vertical"`.

- [ ] **Step 3: Implement the minimal fix**

In `layoutDominoChain`, replace:

```ts
const origin = rawTile(chain[originIndex]!, width / 2, 0, "horizontal", 1);
```

with:

```ts
const originTile = chain[originIndex]!;
const origin = rawTile(originTile, width / 2, 0, tileOrientation(originTile, "horizontal"), 1);
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
pnpm --filter @dominoes/web exec vitest run src/components/domino-chain-layout.test.ts
```

Expected: all layout tests PASS, including the existing non-double horizontal-origin assertion.

- [ ] **Step 5: Run complete verification**

Run:

```bash
pnpm check
pnpm test:e2e
```

Expected: lint, typecheck, unit tests, build, and all desktop/mobile Playwright scenarios PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/domino-chain-layout.ts apps/web/src/components/domino-chain-layout.test.ts
git commit -m "fix: rotate opening double across chain"
```
