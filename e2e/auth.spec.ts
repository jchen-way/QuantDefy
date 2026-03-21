import { expect, test } from "@playwright/test";

test("demo user can sign in, log out, and gets redirected from protected routes", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.locator('input[name="email"]').fill("jiawei@example.com");
  await page.locator('input[name="password"]').fill("demo12345");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: "Performance calendar" })).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
});
