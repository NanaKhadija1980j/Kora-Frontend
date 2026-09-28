import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  CategoryTaxonomyPreview,
  buildTaxonomyPreviewData,
} from "@/components/marketplace/CategoryTaxonomyPreview";
import { createMockInvoice } from "./fixtures";
import * as featureFlags from "@/lib/featureFlags";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    return (key: string) => {
      const translations: Record<string, string> = {
        title: "Category Taxonomy Preview",
        badge: "Dev Preview",
        subtitle: "Developer preview of category taxonomy, inventory distribution, and i18n label parity.",
        totalCategories: "Total Categories",
        activeCategories: "Active in Inventory",
        unusedCategories: "Unused Categories",
        missingTranslations: "Missing Translations",
        filterAll: "All",
        filterActive: "Active Only",
        filterUnused: "Unused Only",
        filterMissingI18n: "Missing i18n Only",
        searchPlaceholder: "Search taxonomy keys or labels...",
        key: "Key",
        label: "Label",
        icon: "Icon",
        inventoryCount: "Live Inventory",
        i18nStatus: "Locale Parity",
        unusedWarning: "0 listings in inventory",
        copyTaxonomy: "Copy Taxonomy JSON",
        copied: "Copied to clipboard!",
        close: "Close Preview",
        openPreview: "Taxonomy Preview",
        sources: "Sources",
        filterSource: "Marketplace Filters",
        schemaSource: "Metadata Schema",
        technology: "Technology",
        manufacturing: "Manufacturing",
        agriculture: "Agriculture",
        logistics: "Logistics",
        healthcare: "Healthcare",
        retail: "Retail",
        construction: "Construction",
        export: "Export",
        services: "Services",
        energy: "Energy",
        finance: "Finance",
        other: "Other",
      };
      return translations[key] ?? key;
    };
  },
}));

describe("Category Taxonomy Preview — Issue #565", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("buildTaxonomyPreviewData aggregation", () => {
    it("aggregates inventory counts correctly across categories", () => {
      const invoices = [
        createMockInvoice({ metadata: { ...createMockInvoice().metadata, category: "technology" } }),
        createMockInvoice({ metadata: { ...createMockInvoice().metadata, category: "technology" } }),
        createMockInvoice({ metadata: { ...createMockInvoice().metadata, category: "agriculture" } }),
        createMockInvoice({ metadata: { ...createMockInvoice().metadata, category: "manufacturing" } }),
      ];

      const data = buildTaxonomyPreviewData(invoices);

      const techItem = data.find((i) => i.key === "technology");
      const agriItem = data.find((i) => i.key === "agriculture");
      const mfgItem = data.find((i) => i.key === "manufacturing");
      const unusedItem = data.find((i) => i.key === "energy");

      expect(techItem?.inventoryCount).toBe(2);
      expect(agriItem?.inventoryCount).toBe(1);
      expect(mfgItem?.inventoryCount).toBe(1);
      expect(unusedItem?.inventoryCount).toBe(0);
    });

    it("identifies both filter and schema category sources", () => {
      const data = buildTaxonomyPreviewData([]);
      
      const techItem = data.find((i) => i.key === "technology");
      expect(techItem?.sources).toContain("filter");
      expect(techItem?.sources).toContain("schema");

      const exportItem = data.find((i) => i.key === "export");
      expect(exportItem?.sources).toContain("filter");

      const logisticsItem = data.find((i) => i.key === "logistics");
      expect(logisticsItem?.sources).toContain("schema");
    });

    it("verifies i18n flags for all supported locales", () => {
      const data = buildTaxonomyPreviewData([]);
      for (const item of data) {
        expect(item.i18n.en).toBe(true);
        expect(item.i18n.es).toBe(true);
        expect(item.i18n.ar).toBe(true);
        expect(item.i18n.ptBR).toBe(true);
      }
    });
  });

  describe("CategoryTaxonomyPreview UI Component", () => {
    it("renders nothing when feature flag is disabled", () => {
      vi.spyOn(featureFlags, "useFeatureFlag").mockReturnValue(false);

      const { container } = render(<CategoryTaxonomyPreview isOpen={true} invoices={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it("renders preview trigger button and dialog when flag is enabled", () => {
      vi.spyOn(featureFlags, "useFeatureFlag").mockReturnValue(true);

      render(<CategoryTaxonomyPreview isOpen={true} invoices={[]} />);
      
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Category Taxonomy Preview")).toBeInTheDocument();
      expect(screen.getByText("Dev Preview")).toBeInTheDocument();
    });

    it("filters categories by search keyword", () => {
      vi.spyOn(featureFlags, "useFeatureFlag").mockReturnValue(true);

      render(<CategoryTaxonomyPreview isOpen={true} invoices={[]} />);

      const searchInput = screen.getByPlaceholderText("Search taxonomy keys or labels...");
      fireEvent.change(searchInput, { target: { value: "techno" } });

      expect(screen.getByText("technology")).toBeInTheDocument();
      expect(screen.queryByText("agriculture")).not.toBeInTheDocument();
    });

    it("filters by active vs unused categories", () => {
      vi.spyOn(featureFlags, "useFeatureFlag").mockReturnValue(true);

      const invoices = [
        createMockInvoice({ metadata: { ...createMockInvoice().metadata, category: "technology" } }),
      ];

      render(<CategoryTaxonomyPreview isOpen={true} invoices={invoices} />);

      // Switch to Active Only
      const activeFilterBtn = screen.getByRole("button", { name: /Active Only/i });
      fireEvent.click(activeFilterBtn);

      expect(screen.getByText("technology")).toBeInTheDocument();
      expect(screen.queryByText("agriculture")).not.toBeInTheDocument();

      // Switch to Unused Only
      const unusedFilterBtn = screen.getByRole("button", { name: /Unused Only/i });
      fireEvent.click(unusedFilterBtn);

      expect(screen.getByText("agriculture")).toBeInTheDocument();
      expect(screen.queryByText("technology")).not.toBeInTheDocument();
    });
  });
});
