import { expect, test, type Page } from "@playwright/test";

const imagePayload = {
  name: "chart.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0ioAAAAASUVORK5CYII=",
    "base64"
  )
};

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("jiawei@example.com");
  await page.getByLabel("Password").fill("demo12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test("trade create, attachment protection, and trade delete work end to end", async ({ page }) => {
  await login(page);
  await page.goto("/trades/new");

  await page.getByLabel("Symbol").fill("MSFT");
  await page.getByLabel("Instrument label").fill("Microsoft Corp");
  await page.getByLabel(/Trade type/).fill("Reversal");
  await page.getByLabel(/Setup type/).fill("Support reclaim");
  await page.getByLabel("Planned risk").fill("150");
  await page.getByLabel("Thesis").fill(
    "Reclaimed intraday support after a weak open and held through the midday base."
  );
  await page
    .getByLabel("Reason for entry")
    .fill("Support reclaimed and buyers stepped back in with cleaner structure.");
  await page
    .getByLabel("Pre-trade plan")
    .fill("Buy only if support reclaimed and risk stayed below the opening flush.");
  await page
    .getByLabel("Post-trade review")
    .fill("Execution stayed patient and the trim matched the plan.");
  await page.getByLabel("Notes").fill("E2E trade for auth and media verification.");
  await page.getByLabel("Status").selectOption("closed");
  await page.getByLabel("Reason for exit").fill("Took profit into resistance after the push stalled.");

  const fillQuantityInputs = page.locator('input[placeholder="Qty"]');
  const fillPriceInputs = page.locator('input[placeholder="Price"]');
  await fillQuantityInputs.nth(0).fill("2");
  await fillPriceInputs.nth(0).fill("100");
  await page.getByRole("button", { name: "Add exit" }).click();
  await fillQuantityInputs.nth(1).fill("2");
  await fillPriceInputs.nth(1).fill("105");

  await page.getByPlaceholder("What does this image show?").fill("Protected upload verification");
  await page.locator('input[type="file"]').setInputFiles(imagePayload);
  await expect(page.getByRole("button", { name: "Create trade" })).toBeDisabled();
  await expect(page.getByText("Uploaded: chart.png")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create trade" })).toBeEnabled();
  await page.getByRole("button", { name: "Create trade" }).click();

  await expect(page).toHaveURL(/\/trades\/trade_/);
  const tradeUrl = page.url();
  await expect(page.getByRole("img", { name: "Protected upload verification" })).toBeVisible();

  const imageSrc = await page.getByRole("img", { name: "Protected upload verification" }).getAttribute("src");
  expect(imageSrc).toBeTruthy();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);

  const unauthorizedStatus = await page.evaluate(async (src) => {
    const response = await fetch(src!, { cache: "no-store", credentials: "include" });
    return response.status;
  }, imageSrc);
  expect(unauthorizedStatus).toBe(401);

  await login(page);
  await page.goto(tradeUrl);
  await expect(page.getByRole("button", { name: "Delete trade" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete trade" }).click();
  await expect(page).toHaveURL(/\/trades$/);

  const deletedStatus = await page.evaluate(async (src) => {
    const response = await fetch(src!, { cache: "no-store", credentials: "include" });
    return response.status;
  }, imageSrc);
  expect(deletedStatus).toBe(404);
});
