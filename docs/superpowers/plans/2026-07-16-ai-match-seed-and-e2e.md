# AI Match Seed Fix and E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent epoch-millisecond seeds from crashing persisted match creation and add deterministic browser coverage for AI gameplay, automatic AI turns, and legal pass behavior.

**Architecture:** Normalize every match seed once at the `MatchService` boundary so the game engine and every repository observe the same PostgreSQL-safe value. Extend the existing Playwright game-flow suite with fixed request seeding, deterministic visible-action selection, response-event assertions, and browser/network diagnostics.

**Tech Stack:** TypeScript 5.9, NestJS, Prisma/PostgreSQL, Next.js 16, Vitest, Playwright.

## Global Constraints

- Keep the Prisma `Match.seed` column as PostgreSQL `INTEGER`; no migration is added.
- Normalized seeds are deterministic integers in `0..2_147_483_646`.
- Pass is exercised only when the UI exposes it as a legal action.
- The gameplay E2E uses match seed `18339` and action PRNG seed `0x5eed1234`.
- Browser tests fail on page errors, console errors, request failures, or HTTP responses with status `>= 500`.
- Production UI must not expose test-only seed controls.

---

### Task 1: Normalize match seeds before state creation

**Files:**
- Modify: `apps/api/src/matches/match.service.test.ts`
- Modify: `apps/api/src/matches/match.service.ts`

**Interfaces:**
- Consumes: `MatchService.createAiMatch(owner, seed)` and `MatchService.createPrivateMatch(owner, seed)`.
- Produces: persisted `StoredMatch.state.seed` values in `0..2_147_483_646` for every numeric input.

- [ ] **Step 1: Write the failing oversized-seed regression test**

Add this test to `MatchService` tests:

```ts
test("normalizes oversized seeds before creating AI and private matches", async () => {
  const repository = new InMemoryMatchRepository();
  const service = new MatchService(repository);
  const oversizedSeed = 1_784_227_713_132;

  const first = await service.createAiMatch(owner, oversizedSeed);
  const second = await service.createAiMatch(owner, oversizedSeed);
  const privateMatch = await service.createPrivateMatch(owner, -oversizedSeed);
  const firstStored = await repository.get(first.matchId);
  const secondStored = await repository.get(second.matchId);
  const privateStored = await repository.get(privateMatch.matchId);

  expect(firstStored!.state.seed).toBeGreaterThanOrEqual(0);
  expect(firstStored!.state.seed).toBeLessThan(2_147_483_647);
  expect(secondStored!.state.seed).toBe(firstStored!.state.seed);
  expect(privateStored!.state.seed).toBeGreaterThanOrEqual(0);
  expect(privateStored!.state.seed).toBeLessThan(2_147_483_647);
});
```

- [ ] **Step 2: Run the regression test and verify RED**

Run:

```powershell
pnpm --filter @dominoes/api test -- src/matches/match.service.test.ts
```

Expected: FAIL because `state.seed` is still `1_784_227_713_132` or its negative equivalent.

- [ ] **Step 3: Implement one normalization boundary**

Add the private helper in `match.service.ts`:

```ts
const POSTGRES_INT4_SEED_MODULUS = 2_147_483_647;

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) return 0;
  const integer = Math.trunc(seed);
  return ((integer % POSTGRES_INT4_SEED_MODULUS) + POSTGRES_INT4_SEED_MODULUS) % POSTGRES_INT4_SEED_MODULUS;
}
```

In both create methods, calculate `const normalizedSeed = normalizeSeed(seed)` and pass it to `createMatch`:

```ts
state: createMatch({ matchId, seed: normalizedSeed }),
```

- [ ] **Step 4: Verify GREEN and API regression coverage**

Run:

```powershell
pnpm --filter @dominoes/api test -- src/matches/match.service.test.ts
pnpm --filter @dominoes/api typecheck
```

Expected: all MatchService tests pass and typecheck exits `0`.

- [ ] **Step 5: Commit the seed fix**

```powershell
git add apps/api/src/matches/match.service.ts apps/api/src/matches/match.service.test.ts
git commit -m "fix: normalize persisted match seeds"
```

### Task 2: Add deterministic Playwright gameplay helpers and coverage

**Files:**
- Modify: `tests/e2e/game-flows.spec.ts`

**Interfaces:**
- Consumes: visible English labels from `GameBoard`, JSON responses from `POST /v1/matches/:matchId/commands`, and the existing Playwright `page` fixture.
- Produces: stable E2E tests for home-page health, AI-match launch/restore, deterministic legal actions, AI settlement, and human pass.

- [ ] **Step 1: Add diagnostics and fixed-seed helpers**

Add imports and helpers with these interfaces:

```ts
import { expect, test, type Page, type Response } from "@playwright/test";

interface BrowserDiagnostics {
  readonly errors: string[];
  assertClean(): void;
}

function captureDiagnostics(page: Page): BrowserDiagnostics {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => errors.push(`requestfailed: ${request.method()} ${request.url()}`));
  page.on("response", (response) => {
    if (response.status() >= 500) errors.push(`http ${response.status()}: ${response.request().method()} ${response.url()}`);
  });
  return {
    errors,
    assertClean: () => expect(errors, errors.join("\n")).toEqual([])
  };
}

async function forceAiSeed(page: Page, seed: number): Promise<void> {
  await page.route("**/v1/matches/ai", async (route) => {
    const request = route.request();
    const body = request.postDataJSON() as Record<string, unknown>;
    await route.continue({
      headers: { ...request.headers(), "content-type": "application/json" },
      postData: JSON.stringify({ ...body, seed })
    });
  });
}

function deterministicRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}
```

- [ ] **Step 2: Add a home-page health test and strengthen launch/refresh**

Create a test that starts diagnostics before `page.goto("/en")`, asserts both lobby buttons are visible, and then calls `diagnostics.assertClean()`.

Update the existing AI launch test to call `await forceAiSeed(page, 18_339)`, start diagnostics, launch through `Play the computer`, reload the exact game URL, assert `Your hand` is visible after reload, and assert diagnostics are clean.

- [ ] **Step 3: Add the deterministic legal-action helper**

Implement:

```ts
interface CommandBody {
  readonly snapshot: {
    readonly seat: number;
    readonly currentSeat: number;
    readonly status: "ACTIVE" | "FINISHED";
    readonly version: number;
  };
  readonly events: Array<{ readonly type: string; readonly seat?: number }>;
}

async function waitForCommand(page: Page, action: () => Promise<void>): Promise<CommandBody> {
  const responsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" && response.url().includes("/commands")
  );
  await action();
  const response: Response = await responsePromise;
  expect(response.ok()).toBe(true);
  return response.json() as Promise<CommandBody>;
}

async function performDeterministicAction(page: Page, random: () => number): Promise<CommandBody> {
  const draw = page.getByRole("button", { name: "Draw a tile" });
  const pass = page.getByRole("button", { name: "Pass", exact: true });
  if (await draw.isVisible()) return waitForCommand(page, () => draw.click());
  if (await pass.isVisible()) return waitForCommand(page, () => pass.click());

  const hand = page.getByRole("region", { name: "Your hand" });
  const playableTiles = hand.getByRole("button", { name: /^Tile / });
  const tileCount = await playableTiles.count();
  expect(tileCount).toBeGreaterThan(0);
  const tile = playableTiles.nth(Math.floor(random() * tileCount));
  return waitForCommand(page, async () => {
    await tile.click();
    const sidePicker = page.getByRole("group", { name: "Choose board side" });
    if (await sidePicker.isVisible()) {
      const sideButtons = sidePicker.getByRole("button", { name: /^Play (left|right)$/ });
      const sideCount = await sideButtons.count();
      await sideButtons.nth(Math.floor(random() * sideCount)).click();
    }
  });
}
```

- [ ] **Step 4: Add the fixed-seed AI/pass scenario**

Use seed `18_339` and PRNG seed `0x5eed1234`. Start the match through the lobby, then execute at most 12 human commands. For every command response:

```ts
expect(body.snapshot.status === "FINISHED" || body.snapshot.currentSeat === body.snapshot.seat).toBe(true);
aiActed ||= body.events.some((event) => event.seat === 1);
```

When the visible `Pass` button appears, execute it with `waitForCommand`, assert the response contains `{ type: "PLAYER_PASSED", seat: 0 }`, assert the same response contains an event with `seat === 1`, and stop. Finally assert at least three earlier human commands ran, `aiActed` is true, pass was observed, `Your hand` or the match result remains visible, and diagnostics are clean.

- [ ] **Step 5: Run the Playwright file and verify GREEN**

Run:

```powershell
pnpm test:e2e --project=desktop-chromium tests/e2e/game-flows.spec.ts
```

Expected: home health, AI launch/restore, deterministic AI/pass, and private-match tests pass with no collected diagnostics.

- [ ] **Step 6: Commit E2E coverage**

```powershell
git add tests/e2e/game-flows.spec.ts
git commit -m "test: cover deterministic AI gameplay"
```

### Task 3: Full verification, real Chrome, and publication

**Files:**
- Verify: `apps/api/src/matches/match.service.ts`
- Verify: `apps/api/src/matches/match.service.test.ts`
- Verify: `tests/e2e/game-flows.spec.ts`

**Interfaces:**
- Consumes: local PostgreSQL service, API on port `4000`, web on port `3000`, and the Chrome extension browser binding.
- Produces: verified GitHub branch with the fix, automated tests, and an open draft PR when GitHub tooling is available.

- [ ] **Step 1: Run complete automated verification without a concurrent dev build**

Stop only the existing web dev process before running the production build. Then run:

```powershell
pnpm check
pnpm test:e2e --project=desktop-chromium tests/e2e/game-flows.spec.ts
```

Expected: lint, typecheck, unit/integration tests, production build, and desktop Playwright tests all pass.

- [ ] **Step 2: Restart the local app and verify persisted creation**

Start API and web as documented, then create an AI match through the normal UI. Confirm `GET /v1/health` returns `{ "status": "ok" }`, navigation reaches `/en/game/<uuid>`, and the board is interactive.

- [ ] **Step 3: Verify in real Chrome**

Claim the user's `localhost:3000` Chrome tab, reload after the new build, start an AI match, perform at least three visible legal actions, and inspect Chrome console logs. Expected: no `Internal server error`, page error, console error, request failure, or HTTP 5xx response.

- [ ] **Step 4: Check repository scope**

```powershell
git status --short --branch
git diff --check
git log --oneline --decorate -5
```

Expected: only intentional commits on `agent/fix-ai-seed-e2e`; generated `apps/web/next-env.d.ts` is restored before publication.

- [ ] **Step 5: Push and open a draft PR**

After `gh` is installed/authenticated and `origin` is configured:

```powershell
git push -u origin agent/fix-ai-seed-e2e
gh pr create --draft --fill --head agent/fix-ai-seed-e2e
```

The PR body must summarize the INT4 overflow root cause, service-boundary normalization, deterministic Playwright coverage, automated checks, and real-Chrome verification.
