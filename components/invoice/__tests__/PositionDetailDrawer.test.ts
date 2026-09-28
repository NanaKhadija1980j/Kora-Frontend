import { describe, it, expect } from "vitest";
import { escapeHtml } from "../PositionDetailDrawer";

describe("PositionDetailDrawer escapeHtml", () => {
  it("neutralises XSS-style metadata before it reaches the print window", () => {
    const payload = `<img src=x onerror="alert(1)">'</title><script>alert(2)</script>`;
    const escaped = escapeHtml(payload);
    expect(escaped).not.toMatch(/[<>"']/);
    expect(escaped).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;&lt;/title&gt;&lt;script&gt;alert(2)&lt;/script&gt;",
    );
  });

  it("handles nullish values", () => {
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(null)).toBe("");
  });
});
