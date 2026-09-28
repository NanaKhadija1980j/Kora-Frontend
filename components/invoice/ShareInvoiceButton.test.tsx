import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import ShareInvoiceButton, {
  buildInvoiceShareUrl,
  resolveShareTokenId,
} from "./ShareInvoiceButton";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      shareButton: "Share",
      shareLabel: "Share invoice",
      copyLink: "Copy link",
      linkCopied: "Link copied",
      shareOnX: "Share on X",
      shareOnLinkedIn: "LinkedIn",
      qrCodeLabel: "QR Code",
      qrCodeAlt: "QR code for shared invoice link",
      linkCopiedToast: "Link copied",
      unableToCopy: "Unable to copy link",
      sharedSuccessfully: "Shared successfully",
      defaultInvoiceTitle: "Invoice",
      recipientLabel: "Recipient:",
      defaultShareTitle: "Kora invoice opportunity",
      defaultShareText: "Review this invoice financing opportunity on Kora.",
      defaultTweetSummary: "Invoice listed on Kora",
    };
    return map[key] ?? key;
  },
}));

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

describe("resolveShareTokenId", () => {
  it("prefers on-chain tokenId over app id", () => {
    expect(resolveShareTokenId("inv_001", "1")).toBe("1");
  });

  it("falls back to app id when tokenId is missing", () => {
    expect(resolveShareTokenId("inv_001")).toBe("inv_001");
    expect(resolveShareTokenId("inv_001", "  ")).toBe("inv_001");
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

  it("copies the tracked link on desktop using tokenId", async () => {
    render(<ShareInvoiceButton id="inv_001" tokenId="7" />);
    await userEvent.click(
      screen.getByRole("button", { name: "Share invoice" }),
    );

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining(
          "/marketplace/7?utm_source=kora&utm_medium=share&utm_content=7",
        ),
      );
      expect(toast.success).toHaveBeenCalledWith("Link copied");
    });
  });

  it("falls back to copy when Web Share API is unavailable", async () => {
    render(<ShareInvoiceButton id="token-7" />);
    await userEvent.click(
      screen.getByRole("button", { name: "Share invoice" }),
    );

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
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

  it("uses translated defaults for native sharing when no title/summary is supplied", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "maxTouchPoints", {
      configurable: true,
      value: 1,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });

    render(<ShareInvoiceButton id="token-11" />);
    await userEvent.click(
      screen.getByRole("button", { name: "Share invoice" }),
    );

    await waitFor(() => {
      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Kora invoice opportunity",
          text: "Review this invoice financing opportunity on Kora.",
        }),
      );
    });
  });
});
