import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const baselinePath = path.resolve(__dirname, "../performance-baseline.json");

interface PerformanceData {
  timeToFirstCardMs: number;
  timeToFilterResponseMs: number;
  timeToLoad50InvoicesMs: number;
  timeToLoad100InvoicesMs: number;
}

test.describe("Marketplace Performance Load Testing", () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss onboarding tour and changelog
    await page.addInitScript(() => {
      localStorage.setItem("kora-tour-done", "true");
      localStorage.setItem("kora-changelog-seen-version", "0.1.0");
    });
  });

  test("measures marketplace infinite scroll and filtering performance", async ({ page }, testInfo) => {
    // Initial load uses default page size (first page only)
    const startTime = Date.now();
    await page.goto("/marketplace");

    const firstCard = page.locator("a[href^='/marketplace/']").first();
    await firstCard.waitFor({ state: "visible", timeout: 20_000 });
    const timeToFirstCardMs = Date.now() - startTime;

    // Scroll the infinite sentinel into view repeatedly until 50 cards load
    const cardLocator = page.locator("a[href^='/marketplace/']");
    const scrollUntilCount = async (target: number, timeoutMs: number) => {
      const deadline = Date.now() + timeoutMs;
      while ((await cardLocator.count()) < target && Date.now() < deadline) {
        await page.locator("#infinite-sentinel").scrollIntoViewIfNeeded().catch(() => undefined);
        await page.mouse.wheel(0, 2400);
        await page.waitForTimeout(250);
      }
    };

    await scrollUntilCount(50, 25_000);
    await expect(cardLocator.nth(49)).toBeVisible({ timeout: 20_000 });
    const timeToLoad50InvoicesMs = Date.now() - startTime;

    await scrollUntilCount(100, 30_000);
    await expect(cardLocator.nth(99)).toBeVisible({ timeout: 20_000 });
    const timeToLoad100InvoicesMs = Date.now() - startTime;

    // Filter response — search for a generated SME
    const searchInput = page.getByPlaceholder(/Search by debtor, invoice number, or jurisdiction/i);
    await searchInput.waitFor({ state: "visible" });

    const filterStartTime = Date.now();
    await searchInput.fill("SME 50");
    await page.locator("a[href^='/marketplace/']").nth(1).waitFor({ state: "detached", timeout: 10_000 });
    await page.getByText("SME 50").first().waitFor({ state: "visible", timeout: 10_000 });
    const timeToFilterResponseMs = Date.now() - filterStartTime;

    const pageMetrics = await page.metrics();
    const timing = await page.evaluate(() => {
      const t = window.performance.timing;
      return {
        navigationStart: t.navigationStart,
        domInteractive: t.domInteractive - t.navigationStart,
        domComplete: t.domComplete - t.navigationStart,
        loadEventEnd: t.loadEventEnd - t.navigationStart,
      };
    });

    console.log("=== Playwright Page Metrics ===");
    console.log(JSON.stringify(pageMetrics, null, 2));
    console.log("=== Performance Timing ===");
    console.log(JSON.stringify(timing, null, 2));

    const currentData: PerformanceData = {
      timeToFirstCardMs,
      timeToFilterResponseMs,
      timeToLoad50InvoicesMs,
      timeToLoad100InvoicesMs,
    };

    console.log("=== Measured Performance Results ===");
    console.log(JSON.stringify(currentData, null, 2));

    if (fs.existsSync(baselinePath)) {
      const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf-8")) as Partial<PerformanceData>;
      console.log("=== Baseline Performance ===");
      console.log(JSON.stringify(baseline, null, 2));

      const thresholdPercentage = 1.2;
      const warnings: string[] = [];

      (Object.keys(currentData) as Array<keyof PerformanceData>).forEach((key) => {
        const current = currentData[key];
        const base = baseline[key];
        if (typeof base !== "number") return;
        const limit = base * thresholdPercentage;

        if (current > limit) {
          const warningMsg = `[PERF WARNING] ${key} exceeded baseline by > 20%: Current ${current}ms, Baseline ${base}ms (Limit ${limit.toFixed(0)}ms)`;
          warnings.push(warningMsg);
          console.warn(warningMsg);
          testInfo.annotations.push({ type: "performance-warning", description: warningMsg });
        }
      });

      if (warnings.length > 0) {
        console.warn("\n⚠️  Performance degradation detected, but test is passing as per configuration.\n");
      } else {
        console.log("\n✅  All performance measurements are within acceptable baseline limits.\n");
      }
    }

    if (process.env.UPDATE_PERF_BASELINE === "true") {
      fs.writeFileSync(baselinePath, JSON.stringify(currentData, null, 2));
      console.log(`\n💾  Performance baseline updated successfully at ${baselinePath}\n`);
    }
  });
});
