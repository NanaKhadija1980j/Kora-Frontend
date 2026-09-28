/**
 * Server-side SEO helpers for invoice detail pages.
 *
 * Builds privacy-safe Open Graph / Twitter metadata hydrated from invoice
 * records and optional IPFS metadata. Never leaks private debtor addresses,
 * issuer wallet keys, or other sensitive fields into public meta tags.
 *
 * Closes #375
 */

import type { Metadata } from "next";
import type { Invoice, InvoiceCategory, InvoiceJurisdiction } from "@/types";
import type { InvoiceMetadataV1 } from "@/lib/invoiceMetadata";
import { formatApr, formatCurrency } from "@/lib/utils";
import { safeIpfsUrl } from "@/lib/security";

/** Local CID check — avoids importing `@/lib/ipfs` (pulls `@/lib/env` at module load). */
const CID_REGEX = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]{52,})$/;
function isValidCID(cid: string): boolean {
  return CID_REGEX.test(cid);
}

const APP_URL = () =>
  process.env.NEXT_PUBLIC_APP_URL || "https://kora.finance";
const APP_NAME = () =>
  process.env.NEXT_PUBLIC_APP_NAME || "Kora";
const IPFS_GATEWAY = () =>
  process.env.NEXT_PUBLIC_IPFS_GATEWAY ||
  "https://gateway.pinata.cloud/ipfs";
const IS_MOCK_DATA = () => process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA === "true";

const CATEGORY_LABELS: Record<InvoiceCategory, string> = {
  technology: "Technology Company",
  manufacturing: "Manufacturing Company",
  logistics: "Logistics Company",
  healthcare: "Healthcare Provider",
  retail: "Retail Company",
  construction: "Construction Company",
  agriculture: "Agribusiness",
  energy: "Energy Provider",
  finance: "Financial Services",
  other: "Company",
};

const JURISDICTION_NAMES: Record<InvoiceJurisdiction, string> = {
  US: "United States",
  EU: "European Union",
  UK: "United Kingdom",
  NG: "Nigeria",
  KE: "Kenya",
  GH: "Ghana",
  ZA: "South Africa",
  OTHER: "Other",
};

/** Fields safe to expose in public meta / structured data. */
export interface PublicInvoiceSeo {
  id: string;
  invoiceNumber: string;
  /** Privacy-safe debtor display label (never a private street address). */
  debtorLabel: string;
  amount: number;
  currency: string;
  apr: number;
  dueDate: string;
  jurisdiction: string;
  category: string;
  riskTier: string;
  description: string;
  /** Absolute HTTPS URL for OG image (IPFS SVG or app OG route). */
  ogImageUrl: string;
  pageUrl: string;
  /** True when debtor identity is redacted in public SEO. */
  isAnonymized: boolean;
}

/**
 * Resolve an IPFS URI (`ipfs://CID` or bare CID) or HTTPS URL to a gateway URL.
 * Returns undefined for invalid / unsafe values.
 */
export function resolveIpfsAssetUrl(
  value: string | undefined | null
): string | undefined {
  if (!value || typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
      return url.toString();
    } catch {
      return undefined;
    }
  }

  if (trimmed.startsWith("ipfs://")) {
    const cid = trimmed.slice("ipfs://".length).split("/")[0];
    if (!isValidCID(cid)) return undefined;
    return `${IPFS_GATEWAY().replace(/\/$/, "")}/${cid}`;
  }

  if (isValidCID(trimmed)) {
    const url = safeIpfsUrl(trimmed, IPFS_GATEWAY());
    return url === "#" ? undefined : url;
  }

  return undefined;
}

/**
 * Public debtor label respecting `debtorPrivacy`.
 * Never returns street addresses or wallet keys.
 */
export function publicDebtorLabel(invoice: Invoice): string {
  const { metadata, debtorPrivacy } = invoice;
  if (debtorPrivacy === "anonymized") {
    return `${CATEGORY_LABELS[metadata.category]}, ${JURISDICTION_NAMES[metadata.jurisdiction]}`;
  }
  return metadata.debtorName;
}

/**
 * Map an Invoice (+ optional IPFS V1 metadata) into privacy-safe SEO fields.
 */
export function buildPublicInvoiceSeo(
  invoice: Invoice,
  ipfsMeta?: InvoiceMetadataV1 | null
): PublicInvoiceSeo {
  const canonicalId = invoice.tokenId || invoice.id;
  const siteUrl = APP_URL().replace(/\/$/, "");
  const isAnonymized = invoice.debtorPrivacy === "anonymized";
  const debtorLabel = publicDebtorLabel(invoice);

  const invoiceNumber =
    ipfsMeta?.invoice_number || invoice.metadata.invoiceNumber;
  const amount = ipfsMeta?.amount ?? invoice.metadata.amount;
  const currency = ipfsMeta?.currency ?? invoice.metadata.currency;
  const dueDate = ipfsMeta?.due_date || invoice.metadata.dueDate;
  const jurisdiction =
    ipfsMeta?.jurisdiction || invoice.metadata.jurisdiction;
  const category = ipfsMeta?.category || invoice.metadata.category;
  const apr = invoice.terms.apr;

  // Prefer IPFS description when present, but strip anything that looks like
  // a private address line (heuristic: long strings with street-like tokens).
  let description =
    (typeof ipfsMeta?.description === "string" && ipfsMeta.description) ||
    invoice.metadata.description ||
    "";
  description = scrubPrivateText(description, invoice);

  if (!description) {
    description = `Invoice NFT marketplace opportunity: ${debtorLabel} invoice of ${formatCurrency(amount, currency)} at ${formatApr(apr)} APR on Stellar Soroban.`;
  }

  // Prefer PNG opengraph-image route for Twitter/Slack crawlers (SVG IPFS is NFT art).
  const ogImageUrl = `${siteUrl}/marketplace/${canonicalId}/opengraph-image`;

  return {
    id: canonicalId,
    invoiceNumber,
    debtorLabel,
    amount,
    currency,
    apr,
    dueDate,
    jurisdiction,
    category,
    riskTier: invoice.riskTier,
    description,
    ogImageUrl,
    pageUrl: `${siteUrl}/marketplace/${canonicalId}`,
    isAnonymized,
  };
}

/**
 * Remove private fields that must never appear in public meta content.
 */
export function scrubPrivateText(text: string, invoice: Invoice): string {
  let out = text;
  const secrets = [
    invoice.metadata.debtorAddress,
    invoice.metadata.issuerAddress,
    invoice.ownerAddress,
  ].filter(Boolean) as string[];

  for (const secret of secrets) {
    if (secret.length >= 8) {
      out = out.split(secret).join("");
    }
  }

  if (invoice.debtorPrivacy === "anonymized") {
    // Avoid leaking the real debtor name when privacy is anonymized
    const name = invoice.metadata.debtorName;
    if (name && out.includes(name)) {
      out = out.split(name).join(publicDebtorLabel(invoice));
    }
  }

  return out.replace(/\s{2,}/g, " ").trim();
}

/**
 * Fetch and validate IPFS InvoiceMetadataV1 for SEO hydration.
 * Returns null in mock mode, on invalid CID, or on any fetch/validation failure.
 */
export async function fetchIpfsMetadataForSeo(
  cid: string | undefined | null
): Promise<InvoiceMetadataV1 | null> {
  if (!cid || !isValidCID(cid)) return null;

  // Mock mode uses local invoice records — skip live IPFS to stay offline-friendly
  if (IS_MOCK_DATA()) {
    return null;
  }

  try {
    const gateway = IPFS_GATEWAY().replace(/\/$/, "");
    const res = await fetch(`${gateway}/${cid}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    // Dynamic import keeps Zod/env out of modules that only need OG helpers.
    const { validateInvoiceMetadata } = await import("@/lib/invoiceMetadata");
    const parsed = validateInvoiceMetadata(raw);
    if (!parsed.success) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

/**
 * Build Next.js Metadata for an invoice detail page.
 */
export function buildInvoicePageMetadata(seo: PublicInvoiceSeo): Metadata {
  const title = `${seo.debtorLabel} Invoice (${formatCurrency(seo.amount, seo.currency)}) — APR ${formatApr(seo.apr)} | ${APP_NAME()}`;
  const description = seo.description.slice(0, 320);

  return {
    title,
    description,
    keywords: [
      seo.invoiceNumber,
      seo.debtorLabel,
      seo.category,
      seo.jurisdiction,
      "invoice NFT",
      "DeFi yield",
      "Stellar Soroban",
      APP_NAME(),
    ].filter(Boolean),
    openGraph: {
      title,
      description,
      url: seo.pageUrl,
      siteName: APP_NAME(),
      type: "website",
      images: [
        {
          url: seo.ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${seo.invoiceNumber} — ${seo.debtorLabel}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [seo.ogImageUrl],
    },
    alternates: {
      canonical: `/marketplace/${seo.id}`,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

/**
 * Convert a marketplace Invoice into a minimal InvoiceMetadataV1 shape
 * suitable for `generateInvoiceSvg` (OG preview). Uses privacy-safe debtor name.
 */
export function invoiceToSvgMetadata(invoice: Invoice): InvoiceMetadataV1 {
  return {
    metadata_version: "1.0",
    name: `Invoice ${invoice.metadata.invoiceNumber}`,
    description: scrubPrivateText(
      invoice.metadata.description ||
        `Tokenized invoice ${invoice.metadata.invoiceNumber}`,
      invoice
    ),
    image: "ipfs://placeholder",
    invoice_number: invoice.metadata.invoiceNumber,
    amount: invoice.metadata.amount,
    currency: invoice.metadata.currency,
    due_date: invoice.metadata.dueDate.slice(0, 10),
    issuer: {
      address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      name: invoice.metadata.issuerName,
    },
    debtor: {
      name: publicDebtorLabel(invoice),
      privacy: invoice.debtorPrivacy,
    },
    jurisdiction: invoice.metadata.jurisdiction,
    category: invoice.metadata.category,
    risk_tier: invoice.riskTier,
    discount_rate: invoice.terms.discountRate,
  };
}

/** Sitemap URL entry for a published invoice. */
export interface InvoiceSitemapEntry {
  path: string;
  lastmod: string;
  changefreq: "hourly" | "daily" | "weekly";
  priority: string;
}

/**
 * Build sitemap entry pattern for invoice detail pages.
 * Only includes publicly listable statuses.
 */
export function buildInvoiceSitemapEntries(
  invoices: Pick<Invoice, "id" | "status" | "updatedAt">[]
): InvoiceSitemapEntry[] {
  const publicStatuses = new Set([
    "listed",
    "partially_funded",
    "fully_funded",
    "active",
    "repaid",
  ]);

  return invoices
    .filter((inv) => publicStatuses.has(inv.status))
    .map((inv) => ({
      path: `/marketplace/${inv.id}`,
      lastmod: (inv.updatedAt || new Date().toISOString()).slice(0, 10),
      changefreq: "daily" as const,
      priority: "0.8",
    }));
}
