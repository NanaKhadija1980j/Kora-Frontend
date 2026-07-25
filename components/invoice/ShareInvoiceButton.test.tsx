import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import ShareInvoiceButton, { buildInvoiceShareUrl } from "./ShareInvoiceButton";

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,test"),
  },
}));

describe("buildInvoiceShareUrl", () => {
  it("adds the required UTM parameters", () => {
    const url = new URL(
      buildInvoiceShareUrl("https://kora.example", "token-42"),
    );
    expect(url.pathname).toBe("/marketplace/token-42");
    expect(url.searchParams.get("utm_source")).toBe("kora");
    expect(url.searchParams.get("utm_medium")).toBe("share");
    expect(url.searchParams.get("utm_content")).toBe("token-42");
  });
});

describe("ShareInvoiceButton", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "maxTouchPoints", {
      configurable: true,
      value: 0,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("copies the tracked link on desktop", async () => {
    render(<ShareInvoiceButton id="token-7" />);
    await userEvent.click(
      screen.getByRole("button", { name: "Share invoice" }),
    );

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining(
          "/marketplace/token-7?utm_source=kora&utm_medium=share&utm_content=token-7",
        ),
      );
      expect(toast.success).toHaveBeenCalledWith("Link copied");
    });
  });

  it("uses native sharing on mobile when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "maxTouchPoints", {
      configurable: true,
      value: 1,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });

    render(<ShareInvoiceButton id="token-9" invoiceTitle="Invoice 9" />);
    await userEvent.click(
      screen.getByRole("button", { name: "Share invoice" }),
    );

    await waitFor(() => {
      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Invoice 9",
          url: expect.stringContaining("utm_content=token-9"),
        }),
      );
      expect(toast.success).toHaveBeenCalledWith("Shared successfully");
    });
  });
});
