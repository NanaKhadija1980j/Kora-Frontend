import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AcquirePositionDialog,
  DEFAULT_THRESHOLDS,
} from "@/components/invoice/AcquirePositionDialog";

/**
 * Acquire-position dialog (Issue #768).
 *
 * The dialog is the last screen before a buyer commits funds, so the tests
 * concentrate on the two things that decide whether that commitment is
 * informed: which price-impact warning is shown, and what the primary and
 * cancel actions actually do.
 *
 * Translations resolve to their keys. The copy is authored elsewhere and
 * asserting on English strings would make this fail on a wording change that
 * breaks nothing.
 */

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("@/hooks/useFormatters", () => ({
  useFormatters: () => ({
    formatCurrency: (amount: number, currency: string) => `${currency} ${amount}`,
    formatPercentage: (value: number, dp: number) => `${value.toFixed(dp)}%`,
  }),
}));

type DialogItem = NonNullable<Parameters<typeof AcquirePositionDialog>[0]["item"]>;

function makeItem(impliedDiscount: number, overrides: Partial<DialogItem> = {}): DialogItem {
  return {
    listing: {
      positionId: "pos-1",
      askPrice: 9_500,
      impliedDiscount,
      listedAt: "2026-09-20T00:00:00.000Z",
    },
    positionId: "pos-1",
    invoice: {
      metadata: { invoiceNumber: "INV-001", currency: "USDC" },
      riskTier: "A",
      riskScore: 82,
    },
    investedAmount: 10_000,
    expectedReturn: 10_400,
    sellerAddress: "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
    remainingTenor: 45,
    yieldPercent: 8.5,
    ...overrides,
  } as DialogItem;
}

function renderDialog(item: DialogItem | null, props: Partial<Record<string, unknown>> = {}) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();

  const utils = render(
    <AcquirePositionDialog
      item={item}
      open={item !== null}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      {...props}
    />,
  );

  return { ...utils, onConfirm, onOpenChange };
}

describe("AcquirePositionDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("gating", () => {
    it("renders nothing without a selected position", () => {
      // The page passes `null` until a listing is chosen; rendering the shell
      // against no item would read every `item.*` field on undefined.
      const { container } = renderDialog(null);
      expect(container).toBeEmptyDOMElement();
    });

    it("renders the dialog once a position is selected", () => {
      renderDialog(makeItem(0.05));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("title")).toBeInTheDocument();
    });
  });

  describe("position summary", () => {
    it("shows the invoice number, ask price and expected return", () => {
      renderDialog(makeItem(0.05));

      expect(screen.getByText("INV-001")).toBeInTheDocument();
      expect(screen.getByText("USDC 9500")).toBeInTheDocument();
      expect(screen.getByText("USDC 10400")).toBeInTheDocument();
    });

    it("falls back to the position id when the invoice has no number", () => {
      renderDialog(
        makeItem(0.05, {
          invoice: { metadata: { currency: "USDC" }, riskTier: "B" },
        } as Partial<DialogItem>),
      );

      expect(screen.getByText("Invoice pos-1")).toBeInTheDocument();
    });

    it("defaults the currency to USDC when the invoice does not carry one", () => {
      renderDialog(
        makeItem(0.05, { invoice: { metadata: {}, riskTier: "B" } } as Partial<DialogItem>),
      );

      expect(screen.getByText("USDC 9500")).toBeInTheDocument();
    });

    it("truncates the seller address to first and last four characters", () => {
      renderDialog(makeItem(0.05));
      expect(screen.getByText("GABC...4567")).toBeInTheDocument();
    });

    it("omits the risk score when the invoice has none", () => {
      renderDialog(
        makeItem(0.05, {
          invoice: { metadata: { invoiceNumber: "INV-002" }, riskTier: "C" },
        } as Partial<DialogItem>),
      );

      expect(screen.queryByText(/^riskScore:/)).not.toBeInTheDocument();
    });
  });

  describe("price-impact alerts", () => {
    it("shows no alert on an ordinary spread", () => {
      renderDialog(makeItem(0.05));

      expect(screen.queryByText("priceWarning")).not.toBeInTheDocument();
      expect(screen.queryByText("extremeAlert")).not.toBeInTheDocument();
    });

    it("warns on a discount past the warning threshold", () => {
      renderDialog(makeItem(-DEFAULT_THRESHOLDS.warningDiscountThreshold));

      expect(screen.getByText("priceWarning")).toBeInTheDocument();
      expect(screen.getByText(/warningDiscountMsg/)).toBeInTheDocument();
    });

    it("warns on a premium past the warning threshold", () => {
      renderDialog(makeItem(DEFAULT_THRESHOLDS.warningPremiumThreshold));

      expect(screen.getByText("priceWarning")).toBeInTheDocument();
      expect(screen.getByText(/warningPremiumMsg/)).toBeInTheDocument();
    });

    it("escalates to the extreme alert past the extreme discount threshold", () => {
      renderDialog(makeItem(-DEFAULT_THRESHOLDS.extremeDiscountThreshold));

      expect(screen.getByText("extremeAlert")).toBeInTheDocument();
      expect(screen.queryByText("priceWarning")).not.toBeInTheDocument();
    });

    it("escalates to the extreme alert past the extreme premium threshold", () => {
      renderDialog(makeItem(DEFAULT_THRESHOLDS.extremePremiumThreshold));

      expect(screen.getByText("extremeAlert")).toBeInTheDocument();
    });

    it("treats the thresholds as inclusive", () => {
      // `<=` / `>=` in the component; a refactor to a strict comparison would
      // silently stop warning at exactly the threshold.
      renderDialog(makeItem(-DEFAULT_THRESHOLDS.warningDiscountThreshold + 0.0001));
      expect(screen.queryByText("priceWarning")).not.toBeInTheDocument();
    });

    it("labels a premium as a discount note and a discount as a premium note", () => {
      const premium = renderDialog(makeItem(0.05));
      expect(screen.getByText("discountNote")).toBeInTheDocument();
      premium.unmount();

      renderDialog(makeItem(-0.05));
      expect(screen.getByText("premiumNote")).toBeInTheDocument();
    });
  });

  describe("primary actions", () => {
    it("confirms and closes in one click", () => {
      const { onConfirm, onOpenChange } = renderDialog(makeItem(0.05));

      fireEvent.click(screen.getByRole("button", { name: /confirmAcquire/ }));

      expect(onConfirm).toHaveBeenCalledTimes(1);
      // Leaving it open after confirming invites a double acquisition.
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("closes without confirming when cancelled", () => {
      const { onConfirm, onOpenChange } = renderDialog(makeItem(0.05));

      fireEvent.click(screen.getByRole("button", { name: "cancel" }));

      expect(onConfirm).not.toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("still confirms on an extreme-alert listing", () => {
      // The extreme case restyles the button; it must not disable the action
      // a buyer has been warned about and chosen anyway.
      const { onConfirm } = renderDialog(makeItem(-0.5));

      const confirm = screen.getByRole("button", { name: /confirmAcquire/ });
      expect(confirm).not.toBeDisabled();

      fireEvent.click(confirm);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("closes on Escape", () => {
      const { onOpenChange } = renderDialog(makeItem(0.05));

      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
