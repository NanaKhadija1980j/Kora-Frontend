/**
 * E2E — Onboarding tour
 *
 * Covers:
 *  - Investor persona: tour auto-starts, user completes all steps, persistence set
 *  - SME persona: user switches role or selects SME persona, steps through mint path
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
    await page.addInitScript(() => {
      localStorage.removeItem("kora-tour-done");
      localStorage.removeItem("kora-settings-store");
      localStorage.setItem("kora-changelog-seen-version", "0.1.0");
      localStorage.setItem("kora:feature-flag-overrides", JSON.stringify({ "onboarding-tour": true }));
    });
  });

  test("investor tour auto-starts on first visit and completes all steps", async ({ page }) => {
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

  test("SME tour steps through invoice minting and dashboard sequence", async ({ page }) => {
    await page.goto("/marketplace");

    const tour = tourDialog(page);
    await expect(tour).toBeVisible({ timeout: 10_000 });

    // Switch to SME persona
    await tour.getByRole("button", { name: "SME" }).click();
    await expect(tour.getByText("Mint an invoice")).toBeVisible();

    await tour.getByRole("button", { name: "Next" }).click();
    await expect(tour.getByText("SME Dashboard")).toBeVisible();

    await tour.getByRole("button", { name: "Next" }).click();
    await expect(tour.getByText("Marketplace listing")).toBeVisible();

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

