/**
 * Automated accessibility audit — axe-playwright
 *
 * Runs axe-core against key routes and fails CI if any critical or serious
 * violations are found.  Does NOT replace manual accessibility testing or
 * expert review with assistive technologies.
 *
 * Dependency: axe-playwright@2.0.3 (pinned in package.json devDependencies)
 *
 * Known false-positive exclusions are listed per-route below with justification.
 * Add new exclusions only with a documented reason and a tracking issue.
 */

import { test, expect } from "@playwright/test";
import { injectAxe, getViolations } from "axe-playwright";

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Run axe against the current page and assert no critical/serious violations.
 * Returns the full violation list so individual tests can add extra assertions.
 */
async function auditPage(
  page: Parameters<typeof injectAxe>[0],
  options?: { disableRules?: string[] }
) {
  await injectAxe(page);

  const violations = await getViolations(page, undefined, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    },
    rules: Object.fromEntries(
      (options?.disableRules ?? []).map((id) => [id, { enabled: false }])
    ),
  });

  // Filter to critical and serious only — best-effort automated check
  const blocking = violations.filter((v) =>
    ["critical", "serious"].includes(v.impact ?? "")
  );

  if (blocking.length > 0) {
    const summary = blocking
      .map((v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node(s))`)
      .join("\n");
    expect.soft(blocking, `Axe found critical/serious violations:\n${summary}`).toHaveLength(0);
  }

  return violations;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

test.describe("Accessibility audit — landing page (/)", () => {
  test("no critical or serious axe violations", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await auditPage(page);
  });
});

test.describe("Accessibility audit — marketplace (/marketplace)", () => {
  test("no critical or serious axe violations", async ({ page }) => {
    await page.goto("/marketplace");
    await page.waitForLoadState("networkidle");

    await auditPage(page, {
      // Known false positive: Radix UI popover portals render outside the main
      // landmark at mount time; their aria-owns relationship is established
      // dynamically. Tracked in issue #240.
      disableRules: [],
    });
  });
});

test.describe("Accessibility audit — invoice detail (/marketplace/:id)", () => {
  test("no critical or serious axe violations on sample invoice", async ({ page }) => {
    // Navigate to a seeded or mock invoice; the app uses mock data in E2E mode.
    await page.goto("/marketplace/1");
    await page.waitForLoadState("networkidle");
    await auditPage(page);
  });
});

test.describe("Accessibility audit — SME dashboard (/dashboard/sme)", () => {
  test("no critical or serious axe violations", async ({ page }) => {
    await page.goto("/dashboard/sme");
    await page.waitForLoadState("networkidle");
    await auditPage(page);
  });
});

test.describe("Accessibility audit — investor dashboard (/dashboard/investor)", () => {
  test("no critical or serious axe violations", async ({ page }) => {
    await page.goto("/dashboard/investor");
    await page.waitForLoadState("networkidle");
    await auditPage(page);
  });
});
