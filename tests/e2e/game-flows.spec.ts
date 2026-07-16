import { expect, test } from "@playwright/test";

test("starts an AI match and restores it after refresh", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("button", { name: /Play the computer/ }).click();
  await expect(page).toHaveURL(/\/en\/game\/[0-9a-f-]+$/, { timeout: 20_000 });
  await expect(page.getByRole("region", { name: "Your hand" })).toBeVisible();
  const matchUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(matchUrl);
  await expect(page.getByRole("region", { name: "Your hand" })).toBeVisible();
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
