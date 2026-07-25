/**
 * E2E — Onboarding tour
 *
 * Covers:
 *  - First visit: tour auto-starts, user completes all steps, persistence set
 *  - Skip path: user skips at step 2, tour does not reappear on next visit
 *  - Deep link: tour does not auto-start on invoice detail pages
 */

import { test, expect } from "@playwright/test";

const TOUR_STORAGE_KEY = "kora-tour-done";

function tourDialog(page: import("@playwright/test").Page) {
  return page.getByRole("dialog", { name: "Marketplace onboarding tour" });
}

test.describe("Onboarding tour", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.removeItem(key);
    }, TOUR_STORAGE_KEY);
  });

  test("auto-starts on first visit and completes all steps", async ({ page }) => {
    await page.goto("/marketplace");

    const tour = tourDialog(page);
    await expect(tour).toBeVisible({ timeout: 10_000 });
    await expect(tour.getByText("Find the right opportunity")).toBeVisible();

    await tour.getByRole("button", { name: "Next" }).click();
    await expect(tour.getByText("Review invoice details")).toBeVisible();

    await tour.getByRole("button", { name: "Next" }).click();
    await expect(tour.getByText("Fund an invoice")).toBeVisible();

    await tour.getByRole("button", { name: "Next" }).click();
    await expect(tour.getByText("Track your portfolio")).toBeVisible();

    await tour.getByRole("button", { name: "Finish" }).click();
    await expect(tour).toBeHidden();

    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), TOUR_STORAGE_KEY))
      .toBe("true");
  });

  test("skip at step 2 dismisses tour and prevents reappearance", async ({
    page,
  }) => {
    await page.goto("/marketplace");

    const tour = tourDialog(page);
    await expect(tour).toBeVisible({ timeout: 10_000 });
    await expect(tour.getByText("Find the right opportunity")).toBeVisible();

    await tour.getByRole("button", { name: "Next" }).click();
    await expect(tour.getByText("Review invoice details")).toBeVisible();

    await tour.getByRole("button", { name: "Skip tour" }).click();
    await expect(tour).toBeHidden();

    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), TOUR_STORAGE_KEY))
      .toBe("true");

    await page.reload();
    await expect(tour).toBeHidden();
  });

  test("does not auto-start on invoice detail deep links", async ({ page }) => {
    await page.goto("/marketplace/inv_001");

    const tour = tourDialog(page);
    await page.waitForTimeout(800);
    await expect(tour).toBeHidden();

    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), TOUR_STORAGE_KEY))
      .toBeNull();
  });
});
