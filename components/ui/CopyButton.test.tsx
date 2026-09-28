import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "./CopyButton";

const EN_MAP: Record<string, string> = {
  copyAriaLabel: "Copy",
  copiedAriaLabel: "Copied",
  copyTooltip: "Copy",
  copiedTooltip: "Copied!",
};

let activeMap = EN_MAP;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => activeMap[key] ?? key,
}));

// Radix's Tooltip uses useSize, which calls ResizeObserver — not implemented in jsdom.
vi.stubGlobal(
  "ResizeObserver",
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

describe("CopyButton", () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    activeMap = EN_MAP;
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("renders a translated aria-label before copying", () => {
    render(<CopyButton text="hello" />);
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("shows a translated tooltip before copying", async () => {
    render(<CopyButton text="hello" />);
    await userEvent.hover(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByText("Copy", { selector: "[role=tooltip]" })).toBeInTheDocument();
  });

  it("flips to the translated 'copied' aria-label and tooltip after a click", async () => {
    render(<CopyButton text="hello" />);

    await userEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("hello"));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("renders Arabic translations when the locale map provides them", () => {
    activeMap = {
      copyAriaLabel: "نسخ",
      copiedAriaLabel: "تم النسخ",
      copyTooltip: "نسخ",
      copiedTooltip: "تم النسخ!",
    };
    render(<CopyButton text="hello" />);
    expect(screen.getByRole("button", { name: "نسخ" })).toBeInTheDocument();
  });
});
