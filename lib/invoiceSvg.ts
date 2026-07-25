/**
 * SVG invoice preview generator.
 *
 * Generates a deterministic, self-contained SVG image that serves as the
 * NFT image for invoice tokens. The SVG is uploaded to IPFS and its CID
 * is stored in the `image` field of InvoiceMetadataV1.
 *
 * Design goals:
 *  - No external dependencies (pure string generation)
 *  - Deterministic output for the same inputs
 *  - Readable at thumbnail sizes (256×256) and full size (800×600)
 *  - Accessible: includes title and desc elements
 *
 * Closes #121
 */

import type { InvoiceMetadataV1 } from "./invoiceMetadata";

// ─── Colour palette ───────────────────────────────────────────────────────────

const PALETTE = {
  bg: "#09090b",           // zinc-950
  surface: "#18181b",      // zinc-900
  border: "#27272a",       // zinc-800
  primary: "#38bdf8",      // sky-400 (Kora brand)
  primaryMuted: "#0c4a6e", // sky-900
  text: "#f4f4f5",         // zinc-100
  textMuted: "#a1a1aa",    // zinc-400
  textSubtle: "#71717a",   // zinc-500
  success: "#22c55e",      // green-500
  warning: "#f59e0b",      // amber-500
  danger: "#ef4444",       // red-500
} as const;

/** Risk tier → accent colour mapping */
const RISK_COLORS: Record<string, string> = {
  AAA: "#34d399", // emerald-400
  AA: "#2dd4bf",  // teal-400
  A: "#22d3ee",   // cyan-400
  BBB: "#fbbf24", // amber-400
  BB: "#fb923c",  // orange-400
  B: "#f87171",   // red-400
  CCC: "#dc2626", // red-600
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const XML_ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/**
 * Escape XML special characters in a single regex pass.
 * Five sequential .replace() calls (one per character class) were replaced with
 * one pass using a character-class union and a lookup table, which measurably
 * reduces allocations and scan cost on longer strings.
 */
function escapeXml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => XML_ESC[c]);
}

/** Truncate a string to maxLen characters, appending "…" if truncated. */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

/** Format a number as a compact currency string (e.g. "$1.2M USDC"). */
function formatAmount(amount: number, currency: string): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M ${currency}`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(1)}K ${currency}`;
  }
  return `$${amount.toFixed(2)} ${currency}`;
}

/** Format a YYYY-MM-DD date string as "Jan 1, 2025". */
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00Z");
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}

// ─── SVG Generator ────────────────────────────────────────────────────────────

export interface SvgGeneratorOptions {
  /** Width in pixels (default: 800) */
  width?: number;
  /** Height in pixels (default: 600) */
  height?: number;
}

/**
 * Generate a self-contained SVG invoice preview for use as an NFT image.
 *
 * The SVG includes:
 *  - Kora Protocol branding header
 *  - Invoice number and debtor name
 *  - Amount, currency, and due date
 *  - Risk tier badge (colour-coded)
 *  - Jurisdiction and category tags
 *  - Discount rate (if provided)
 *  - IPFS document CID (truncated, for verification)
 *  - Decorative background elements
 *
 * @param metadata - Validated InvoiceMetadataV1 object
 * @param options  - Optional width/height overrides
 * @returns SVG string (UTF-8, no BOM)
 */
export function generateInvoiceSvg(
  metadata: InvoiceMetadataV1,
  options: SvgGeneratorOptions = {}
): string {
  const W = options.width ?? 800;
  const H = options.height ?? 600;

  const riskColor = metadata.risk_tier
    ? (RISK_COLORS[metadata.risk_tier] ?? PALETTE.primary)
    : PALETTE.primary;

  const debtorName = escapeXml(truncate(metadata.debtor.name, 40));
  const invoiceNumber = escapeXml(metadata.invoice_number);
  const amountStr = escapeXml(formatAmount(metadata.amount, metadata.currency));
  const dueDateStr = escapeXml(formatDate(metadata.due_date));
  const issuerName = escapeXml(
    truncate(metadata.issuer.name ?? metadata.issuer.address, 36)
  );
  const jurisdiction = metadata.jurisdiction
    ? escapeXml(metadata.jurisdiction)
    : "";
  const category = metadata.category
    ? escapeXml(metadata.category.charAt(0).toUpperCase() + metadata.category.slice(1))
    : "";
  const discountRateStr =
    metadata.discount_rate !== undefined
      ? `${(metadata.discount_rate * 100).toFixed(1)}%`
      : null;
  const docCid = metadata.ipfs_document_cid
    ? escapeXml(
        metadata.ipfs_document_cid.slice(0, 8) +
          "…" +
          metadata.ipfs_document_cid.slice(-6)
      )
    : null;

  // Unique gradient IDs to avoid collisions when multiple SVGs are inlined
  const gradId = `kg-${metadata.invoice_number.replace(/[^a-zA-Z0-9]/g, "")}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="${gradId}-title ${gradId}-desc">
  <title id="${gradId}-title">Invoice ${invoiceNumber} — ${debtorName}</title>
  <desc id="${gradId}-desc">Kora Protocol invoice NFT for ${amountStr} due ${dueDateStr}</desc>

  <defs>
    <!-- Background gradient -->
    <linearGradient id="${gradId}-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${PALETTE.bg}" />
      <stop offset="100%" stop-color="#0f0f12" />
    </linearGradient>
    <!-- Primary accent gradient -->
    <linearGradient id="${gradId}-accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${riskColor}" stop-opacity="0.8" />
      <stop offset="100%" stop-color="${PALETTE.primary}" stop-opacity="0.6" />
    </linearGradient>
    <!-- Glow filter -->
    <filter id="${gradId}-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <!-- Clip path for rounded card -->
    <clipPath id="${gradId}-clip">
      <rect width="${W}" height="${H}" rx="16" ry="16" />
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#${gradId}-bg)" rx="16" ry="16" />

  <!-- Decorative glow orbs -->
  <circle cx="${W * 0.85}" cy="${H * 0.15}" r="${W * 0.18}" fill="${riskColor}" opacity="0.06" filter="url(#${gradId}-glow)" />
  <circle cx="${W * 0.1}" cy="${H * 0.85}" r="${W * 0.14}" fill="${PALETTE.primary}" opacity="0.05" filter="url(#${gradId}-glow)" />

  <!-- Top accent bar -->
  <rect x="0" y="0" width="${W}" height="4" fill="url(#${gradId}-accent)" rx="2" />

  <!-- Header section -->
  <rect x="32" y="24" width="${W - 64}" height="72" rx="10" fill="${PALETTE.surface}" opacity="0.7" />

  <!-- Kora logo mark (stylised "K") -->
  <g transform="translate(52, 44)">
    <rect width="28" height="28" rx="6" fill="${PALETTE.primaryMuted}" />
    <text x="14" y="20" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" fill="${PALETTE.primary}" text-anchor="middle">K</text>
  </g>

  <!-- "Kora Protocol" label -->
  <text x="92" y="54" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600" fill="${PALETTE.text}" letter-spacing="0.5">Kora Protocol</text>
  <text x="92" y="72" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="${PALETTE.textSubtle}" letter-spacing="1">INVOICE NFT</text>

  <!-- Invoice number (top right) -->
  <text x="${W - 48}" y="54" font-family="ui-monospace, monospace" font-size="11" fill="${PALETTE.textMuted}" text-anchor="end">${invoiceNumber}</text>
  <text x="${W - 48}" y="72" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="${PALETTE.textSubtle}" text-anchor="end" letter-spacing="0.5">v${metadata.metadata_version}</text>

  <!-- Divider -->
  <line x1="32" y1="112" x2="${W - 32}" y2="112" stroke="${PALETTE.border}" stroke-width="1" />

  <!-- Debtor name (large) -->
  <text x="48" y="152" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="700" fill="${PALETTE.text}">${debtorName}</text>
  <text x="48" y="174" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="${PALETTE.textSubtle}">DEBTOR</text>

  <!-- Amount (hero) -->
  <text x="${W - 48}" y="152" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="800" fill="${PALETTE.text}" text-anchor="end">${amountStr}</text>
  <text x="${W - 48}" y="174" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="${PALETTE.textSubtle}" text-anchor="end">INVOICE AMOUNT</text>

  <!-- Divider -->
  <line x1="32" y1="196" x2="${W - 32}" y2="196" stroke="${PALETTE.border}" stroke-width="1" />

  <!-- Info grid row 1 -->
  <!-- Due Date -->
  <text x="48" y="228" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="${PALETTE.textSubtle}" letter-spacing="1">DUE DATE</text>
  <text x="48" y="248" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="600" fill="${PALETTE.text}">${dueDateStr}</text>

  <!-- Issuer -->
  <text x="${W / 2}" y="228" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="${PALETTE.textSubtle}" letter-spacing="1" text-anchor="middle">ISSUER</text>
  <text x="${W / 2}" y="248" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="500" fill="${PALETTE.text}" text-anchor="middle">${issuerName}</text>

  <!-- Discount Rate / Risk Tier -->
  ${
    discountRateStr
      ? `<text x="${W - 48}" y="228" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="${PALETTE.textSubtle}" letter-spacing="1" text-anchor="end">DISCOUNT RATE</text>
  <text x="${W - 48}" y="248" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="600" fill="${PALETTE.success}" text-anchor="end">${discountRateStr}</text>`
      : ""
  }

  <!-- Divider -->
  <line x1="32" y1="272" x2="${W - 32}" y2="272" stroke="${PALETTE.border}" stroke-width="1" />

  <!-- Tags row -->
  ${buildTagsSvg(jurisdiction, category, metadata.risk_tier, riskColor, W)}

  <!-- IPFS document CID (bottom) -->
  ${
    docCid
      ? `<rect x="32" y="${H - 72}" width="${W - 64}" height="36" rx="8" fill="${PALETTE.surface}" opacity="0.6" />
  <text x="52" y="${H - 50}" font-family="system-ui, -apple-system, sans-serif" font-size="9" fill="${PALETTE.textSubtle}" letter-spacing="0.5">IPFS DOCUMENT</text>
  <text x="52" y="${H - 38}" font-family="ui-monospace, monospace" font-size="10" fill="${PALETTE.primary}">${docCid}</text>`
      : ""
  }

  <!-- Bottom border accent -->
  <rect x="0" y="${H - 4}" width="${W}" height="4" fill="url(#${gradId}-accent)" rx="2" />
</svg>`;
}

/** Build the SVG for the tags row (jurisdiction, category, risk tier). */
function buildTagsSvg(
  jurisdiction: string,
  category: string,
  riskTier: string | undefined,
  riskColor: string,
  W: number
): string {
  const tags: Array<{ label: string; color: string; bg: string }> = [];

  if (jurisdiction) {
    tags.push({ label: jurisdiction, color: PALETTE.textMuted, bg: PALETTE.surface });
  }
  if (category) {
    tags.push({ label: category, color: PALETTE.textMuted, bg: PALETTE.surface });
  }
  if (riskTier) {
    tags.push({ label: `Tier ${riskTier}`, color: riskColor, bg: `${riskColor}18` });
  }

  if (tags.length === 0) return "";

  const TAG_H = 24;
  const TAG_PAD_X = 10;
  const TAG_GAP = 8;
  const CHAR_W = 7.5;
  const Y = 292;

  let x = 48;
  let out = "";

  for (const tag of tags) {
    const tagW = tag.label.length * CHAR_W + TAG_PAD_X * 2;
    out += `\n    <rect x="${x}" y="${Y}" width="${tagW}" height="${TAG_H}" rx="6" fill="${tag.bg}" stroke="${tag.color}" stroke-width="0.5" stroke-opacity="0.4" />` +
      `\n    <text x="${x + tagW / 2}" y="${Y + 15}" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" fill="${tag.color}" text-anchor="middle" letter-spacing="0.3">${escapeXml(tag.label)}</text>`;
    x += tagW + TAG_GAP;
    if (x > W - 48) break;
  }

  return out;
}

// ─── Blob / File helpers ──────────────────────────────────────────────────────

/**
 * Convert an SVG string to a File object suitable for upload via FormData.
 *
 * @param svg      - SVG string from generateInvoiceSvg()
 * @param filename - Desired filename (default: "invoice-preview.svg")
 */
export function svgToFile(svg: string, filename = "invoice-preview.svg"): File {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  return new File([blob], filename, { type: "image/svg+xml" });
}

/**
 * Convert an SVG string to a data URI.
 * Useful for embedding in HTML without a separate network request.
 */
export function svgToDataUri(svg: string): string {
  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}
