/**
 * Component tests — RangeSlider
 *
 * These tests exercise keyboard interactions on the dual-thumb RangeSlider
 * component (components/ui/range-slider.tsx).
 *
 * jsdom cannot reliably fire native keyboard events on <input type="range">
 * and observe value changes, making this a browser-only concern.
 *
 * The tests run against the isolated fixture page at /test-components
 * (app/test-components/page.tsx), which mounts RangeSlider with:
 *   min=0, max=50, step=1, initial value=[0, 50]
 *   formatLabel={(v) => `${v}%`}
 *
 * The component (range-slider.tsx) uses:
 *   aria-label={`Minimum value: ${formatLabel(minVal)}`}  → "Minimum value: 0%"
 *   aria-label={`Maximum value: ${formatLabel(maxVal)}`}  → "Maximum value: 50%"
 *
 * Do NOT duplicate any Vitest / jsdom tests.  This file covers:
 *  - Both range thumbs are present and keyboard-focusable
 *  - Aria-labels correctly identify min and max thumbs
 *  - Live output label reflects current state
 *  - Min thumb: ArrowRight / ArrowUp increase value
 *  - Min thumb: ArrowLeft / ArrowDown decrease value
 *  - Min thumb: Home key jumps to minimum bound (0)
 *  - Min thumb: End key clamps strictly below max thumb
 *  - Max thumb: ArrowLeft decreases value
 *  - Max thumb: ArrowRight increases value
 *  - Max thumb: End key jumps to maximum bound (50)
 *  - Max thumb: Home key clamps strictly above min thumb
 *  - Min thumb clamped: cannot exceed max under repeated ArrowRight
 *  - Max thumb clamped: cannot go below min under repeated ArrowLeft
 *  - Endpoint labels (0% / 50%) visible below the slider track
 */

import { test, expect, type Page } from "@playwright/test";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function gotoFixture(page: Page) {
  await page.goto("/test-components");
  await expect(page.locator("#range-slider-fixture")).toBeVisible();
}

/** The min-thumb: first <input type="range"> inside the fixture section */
const getMinThumb = (page: Page) =>
  page.locator('#range-slider-fixture input[type="range"]').nth(0);

/** The max-thumb: second <input type="range"> inside the fixture section */
const getMaxThumb = (page: Page) =>
  page.locator('#range-slider-fixture input[type="range"]').nth(1);

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe("RangeSlider component — keyboard interactions", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page);
  });

  // ── Presence and accessibility ─────────────────────────────────────────────

  test("both range thumbs are present inside the fixture", async ({ page }) => {
    await expect(getMinThumb(page)).toBeVisible();
    await expect(getMaxThumb(page)).toBeVisible();
  });

  test("min thumb aria-label contains 'Minimum value'", async ({ page }) => {
    const label = await getMinThumb(page).getAttribute("aria-label");
    expect(label).toMatch(/minimum value/i);
  });

  test("max thumb aria-label contains 'Maximum value'", async ({ page }) => {
    const label = await getMaxThumb(page).getAttribute("aria-label");
    expect(label).toMatch(/maximum value/i);
  });

  test("thumbs expose formatted aria-valuetext", async ({ page }) => {
    const minValuetext = await getMinThumb(page).getAttribute("aria-valuetext");
    const maxValuetext = await getMaxThumb(page).getAttribute("aria-valuetext");
    expect(minValuetext).toBe("0%");
    expect(maxValuetext).toBe("50%");
  });

  test("both thumbs are keyboard-focusable (tabIndex is not -1)", async ({
    page,
  }) => {
    const minTab = await getMinThumb(page).evaluate(
      (el: HTMLInputElement) => el.tabIndex
    );
    const maxTab = await getMaxThumb(page).evaluate(
      (el: HTMLInputElement) => el.tabIndex
    );
    expect(minTab).not.toBe(-1);
    expect(maxTab).not.toBe(-1);
  });

  // ── Min thumb keyboard navigation ─────────────────────────────────────────

  test("ArrowRight on min thumb increases its value by one step", async ({
    page,
  }) => {
    const thumb = getMinThumb(page);
    const before = Number(await thumb.inputValue());
    await thumb.focus();
    await thumb.press("ArrowRight");
    const after = Number(await thumb.inputValue());
    expect(after).toBeGreaterThan(before);
  });

  test("ArrowLeft on min thumb decreases its value by one step", async ({
    page,
  }) => {
    const thumb = getMinThumb(page);
    // Move right first so there is room to move left
    await thumb.focus();
    await thumb.press("ArrowRight");
    await thumb.press("ArrowRight");
    const before = Number(await thumb.inputValue());
    await thumb.press("ArrowLeft");
    const after = Number(await thumb.inputValue());
    expect(after).toBeLessThan(before);
  });

  test("ArrowUp on min thumb increases its value (same as ArrowRight)", async ({
    page,
  }) => {
    const thumb = getMinThumb(page);
    const before = Number(await thumb.inputValue());
    await thumb.focus();
    await thumb.press("ArrowUp");
    const after = Number(await thumb.inputValue());
    expect(after).toBeGreaterThan(before);
  });

  test("ArrowDown on min thumb decreases its value (same as ArrowLeft)", async ({
    page,
  }) => {
    const thumb = getMinThumb(page);
    await thumb.focus();
    await thumb.press("ArrowRight");
    await thumb.press("ArrowRight");
    const before = Number(await thumb.inputValue());
    await thumb.press("ArrowDown");
    const after = Number(await thumb.inputValue());
    expect(after).toBeLessThan(before);
  });

  test("Home key on min thumb sets value to the minimum bound (0)", async ({
    page,
  }) => {
    const thumb = getMinThumb(page);
    // Move right a few steps first so Home has work to do
    await thumb.focus();
    await thumb.press("ArrowRight");
    await thumb.press("ArrowRight");
    await thumb.press("ArrowRight");
    // Home is handled by RangeSlider.handleKeyDown → onChange([min, maxVal])
    await thumb.press("Home");
    expect(Number(await thumb.inputValue())).toBe(0);
  });

  test("End key on min thumb clamps it strictly below the max thumb", async ({
    page,
  }) => {
    const minThumb = getMinThumb(page);
    const maxThumb = getMaxThumb(page);
    await minThumb.focus();
    // End → onChange([Math.min(max, minVal + step), maxVal]) clamped at maxVal - step
    await minThumb.press("End");
    expect(Number(await minThumb.inputValue())).toBeLessThan(
      Number(await maxThumb.inputValue())
    );
  });

  // ── Max thumb keyboard navigation ─────────────────────────────────────────

  test("ArrowLeft on max thumb decreases its value by one step", async ({
    page,
  }) => {
    const thumb = getMaxThumb(page);
    const before = Number(await thumb.inputValue());
    await thumb.focus();
    await thumb.press("ArrowLeft");
    expect(Number(await thumb.inputValue())).toBeLessThan(before);
  });

  test("ArrowRight on max thumb increases its value by one step", async ({
    page,
  }) => {
    const thumb = getMaxThumb(page);
    // Move left first so there is room
    await thumb.focus();
    await thumb.press("ArrowLeft");
    await thumb.press("ArrowLeft");
    const before = Number(await thumb.inputValue());
    await thumb.press("ArrowRight");
    expect(Number(await thumb.inputValue())).toBeGreaterThan(before);
  });

  test("End key on max thumb sets value to the maximum bound (50)", async ({
    page,
  }) => {
    const thumb = getMaxThumb(page);
    await thumb.focus();
    // Move left first so End has work to do
    await thumb.press("ArrowLeft");
    await thumb.press("ArrowLeft");
    await thumb.press("ArrowLeft");
    await thumb.press("End");
    expect(Number(await thumb.inputValue())).toBe(50);
  });

  test("Home key on max thumb clamps it strictly above the min thumb", async ({
    page,
  }) => {
    const minThumb = getMinThumb(page);
    const maxThumb = getMaxThumb(page);
    await maxThumb.focus();
    // Home → onChange([minVal, Math.max(min, maxVal - step)]) clamped at minVal + step
    await maxThumb.press("Home");
    expect(Number(await maxThumb.inputValue())).toBeGreaterThan(
      Number(await minThumb.inputValue())
    );
  });

  // ── Boundary clamping ──────────────────────────────────────────────────────

  test("min thumb never exceeds max thumb under repeated ArrowRight", async ({
    page,
  }) => {
    const minThumb = getMinThumb(page);
    const maxThumb = getMaxThumb(page);

    await minThumb.focus();
    // 60 presses > full 0–50 range
    for (let i = 0; i < 60; i++) {
      await minThumb.press("ArrowRight");
    }

    expect(Number(await minThumb.inputValue())).toBeLessThan(
      Number(await maxThumb.inputValue())
    );
  });

  test("max thumb never goes below min thumb under repeated ArrowLeft", async ({
    page,
  }) => {
    const minThumb = getMinThumb(page);
    const maxThumb = getMaxThumb(page);

    await maxThumb.focus();
    for (let i = 0; i < 60; i++) {
      await maxThumb.press("ArrowLeft");
    }

    expect(Number(await maxThumb.inputValue())).toBeGreaterThan(
      Number(await minThumb.inputValue())
    );
  });

  // ── Labels and output ──────────────────────────────────────────────────────

  test("endpoint labels '0%' and '50%' are visible below the slider track", async ({
    page,
  }) => {
    // RangeSlider renders formatLabel(min) and formatLabel(max) at the bottom
    const fixture = page.locator("#range-slider-fixture");
    await expect(fixture.getByText("0%")).toBeVisible();
    await expect(fixture.getByText("50%")).toBeVisible();
  });

  test("live output label updates after keyboard input", async ({ page }) => {
    const minThumb = getMinThumb(page);
    await minThumb.focus();
    await minThumb.press("ArrowRight");

    // The fixture page renders `{value[0]}% – {value[1]}%` in data-testid="range-slider-output"
    await expect(page.getByTestId("range-slider-output")).toContainText("1%");
  });
});
