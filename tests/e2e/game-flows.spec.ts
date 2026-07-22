import { expect, test, type Page, type Response } from "@playwright/test";

const AI_GAME_SEED = 205;
const ACTION_RANDOM_SEED = 0x5eed1234;

interface BrowserDiagnostics {
  readonly errors: string[];
  assertClean(): void;
}

interface CommandBody {
  readonly snapshot: {
    readonly seat: number;
    readonly currentSeat: number;
    readonly status: "ACTIVE" | "FINISHED";
    readonly version: number;
  };
  readonly events: Array<{ readonly type: string; readonly seat?: number }>;
}

function captureDiagnostics(page: Page): BrowserDiagnostics {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    const expectedNextNavigationAbort = request.method() === "GET" &&
      request.url().includes("_rsc=") && failure === "net::ERR_ABORTED";
    if (!expectedNextNavigationAbort) {
      errors.push(`requestfailed: ${request.method()} ${request.url()} ${failure}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      errors.push(`http ${response.status()}: ${response.request().method()} ${response.url()}`);
    }
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
  const actionChoice = random();
  const draw = page.getByRole("button", { name: "Draw a tile" });
  if (await draw.isVisible()) return waitForCommand(page, () => draw.click());

  const hand = page.getByRole("region", { name: "Your hand" });
  const playableTiles = hand.getByRole("button", { name: /^Tile / });
  const tileCount = await playableTiles.count();
  expect(tileCount).toBeGreaterThan(0);
  const tile = playableTiles.nth(Math.floor(actionChoice * tileCount));
  return waitForCommand(page, async () => {
    await tile.click();
    const sidePicker = page.getByRole("group", { name: "Choose board side" });
    if (await sidePicker.isVisible()) {
      const sideButtons = sidePicker.getByRole("button", { name: /^Play at (beginning|end)$/ });
      const sideCount = await sideButtons.count();
      expect(sideCount).toBeGreaterThan(1);
      await sideButtons.nth(Math.floor(random() * sideCount)).click();
    }
  });
}

test("opens the home page without browser or server errors", async ({ page }) => {
  const diagnostics = captureDiagnostics(page);

  await page.goto("/en");

  await expect(page.getByRole("button", { name: /Play the computer/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Invite a friend/ })).toBeVisible();
  diagnostics.assertClean();
});

test("starts an AI match with the normal seed and restores it after refresh", async ({ page }) => {
  const diagnostics = captureDiagnostics(page);
  await page.goto("/en");

  await page.getByRole("button", { name: /Play the computer/ }).click();

  await expect(page).toHaveURL(/\/en\/game\/[0-9a-f-]+$/, { timeout: 20_000 });
  await expect(page.getByRole("region", { name: "Your hand" })).toBeVisible();
  const matchUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(matchUrl);
  await expect(page.getByRole("region", { name: "Your hand" })).toBeVisible();
  diagnostics.assertClean();
});

test("plays deterministic legal actions, passes, and observes the AI response", async ({ page }) => {
  await forceAiSeed(page, AI_GAME_SEED);
  const diagnostics = captureDiagnostics(page);
  const random = deterministicRandom(ACTION_RANDOM_SEED);
  await page.goto("/en");
  await page.getByRole("button", { name: /Play the computer/ }).click();
  await expect(page).toHaveURL(/\/en\/game\/[0-9a-f-]+$/, { timeout: 20_000 });
  await expect(page.getByRole("region", { name: "Your hand" })).toBeVisible();

  let humanCommandsBeforePass = 0;
  let aiActed = false;
  let passed = false;
  for (let step = 0; step < 12; step += 1) {
    const pass = page.getByRole("button", { name: "Pass", exact: true });
    if (await pass.isVisible()) {
      const body = await waitForCommand(page, () => pass.click());
      expect(body.events).toContainEqual({ type: "PLAYER_PASSED", seat: 0 });
      expect(body.events.some((event) => event.seat === 1)).toBe(true);
      expect(body.snapshot.status === "FINISHED" || body.snapshot.currentSeat === body.snapshot.seat).toBe(true);
      passed = true;
      break;
    }

    const body = await performDeterministicAction(page, random);
    humanCommandsBeforePass += 1;
    aiActed ||= body.events.some((event) => event.seat === 1);
    expect(body.snapshot.status === "FINISHED" || body.snapshot.currentSeat === body.snapshot.seat).toBe(true);
  }

  expect(humanCommandsBeforePass).toBeGreaterThanOrEqual(3);
  expect(aiActed).toBe(true);
  expect(passed).toBe(true);
  await expect(page.getByRole("region", { name: "Your hand" })).toBeVisible();
  const origin = page.locator('[data-move-number="0"]');
  await expect(origin).toHaveAttribute("data-origin", "true");
  await expect(origin.locator('[data-orientation="horizontal"]')).toBeVisible();
  expect(await page.locator(".chain-tile").count()).toBeGreaterThan(1);
  const boardBounds = await page.locator(".chain-scroll").evaluate((element) => ({
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right,
    viewportWidth: document.documentElement.clientWidth
  }));
  expect(boardBounds.left).toBeGreaterThanOrEqual(0);
  expect(boardBounds.right).toBeLessThanOrEqual(boardBounds.viewportWidth);
  diagnostics.assertClean();
});

test("joins a private match from a second browser context", async ({ page, browser }) => {
  await page.goto("/en");
  await page.getByRole("button", { name: /Invite a friend/ }).click();
  const inviteUrl = await page.getByLabel("Invitation link").inputValue();

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  try {
    await guest.goto(inviteUrl);
    await guest.getByLabel("Guest name").fill("Guest Player");
    await guest.getByRole("button", { name: "Take your seat" }).click();
    await expect(guest.getByRole("region", { name: "Your hand" })).toBeVisible();
    await page.getByRole("link", { name: "Go to your table" }).click();
    await expect(page.getByRole("region", { name: "Your hand" })).toBeVisible();
  } finally {
    await guestContext.close();
  }
});
