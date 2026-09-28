import { test, expect } from "@playwright/test";

test.describe("Security & Cache Exclusions", () => {
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

  const sensitiveRoutes = [
    "/dashboard/sme",
    "/dashboard/investor",
    "/transactions",
    "/invoice/create",
    "/api/auth/csrf",
  ];

  for (const route of sensitiveRoutes) {
    test(`should set no-store Cache-Control on sensitive route: ${route}`, async ({ request }) => {
      const response = await request.get(route);
      const headers = response.headers();
      const cacheControl = headers["cache-control"] || "";
      expect(cacheControl).toContain("no-store");
    });
  }
});
