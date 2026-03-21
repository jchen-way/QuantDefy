import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("jiawei@example.com");
  await page.getByLabel("Password").fill("demo12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test("settings token editors persist and overview month arrows navigate without changing month-to-date labeling", async ({
  page
}) => {
  await login(page);

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  await page.getByPlaceholder("Add a trade type").fill("Gap and go");
  await page.keyboard.press("Enter");
  await page.getByPlaceholder("Add a setup type").fill("VWAP reclaim");
  await page.keyboard.press("Enter");
  await page.getByLabel("Insight mode").selectOption("semantic");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Gap and go")).toBeVisible();
  await expect(page.getByText("VWAP reclaim")).toBeVisible();
  await expect(page.getByLabel("Insight mode")).toHaveValue("semantic");

  await page.goto("/app");
  await expect(page.getByText("March 2026 realized P/L")).toBeVisible();
  await expect(page.locator("text=March 2026").nth(0)).toBeVisible();

  await page.getByLabel("Previous month").click();
  await expect(page).toHaveURL(/month=2026-02/);
  await expect(page.locator("text=February 2026").nth(0)).toBeVisible();
  await expect(page.getByText("March 2026 realized P/L")).toBeVisible();

  await page.getByLabel("Next month").click();
  await expect(page).toHaveURL(/month=2026-03/);
  await expect(page.locator("text=March 2026").nth(0)).toBeVisible();
});
