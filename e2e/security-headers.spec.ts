import { test, expect } from "@playwright/test";

test.describe("Security Headers", () => {
  test("should have required security headers on main route", async ({ page }) => {
    const response = await page.goto("/");
    expect(response).toBeTruthy();
    const headers = response?.headers();

    expect(headers?.["content-security-policy"]).toBeDefined();
    expect(headers?.["x-frame-options"]).toBe("DENY");
    expect(headers?.["x-content-type-options"]).toBe("nosniff");
    expect(headers?.["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers?.["permissions-policy"]).toContain("camera=()");
    expect(headers?.["permissions-policy"]).toContain("microphone=()");
  });

  test("should have required security headers on API route", async ({ request }) => {
    const response = await request.get("/api/feedback");
    const headers = response.headers();

    expect(headers?.["content-security-policy"]).toBeDefined();
    expect(headers?.["x-frame-options"]).toBe("DENY");
    expect(headers?.["x-content-type-options"]).toBe("nosniff");
    expect(headers?.["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers?.["permissions-policy"]).toContain("camera=()");
    expect(headers?.["permissions-policy"]).toContain("microphone=()");
  });
});
