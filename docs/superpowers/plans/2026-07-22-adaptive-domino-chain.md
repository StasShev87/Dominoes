# Adaptive Domino Chain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render authentic domino tiles in a responsive two-ended serpentine chain centered on the game board.

**Architecture:** A pure `domino-chain-layout` module computes deterministic positions and orientations from ordered chain tiles and available width. `GameBoard` measures its board with `ResizeObserver` and renders the returned absolute layout, while `DominoTile` and CSS handle authentic pip geometry and physical appearance.

**Tech Stack:** React 19, TypeScript 5.9, Next.js, CSS, Vitest, Testing Library, Playwright

## Global Constraints

- The first tile remains horizontally centered.
- The beginning grows left and turns upward; the end grows right and turns downward.
- Non-doubles follow travel direction; doubles are perpendicular.
- The layout must reflow from actual board width, including mobile sizes.
- The board expands vertically instead of clipping an oversized chain.
- Game rules, command payloads, scoring, and networking remain unchanged; persisted placed tiles gain `moveNumber`.
- Each placed tile has a zero-based `moveNumber` that resets every round; legacy stored chains are normalized when read.

---

### Task 1: Persist round move numbers

**Files:**
- Modify: `packages/game-engine/src/index.ts`
- Modify: `packages/game-engine/src/index.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/index.test.ts`
- Modify: `apps/api/src/matches/prisma-match.repository.ts`
- Modify: `apps/api/src/matches/prisma-match.repository.test.ts`

**Interfaces:**
- Produces: required `PlacedTile.moveNumber: number` in engine state and public views.
- Preserves: existing command payloads and placement rules.

- [ ] **Step 1: Write failing engine and contract tests**

Assert the opening tile receives `moveNumber: 0`, later placements at either side receive increasing numbers, a new round restarts at zero, and the public schema accepts and returns the field.

- [ ] **Step 2: Verify RED**

Run the focused game-engine and contracts tests and confirm failures are caused by the missing field.

- [ ] **Step 3: Implement move numbering**

Assign `Math.max(-1, ...chain.map(tile => tile.moveNumber)) + 1` when a play command succeeds, copy the field in projections, and add a nonnegative integer to the contract schema and types.

- [ ] **Step 4: Add and implement legacy normalization**

Write a repository test for stored placed tiles lacking the field, then normalize them to stable zero-based values during hydration before parsing or exposing state.

- [ ] **Step 5: Verify and commit**

Run focused tests, then commit as `feat: track round move numbers`.

### Task 2: Authentic tile faces

**Files:**
- Modify: `apps/web/src/components/domino-tile.tsx`
- Modify: `apps/web/src/components/domino-tile.test.tsx`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- Consumes: existing `DominoTileProps` and tile values zero through six.
- Produces: `orientation?: "horizontal" | "vertical"` and pip elements carrying stable `data-position` values.

- [ ] **Step 1: Write failing component tests**

Add tests that render every value and assert the conventional position sets: `0=[]`, `1=[middle-center]`, `2=[top-left,bottom-right]`, `3=[top-left,middle-center,bottom-right]`, `4=[top-left,top-right,bottom-left,bottom-right]`, `5` adds `middle-center`, and `6` adds `middle-left,middle-right`. Add an assertion that `orientation="horizontal"` exposes `data-orientation="horizontal"`.

- [ ] **Step 2: Verify the tests fail**

Run: `pnpm --filter @dominoes/web test -- domino-tile.test.tsx`

Expected: FAIL because pip positions and orientation metadata do not exist.

- [ ] **Step 3: Implement the tile API and grid**

Replace count-based flex pips with a `PIP_POSITIONS` lookup and render each pip with its named CSS grid area. Add the optional orientation class and data attribute while retaining the existing accessible label and button behavior.

- [ ] **Step 4: Style a physical domino tile**

Use a 3 by 3 CSS grid for each half, near-black inset pips, an ivory gradient, thin warm edge, central divider, and a compact downward shadow. Define horizontal and vertical dimensions without changing hand interaction semantics.

- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter @dominoes/web test -- domino-tile.test.tsx`

Expected: PASS.

Commit: `feat: render authentic domino faces`

### Task 3: Pure two-ended snake layout

**Files:**
- Create: `apps/web/src/components/domino-chain-layout.ts`
- Create: `apps/web/src/components/domino-chain-layout.test.ts`

**Interfaces:**
- Consumes: `readonly PlacedTile[]`, container width in pixels, and fixed tile geometry constants.
- Produces: `layoutDominoChain(chain, width): { tiles: PositionedTile[]; height: number }`, where each positioned tile has `x`, `y`, and `orientation`.

- [ ] **Step 1: Write failing center and branch tests**

Test that index zero is centered, earlier chain indexes extend left/up, later indexes extend right/down, and a narrow width creates turns without positions escaping horizontal bounds.

- [ ] **Step 2: Verify the tests fail**

Run: `pnpm --filter @dominoes/web test -- domino-chain-layout.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement minimal branch path generation**

Split around the stable origin tile, generate mirrored paths from the center, alternate horizontal direction after each boundary turn, and translate all vertical coordinates so the complete bounds begin at the board padding.

- [ ] **Step 4: Add failing double-orientation tests**

Assert ordinary tiles are parallel to their path segment and tiles with equal ends are perpendicular for both horizontal and vertical segments.

- [ ] **Step 5: Implement orientation and bounds**

Derive orientation from travel direction plus double status. Return a height equal to the larger of the minimum board height and padded chain bounds.

- [ ] **Step 6: Verify and commit**

Run: `pnpm --filter @dominoes/web test -- domino-chain-layout.test.ts`

Expected: PASS.

Commit: `feat: calculate responsive domino snake layout`

### Task 4: Responsive board rendering and copy

**Files:**
- Modify: `apps/web/src/components/game-board.tsx`
- Modify: `apps/web/src/components/game-board.test.tsx`
- Modify: `apps/web/src/lib/i18n.ts`
- Modify: `apps/web/src/lib/i18n.test.ts`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- Consumes: `layoutDominoChain`, `DominoTile.orientation`, and the existing `PlayerView.chain`.
- Produces: a measured `.chain-layout` surface with absolutely positioned tiles and localized beginning/end actions.

- [ ] **Step 1: Write failing rendering and localization tests**

Mock `ResizeObserver`, provide a multi-tile chain, and assert the origin/branch layout metadata is rendered. Assert Russian messages equal `Положить в начало` and `Положить в конец`, and English messages equal `Play at beginning` and `Play at end`.

- [ ] **Step 2: Verify the tests fail**

Run: `pnpm --filter @dominoes/web test -- game-board.test.tsx i18n.test.ts`

Expected: FAIL on absent layout metadata and old copy.

- [ ] **Step 3: Integrate measurement and positioned rendering**

Observe the board container, store its current content width, compute layout with `useMemo`, and render each tile at its calculated transform and orientation. Disconnect the observer on unmount and preserve the empty-board state.

- [ ] **Step 4: Update board CSS and localized copy**

Replace the horizontal chain scroller with a centered relative layout surface whose computed height can exceed its minimum. Keep overflow visible vertically and ensure small-screen CSS reduces safe padding without forcing vertical tiles.

- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter @dominoes/web test -- game-board.test.tsx i18n.test.ts`

Expected: PASS.

Commit: `feat: render responsive two-ended domino chain`

### Task 5: Regression and browser verification

**Files:**
- Modify: `tests/e2e/game-flows.spec.ts` only if stable semantic assertions are missing.
- Create: a screenshot artifact in Playwright output or the workspace.

**Interfaces:**
- Consumes: completed UI and existing deterministic AI match flow.
- Produces: passing repository checks and a Chrome screenshot of active play.

- [ ] **Step 1: Add a failing E2E assertion if needed**

Assert the Russian side picker uses beginning/end wording and that a played chain exposes a centered origin plus positioned tiles. Avoid pixel-perfect assertions.

- [ ] **Step 2: Run the focused E2E test**

Run: `pnpm test:e2e -- --project=chromium tests/e2e/game-flows.spec.ts`

Expected before any necessary selector adjustment: the new assertion fails; after the UI work it passes.

- [ ] **Step 3: Run full verification**

Run: `pnpm check`

Expected: lint, typecheck, unit tests, and build all pass.

Run: `pnpm test:e2e`

Expected: all Playwright E2E tests pass.

- [ ] **Step 4: Inspect desktop and narrow layouts in real Chrome**

Open the running app in the user's Chrome, play enough turns to show both the realistic tiles and chain, resize to a narrow viewport to confirm reflow, return to desktop size, and save a screenshot of active play.

- [ ] **Step 5: Commit any E2E change**

Commit: `test: cover adaptive domino chain`
