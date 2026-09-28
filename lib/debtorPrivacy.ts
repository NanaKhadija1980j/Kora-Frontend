/**
 * Debtor Privacy & Masking Helpers — Issue #562
 *
 * Provides centralized privacy enforcement across marketplace cards, list rows,
 * comparison views, and screen reader announcements.
 *
 * Privacy Levels:
 * - "anonymized": Protects all debtor PII. Shows industry category moniker and jurisdiction (e.g. "Technology Company, Kenya").
 * - "partial": Displays debtor legal name, but masks street address (e.g. "Address hidden · Kenya").
 * - "full": Displays full debtor company name and street address.
 *
 * Post-Fund Reveal:
 * - Once an investor funds an invoice (`isFunded = true`), effective privacy elevates to "full" to allow legitimate contract verification.
 */

import type { Invoice, InvoiceJurisdiction, InvoiceCategory, DebtorPrivacyLevel } from "@/types/invoice";

export const JURISDICTION_NAMES: Record<InvoiceJurisdiction, string> = {
  US: "United States",
  EU: "European Union",
  UK: "United Kingdom",
  NG: "Nigeria",
  KE: "Kenya",
  GH: "Ghana",
  ZA: "South Africa",
  OTHER: "International",
};

export const CATEGORY_DESCRIPTORS: Record<InvoiceCategory, string> = {
  technology: "Technology Company",
  manufacturing: "Manufacturing Company",
  logistics: "Logistics Company",
  healthcare: "Healthcare Provider",
  retail: "Retail Company",
  construction: "Construction Company",
  agriculture: "Agribusiness",
  energy: "Energy Provider",
  finance: "Financial Services",
  other: "Commercial Enterprise",
};

/**
 * Resolves effective privacy level taking post-funding reveal into account.
 */
export function getEffectiveDebtorPrivacy(
  invoice: Partial<Invoice>,
  isFunded = false
): DebtorPrivacyLevel {
  if (isFunded) return "full";
  return invoice.debtorPrivacy || "anonymized";
}

/**
 * Returns privacy-safe debtor display name.
 * Under "anonymized", returns generic industry moniker without leaking raw company name.
 */
export function getMaskedDebtorName(
  invoice: Partial<Invoice>,
  isFunded = false
): string {
  const effectivePrivacy = getEffectiveDebtorPrivacy(invoice, isFunded);
  const metadata = invoice.metadata;

  if (effectivePrivacy === "anonymized" || !metadata) {
    const category = (metadata?.category as InvoiceCategory) || "other";
    const jurisdiction = (metadata?.jurisdiction as InvoiceJurisdiction) || "OTHER";
    const categoryDesc = CATEGORY_DESCRIPTORS[category] || "Commercial Enterprise";
    const jurisdictionName = JURISDICTION_NAMES[jurisdiction] || jurisdiction;
    return `${categoryDesc} (${jurisdictionName})`;
  }

  return metadata.debtorName || "Debtor";
}

/**
 * Returns privacy-safe debtor address line.
 */
export function getMaskedDebtorAddress(
  invoice: Partial<Invoice>,
  isFunded = false
): string {
  const effectivePrivacy = getEffectiveDebtorPrivacy(invoice, isFunded);
  const metadata = invoice.metadata;

  if (!metadata) return "";

  if (effectivePrivacy === "full") {
    return metadata.debtorAddress || "";
  }

  if (effectivePrivacy === "partial") {
    const jurisdiction = (metadata.jurisdiction as InvoiceJurisdiction) || "OTHER";
    const country = JURISDICTION_NAMES[jurisdiction] || jurisdiction;
    return `Address hidden · ${country}`;
  }

  return "Identity anonymized for privacy";
}

/**
 * Returns privacy-safe ARIA label string for cards and comparisons.
 */
export function getDebtorAriaLabel(
  invoice: Partial<Invoice>,
  isFunded = false
): string {
  const effectivePrivacy = getEffectiveDebtorPrivacy(invoice, isFunded);
  const maskedName = getMaskedDebtorName(invoice, isFunded);

  if (effectivePrivacy === "full") {
    return `Debtor: ${maskedName} (Full disclosure)`;
  }
  if (effectivePrivacy === "partial") {
    return `Debtor: ${maskedName} (Partial disclosure)`;
  }
  return `Debtor: ${maskedName} (Anonymized for privacy)`;
}

/**
 * Masking validation helpers
 */
export function isDebtorAnonymized(invoice: Partial<Invoice>, isFunded = false): boolean {
  return getEffectiveDebtorPrivacy(invoice, isFunded) === "anonymized";
}

export function isDebtorPartial(invoice: Partial<Invoice>, isFunded = false): boolean {
  return getEffectiveDebtorPrivacy(invoice, isFunded) === "partial";
}

export function isDebtorFull(invoice: Partial<Invoice>, isFunded = false): boolean {
  return getEffectiveDebtorPrivacy(invoice, isFunded) === "full";
}
