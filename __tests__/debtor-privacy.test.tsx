import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import {
  getEffectiveDebtorPrivacy,
  getMaskedDebtorName,
  getMaskedDebtorAddress,
  getDebtorAriaLabel,
  isDebtorAnonymized,
  isDebtorPartial,
  isDebtorFull,
} from "@/lib/debtorPrivacy";
import { DebtorDisplay } from "@/components/invoice/DebtorDisplay";
import { createMockInvoice } from "./fixtures";

describe("Debtor Privacy & Card Variants — Issue #562", () => {
  const anonymizedInvoice = createMockInvoice({
    debtorPrivacy: "anonymized",
    metadata: {
      ...createMockInvoice().metadata,
      debtorName: "Confidential Enterprise Ltd",
      debtorAddress: "100 Confidential Road, Nairobi, Kenya",
      jurisdiction: "KE",
      category: "technology",
    },
  });

  const partialInvoice = createMockInvoice({
    debtorPrivacy: "partial",
    metadata: {
      ...createMockInvoice().metadata,
      debtorName: "Acme Logistics SA",
      debtorAddress: "45 Port Boulevard, Durban, South Africa",
      jurisdiction: "ZA",
      category: "logistics",
    },
  });

  const fullInvoice = createMockInvoice({
    debtorPrivacy: "full",
    metadata: {
      ...createMockInvoice().metadata,
      debtorName: "Safaricom PLC",
      debtorAddress: "Safaricom House, Waiyaki Way, Nairobi, Kenya",
      jurisdiction: "KE",
      category: "technology",
    },
  });

  describe("Masking helpers & rules", () => {
    describe("anonymized level", () => {
      it("masks debtor name and prevents PII leakage", () => {
        const maskedName = getMaskedDebtorName(anonymizedInvoice);
        expect(maskedName).not.toContain("Confidential Enterprise Ltd");
        expect(maskedName).toBe("Technology Company (Kenya)");
      });

      it("masks debtor street address", () => {
        const maskedAddress = getMaskedDebtorAddress(anonymizedInvoice);
        expect(maskedAddress).not.toContain("100 Confidential Road");
        expect(maskedAddress).toBe("Identity anonymized for privacy");
      });

      it("generates privacy-safe ARIA label without leaking debtor name", () => {
        const aria = getDebtorAriaLabel(anonymizedInvoice);
        expect(aria).not.toContain("Confidential Enterprise Ltd");
        expect(aria).toContain("Anonymized for privacy");
      });

      it("evaluates privacy level booleans correctly", () => {
        expect(isDebtorAnonymized(anonymizedInvoice)).toBe(true);
        expect(isDebtorPartial(anonymizedInvoice)).toBe(false);
        expect(isDebtorFull(anonymizedInvoice)).toBe(false);
      });
    });

    describe("partial level", () => {
      it("reveals debtor name but masks street address", () => {
        expect(getMaskedDebtorName(partialInvoice)).toBe("Acme Logistics SA");
        const maskedAddress = getMaskedDebtorAddress(partialInvoice);
        expect(maskedAddress).not.toContain("45 Port Boulevard");
        expect(maskedAddress).toContain("Address hidden · South Africa");
      });

      it("generates partial disclosure ARIA label", () => {
        const aria = getDebtorAriaLabel(partialInvoice);
        expect(aria).toContain("Acme Logistics SA");
        expect(aria).toContain("Partial disclosure");
      });

      it("evaluates privacy level booleans correctly", () => {
        expect(isDebtorAnonymized(partialInvoice)).toBe(false);
        expect(isDebtorPartial(partialInvoice)).toBe(true);
        expect(isDebtorFull(partialInvoice)).toBe(false);
      });
    });

    describe("full level", () => {
      it("reveals full debtor name and address", () => {
        expect(getMaskedDebtorName(fullInvoice)).toBe("Safaricom PLC");
        expect(getMaskedDebtorAddress(fullInvoice)).toBe("Safaricom House, Waiyaki Way, Nairobi, Kenya");
      });

      it("evaluates privacy level booleans correctly", () => {
        expect(isDebtorAnonymized(fullInvoice)).toBe(false);
        expect(isDebtorPartial(fullInvoice)).toBe(false);
        expect(isDebtorFull(fullInvoice)).toBe(true);
      });
    });

    describe("post-funding reveal (isFunded = true)", () => {
      it("elevates anonymized invoice to full disclosure when funded", () => {
        expect(getEffectiveDebtorPrivacy(anonymizedInvoice, true)).toBe("full");
        expect(getMaskedDebtorName(anonymizedInvoice, true)).toBe("Confidential Enterprise Ltd");
        expect(getMaskedDebtorAddress(anonymizedInvoice, true)).toBe("100 Confidential Road, Nairobi, Kenya");
      });
    });
  });

  describe("DebtorDisplay UI Component", () => {
    it("renders anonymized badge and generic label for anonymized invoice", () => {
      render(<DebtorDisplay invoice={anonymizedInvoice} showPrivacyBadge />);

      expect(screen.queryByText("Confidential Enterprise Ltd")).not.toBeInTheDocument();
      expect(screen.getByText("Technology Company (Kenya)")).toBeInTheDocument();
      expect(screen.getByText("Identity anonymized for privacy")).toBeInTheDocument();
      expect(screen.getByText("Anonymized")).toBeInTheDocument();
    });

    it("renders partial privacy badge and masked address for partial invoice", () => {
      render(<DebtorDisplay invoice={partialInvoice} showPrivacyBadge />);

      expect(screen.getByText("Acme Logistics SA")).toBeInTheDocument();
      expect(screen.getByText("Address hidden · South Africa")).toBeInTheDocument();
      expect(screen.getByText("Partial Privacy")).toBeInTheDocument();
    });

    it("renders full disclosure for full invoice", () => {
      render(<DebtorDisplay invoice={fullInvoice} showPrivacyBadge />);

      expect(screen.getByText("Safaricom PLC")).toBeInTheDocument();
      expect(screen.getByText("Safaricom House, Waiyaki Way, Nairobi, Kenya")).toBeInTheDocument();
      expect(screen.getByText("Full Disclosure")).toBeInTheDocument();
    });

    it("renders compact mode for comparison/table rows", () => {
      render(<DebtorDisplay invoice={anonymizedInvoice} variant="compact" showPrivacyBadge />);

      expect(screen.getByText("Technology Company (Kenya)")).toBeInTheDocument();
      expect(screen.queryByText("Confidential Enterprise Ltd")).not.toBeInTheDocument();
    });
  });
});
