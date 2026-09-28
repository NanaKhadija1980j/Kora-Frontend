/**
 * Unit tests for invoice SEO helpers (Issue #375).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { MOCK_INVOICES } from "@/services/mockData";
import {
  buildInvoicePageMetadata,
  buildInvoiceSitemapEntries,
  buildPublicInvoiceSeo,
  publicDebtorLabel,
  resolveIpfsAssetUrl,
  scrubPrivateText,
  invoiceToSvgMetadata,
} from "../invoiceSeo";
import type { InvoiceMetadataV1 } from "../invoiceMetadata";

beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = "https://kora.finance";
  process.env.NEXT_PUBLIC_APP_NAME = "Kora";
  process.env.NEXT_PUBLIC_IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs";
  process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA = "true";
});

describe("publicDebtorLabel", () => {
  it("returns real debtor name when privacy is full", () => {
    const inv = MOCK_INVOICES.find((i) => i.debtorPrivacy === "full")!;
    expect(publicDebtorLabel(inv)).toBe(inv.metadata.debtorName);
  });

  it("returns anonymized industry + jurisdiction label", () => {
    const inv = MOCK_INVOICES.find((i) => i.debtorPrivacy === "anonymized")!;
    const label = publicDebtorLabel(inv);
    expect(label).not.toBe(inv.metadata.debtorName);
    expect(label).toMatch(/,/);
    expect(label.toLowerCase()).not.toContain(
      inv.metadata.debtorAddress.toLowerCase().slice(0, 12)
    );
  });
});

describe("scrubPrivateText", () => {
  it("strips debtor address and wallet keys from text", () => {
    const inv = MOCK_INVOICES[0];
    const dirty = `Contact ${inv.metadata.debtorAddress} or ${inv.ownerAddress}`;
    const clean = scrubPrivateText(dirty, inv);
    expect(clean).not.toContain(inv.metadata.debtorAddress);
    expect(clean).not.toContain(inv.ownerAddress);
  });

  it("replaces debtor name when anonymized", () => {
    const inv = MOCK_INVOICES.find((i) => i.debtorPrivacy === "anonymized")!;
    const dirty = `Invoice for ${inv.metadata.debtorName}`;
    const clean = scrubPrivateText(dirty, inv);
    expect(clean).not.toContain(inv.metadata.debtorName);
    expect(clean).toContain(publicDebtorLabel(inv));
  });
});

describe("resolveIpfsAssetUrl", () => {
  it("resolves ipfs:// CIDs to gateway HTTPS URLs", () => {
    const cid = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";
    expect(resolveIpfsAssetUrl(`ipfs://${cid}`)).toBe(
      `https://gateway.pinata.cloud/ipfs/${cid}`
    );
  });

  it("passes through https URLs", () => {
    expect(
      resolveIpfsAssetUrl("https://gateway.pinata.cloud/ipfs/QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco")
    ).toMatch(/^https:\/\//);
  });

  it("returns undefined for invalid values", () => {
    expect(resolveIpfsAssetUrl("")).toBeUndefined();
    expect(resolveIpfsAssetUrl("not-a-cid")).toBeUndefined();
    expect(resolveIpfsAssetUrl(null)).toBeUndefined();
  });
});

describe("buildPublicInvoiceSeo", () => {
  it("builds SEO fields without leaking private addresses", () => {
    const inv = MOCK_INVOICES[0];
    const seo = buildPublicInvoiceSeo(inv);
    const blob = JSON.stringify(seo);
    expect(blob).not.toContain(inv.metadata.debtorAddress);
    expect(blob).not.toContain(inv.ownerAddress);
    // Canonical deep links prefer on-chain token ID (#383)
    expect(seo.pageUrl).toContain(`/marketplace/${inv.tokenId}`);
    expect(seo.ogImageUrl).toContain(`/marketplace/${inv.tokenId}/opengraph-image`);
  });

  it("uses PNG opengraph-image route for social crawlers (not IPFS SVG)", () => {
    const inv = MOCK_INVOICES[0];
    const cid = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
    const ipfsMeta = {
      metadata_version: "1.0",
      name: "Invoice INV-2024-0891",
      description: "Public description only",
      image: `ipfs://${cid}`,
      invoice_number: "INV-2024-0891",
      amount: 250000,
      currency: "USDC",
      due_date: "2025-02-01",
      issuer: {
        address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        name: "Issuer",
      },
      debtor: { name: "Debtor Co", privacy: "full" as const },
    } satisfies InvoiceMetadataV1;

    const seo = buildPublicInvoiceSeo(inv, ipfsMeta);
    expect(seo.ogImageUrl).toContain(`/marketplace/${inv.tokenId}/opengraph-image`);
    expect(seo.ogImageUrl).not.toContain(cid);
    expect(seo.description).toBe("Public description only");
  });

  it("uses anonymized debtor label in titles for private invoices", () => {
    const inv = MOCK_INVOICES.find((i) => i.debtorPrivacy === "anonymized")!;
    const seo = buildPublicInvoiceSeo(inv);
    expect(seo.debtorLabel).toBe(publicDebtorLabel(inv));
    expect(seo.isAnonymized).toBe(true);
    const meta = buildInvoicePageMetadata(seo);
    expect(String(meta.title)).toContain(seo.debtorLabel);
    expect(String(meta.title)).not.toContain(inv.metadata.debtorName);
    expect(JSON.stringify(meta)).not.toContain(inv.metadata.debtorAddress);
  });
});

describe("buildInvoicePageMetadata", () => {
  it("includes openGraph and twitter large image cards", () => {
    const seo = buildPublicInvoiceSeo(MOCK_INVOICES[0]);
    const meta = buildInvoicePageMetadata(seo);
    expect(meta.openGraph?.images).toBeDefined();
    expect(meta.twitter?.card).toBe("summary_large_image");
    expect(meta.robots).toEqual({ index: true, follow: true });
  });
});

describe("buildInvoiceSitemapEntries", () => {
  it("includes listed invoices and excludes drafts/cancelled", () => {
    const entries = buildInvoiceSitemapEntries([
      { id: "a", status: "listed", updatedAt: "2024-11-01T00:00:00Z" },
      { id: "b", status: "draft", updatedAt: "2024-11-01T00:00:00Z" },
      { id: "c", status: "cancelled", updatedAt: "2024-11-01T00:00:00Z" },
      { id: "d", status: "partially_funded", updatedAt: "2024-12-01T00:00:00Z" },
    ]);
    expect(entries.map((e) => e.path)).toEqual([
      "/marketplace/a",
      "/marketplace/d",
    ]);
    expect(entries[0].priority).toBe("0.8");
    expect(entries[0].lastmod).toBe("2024-11-01");
  });
});

describe("invoiceToSvgMetadata", () => {
  it("uses privacy-safe debtor name for SVG generation", () => {
    const inv = MOCK_INVOICES.find((i) => i.debtorPrivacy === "anonymized")!;
    const meta = invoiceToSvgMetadata(inv);
    expect(meta.debtor.name).toBe(publicDebtorLabel(inv));
    expect(meta.debtor.name).not.toBe(inv.metadata.debtorName);
  });
});
