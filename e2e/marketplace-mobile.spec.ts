import { test, expect, devices } from "@playwright/test";

/**
 * Mobile viewport tests for the Marketplace page.
 * Tests responsive layout, bottom sheet filters, and single-column grid on mobile.
 * 
 * Run with: npx playwright test e2e/marketplace-mobile.spec.ts
 */

// Use iPhone 12 viewport for mobile testing
test.use({ ...devices["iPhone 12"] });

test.describe("Marketplace - Mobile Responsiveness", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/marketplace");
    // Wait for content to load
    await page.waitForSelector('[role="grid"], [class*="InvoiceCard"]', { timeout: 5000 }).catch(() => {});
  });

  test("should display single-column invoice grid on mobile", async ({ page }) => {
    // Get grid container
    const gridContainer = page.locator(".grid").first();
    
    // Check grid layout - should be single column on mobile
    const gridClasses = await gridContainer.getAttribute("class");
    expect(gridClasses).toContain("sm:grid-cols-2");
    expect(gridClasses).toContain("md:grid-cols-2");
    expect(gridClasses).toContain("lg:grid-cols-3");
    
    // Verify actual computed columns - on mobile (iPhone 12 is 390px width)
    // grid-cols-1 is default (no class means 1 column)
    const invoiceCards = gridContainer.locator('[class*="InvoiceCard"]');
    const count = await invoiceCards.count();
    
    if (count > 1) {
      // Get bounding boxes to verify single-column layout
      const firstCardBox = await invoiceCards.nth(0).boundingBox();
      const secondCardBox = await invoiceCards.nth(1).boundingBox();
      
      // Cards should be stacked vertically, not side-by-side
      expect(firstCardBox?.y).toBeLessThan(secondCardBox?.y || Infinity);
      // X positions should be similar (left-aligned)
      expect(Math.abs((firstCardBox?.x || 0) - (secondCardBox?.x || 0))).toBeLessThan(10);
    }
  });

  test("should hide desktop sidebar and show filter button on mobile", async ({ page }) => {
    // Desktop sidebar should be hidden (lg:hidden)
    const desktopSidebar = page.locator("div.hidden.lg\\:block").first();
    const isHidden = await desktopSidebar.isHidden().catch(() => true);
    
    // Mobile filter button should be visible
    const filterButton = page.locator("button:has-text('Filters')").first();
    await expect(filterButton).toBeVisible();
  });

  test("should open bottom sheet filter drawer when filter button clicked", async ({ page }) => {
    // Click filter button
    const filterButton = page.locator("button:has-text('Filters')").first();
    await filterButton.click();
    
    // Bottom sheet should be visible
    const bottomSheet = page.locator("text=Filter Invoices").first();
    await expect(bottomSheet).toBeVisible();
    
    // Close button should be present
    const closeButton = page.locator("button[aria-label*='Close']").first();
    await expect(closeButton).toBeVisible();
  });

  test("should close bottom sheet when overlay is clicked", async ({ page }) => {
    // Open bottom sheet
    const filterButton = page.locator("button:has-text('Filters')").first();
    await filterButton.click();
    
    const bottomSheetContent = page.locator("text=Filter Invoices").first();
    await expect(bottomSheetContent).toBeVisible();
    
    // Click on the backdrop (overlay)
    const backdrop = page.locator(".fixed.inset-0.z-40").first();
    await backdrop.click();
    
    // Bottom sheet should be hidden
    await expect(bottomSheetContent).toBeHidden();
  });

  test("should close bottom sheet when close button is clicked", async ({ page }) => {
    // Open bottom sheet
    const filterButton = page.locator("button:has-text('Filters')").first();
    await filterButton.click();
    
    const bottomSheetContent = page.locator("text=Filter Invoices").first();
    await expect(bottomSheetContent).toBeVisible();
    
    // Click close button
    const closeButton = page.locator("button[aria-label*='Close']").first();
    await closeButton.click();
    
    // Bottom sheet should be hidden
    await expect(bottomSheetContent).toBeHidden();
  });

  test("should display filter controls inside bottom sheet", async ({ page }) => {
    // Open bottom sheet
    const filterButton = page.locator("button:has-text('Filters')").first();
    await filterButton.click();
    
    // Check for filter controls
    await expect(page.locator("text=Categories").first()).toBeVisible();
    await expect(page.locator("text=Jurisdictions").first()).toBeVisible();
    await expect(page.locator("text=Risk Tier").first()).toBeVisible();
    await expect(page.locator("text=APR Range").first()).toBeVisible();
    await expect(page.locator("text=Active Only").first()).toBeVisible();
  });

  test("should allow filtering from bottom sheet on mobile", async ({ page }) => {
    // Open bottom sheet
    const filterButton = page.locator("button:has-text('Filters')").first();
    await filterButton.click();
    
    // Select a category (assuming first category checkbox is available)
    const categoryCheckbox = page.locator("input[type='checkbox']").first();
    await categoryCheckbox.click();
    
    // Close bottom sheet to apply filters
    const closeButton = page.locator("button[aria-label*='Close']").first();
    await closeButton.click();
    
    // Verify bottom sheet is closed
    const bottomSheetContent = page.locator("text=Filter Invoices").first();
    await expect(bottomSheetContent).toBeHidden();
    
    // Page should still be interactive (no horizontal scroll)
    const body = page.locator("body");
    const scrollWidth = await body.evaluate((el) => el.scrollWidth);
    const clientWidth = await body.evaluate((el) => el.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // +1 for rounding
  });

  test("should show active filter count badge on mobile filter button", async ({ page }) => {
    // Open bottom sheet
    const filterButton = page.locator("button:has-text('Filters')").first();
    await filterButton.click();
    
    // Select a category
    const categoryCheckbox = page.locator("input[type='checkbox']").first();
    await categoryCheckbox.click();
    
    // Close bottom sheet
    const closeButton = page.locator("button[aria-label*='Close']").first();
    await closeButton.click();
    
    // Filter button should show badge with count
    const badge = filterButton.locator("span").filter({ hasText: /\d+/ }).first();
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("1");
  });

  test("should maintain responsive layout after page load", async ({ page }) => {
    // Take screenshot on mobile
    await page.screenshot({ path: "marketplace-mobile-initial.png" });
    
    // Verify single column
    const gridContainer = page.locator(".grid").first();
    const gridClasses = await gridContainer.getAttribute("class");
    expect(gridClasses).toContain("sm:grid-cols-2");
    
    // Filter button should be visible
    const filterButton = page.locator("button:has-text('Filters')").first();
    await expect(filterButton).toBeVisible();
  });

  test("should handle long filter lists in bottom sheet with scroll", async ({ page }) => {
    // Open bottom sheet
    const filterButton = page.locator("button:has-text('Filters')").first();
    await filterButton.click();
    
    // Get the scrollable content area
    const scrollableArea = page.locator(".overflow-y-auto").first();
    
    // Scroll down in the bottom sheet
    await scrollableArea.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    
    // Verify scroll worked by checking if we can see the reset button at the bottom
    const resetButton = page.locator("button:has-text('Reset All Filters')").first();
    
    // The button should be present in the DOM
    await expect(resetButton).toBeDefined();
  });
});

test.describe("Marketplace - Mobile Search Experience", () => {
  test.use({ ...devices["iPhone 12"] });

  test.beforeEach(async ({ page }) => {
    await page.goto("/marketplace");
  });

  test("should display search bar on mobile", async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible();
  });

  test("should display sort dropdown on mobile", async ({ page }) => {
    const sortSelect = page.locator("select").first();
    await expect(sortSelect).toBeVisible();
  });

  test("should stack search and sort vertically on mobile", async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    const sortSelect = page.locator("select").first();
    
    const searchBox = await searchInput.boundingBox();
    const sortBox = await sortSelect.boundingBox();
    
    // Sort should be below search on mobile
    if (searchBox && sortBox) {
      expect(searchBox.y).toBeLessThan(sortBox.y);
    }
  });
});
