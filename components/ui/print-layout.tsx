"use client";

/**
 * PrintLayout — invoice print / PDF export wrapper (#567).
 *
 * Polished print stylesheet covering:
 *  - App chrome (nav, wallet bar, overlays, fund panel) hidden
 *  - Dark-mode colours reset to print-safe black-on-white
 *  - SVG invoice preview rendered correctly (no display:none, explicit dims)
 *  - Key terms and amounts in B&W readable monospace
 *  - Page-break rules so tables and progress bars stay together
 *  - Chromium print preview validated layout
 *
 * ## How to print from the UI
 * 1. Open an invoice detail page.
 * 2. Click "Print / Save PDF" in the top-right action bar.
 * 3. In the browser print dialog choose "Save as PDF" (Chromium) or
 *    "Microsoft Print to PDF" (Windows), then Save.
 *
 * Closes #567
 */

import * as React from "react";
import { cn } from "@/lib/utils";

// ─── Print style injection ────────────────────────────────────────────────────

/**
 * Comprehensive print stylesheet injected once per page mount.
 *
 * Design decisions:
 *  - `@media print` resets only the properties we need; existing Tailwind
 *    `print:` variants remain respected.
 *  - `color-adjust: exact` / `print-color-adjust: exact` keeps coloured risk
 *    badges legible when the browser would otherwise discard background fills.
 *  - SVG elements get explicit width/height so Chromium does not collapse them.
 *  - `break-inside: avoid` on table rows and card containers prevents a terms
 *    row from being orphaned at the bottom of a page.
 *  - The funding panel (`[data-print-hide]`) and all interactive chrome are
 *    hidden with `!important` to override Tailwind utilities.
 */
const PRINT_STYLES = `
@media print {
  /* ── App chrome ─────────────────────────────────────────────── */
  nav,
  header,
  footer,
  [data-print-hide],
  [data-print="hidden"],
  .print\\:hidden,
  .no-print,
  button:not([data-print="show"]) {
    display: none !important;
  }

  /* ── Page setup ─────────────────────────────────────────────── */
  @page {
    margin: 18mm 15mm;
  }

  html,
  body {
    background: #ffffff !important;
    color: #000000 !important;
    font-size: 11pt !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Layout reset ───────────────────────────────────────────── */
  .print-layout {
    display: block !important;
    max-width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  /* ── Print header ───────────────────────────────────────────── */
  .print-header {
    display: block !important;
    margin-bottom: 16pt;
    padding-bottom: 8pt;
    border-bottom: 1pt solid #cccccc;
  }

  /* ── Cards → plain bordered boxes ──────────────────────────── */
  .card,
  [class*="Card"],
  [class*="card"] {
    border: 1pt solid #cccccc !important;
    box-shadow: none !important;
    background: #ffffff !important;
    color: #000000 !important;
    break-inside: avoid;
    page-break-inside: avoid;
    border-radius: 0 !important;
  }

  /* ── Tables ─────────────────────────────────────────────────── */
  table {
    width: 100% !important;
    border-collapse: collapse !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  table th,
  table td {
    border: 1pt solid #cccccc !important;
    padding: 4pt 6pt !important;
    color: #000000 !important;
    background: #ffffff !important;
    font-size: 9pt !important;
  }

  table tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* ── Key amounts in monospace for clarity ───────────────────── */
  [data-print-value],
  .print-amount {
    font-family: "Courier New", Courier, monospace !important;
    font-weight: 700 !important;
    color: #000000 !important;
  }

  /* ── Risk badges — keep background for colour context ──────── */
  [class*="RiskBadge"],
  [data-risk-badge] {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    border: 1pt solid #cccccc !important;
  }

  /* ── SVG invoice preview ────────────────────────────────────── */
  svg {
    display: block !important;
    width: 100% !important;
    height: auto !important;
    max-width: 560pt !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Wrapper that may be hidden due to dark background */
  [class*="invoice-preview"],
  [class*="svgPreview"],
  .svg-preview {
    display: block !important;
    background: #f9f9f9 !important;
    border: 1pt solid #cccccc !important;
    padding: 8pt !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* ── Funding progress bar ───────────────────────────────────── */
  [role="progressbar"] {
    break-inside: avoid;
    page-break-inside: avoid;
    border: 1pt solid #cccccc !important;
    background: #eeeeee !important;
  }

  /* ── Recharts / analytics charts ───────────────────────────── */
  .recharts-wrapper {
    break-inside: avoid;
    page-break-inside: avoid;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* ── iframes (PDF preview) — hide entirely in print ────────── */
  iframe {
    display: none !important;
  }

  /* ── Links: show URL inline for traceability ────────────────── */
  a[href]::after {
    content: " (" attr(href) ")";
    font-size: 8pt;
    color: #666666;
  }
  /* Suppress for icon-only / decorative links */
  a[href^="#"]::after,
  a[data-no-print-url]::after {
    content: none;
  }

  /* ── Page break helpers ─────────────────────────────────────── */
  .page-break-before {
    break-before: page;
    page-break-before: always;
  }

  .page-break-after {
    break-after: page;
    page-break-after: always;
  }

  .break-inside-avoid {
    break-inside: avoid;
    page-break-inside: avoid;
  }
}
`;

function usePrintStyles() {
  React.useEffect(() => {
    const id = "kora-print-styles-v2";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = PRINT_STYLES;
    document.head.appendChild(el);
    // Remove old v1 styles if present
    document.getElementById("kora-print-styles")?.remove();
    return () => el.remove();
  }, []);
}

// ─── Components ───────────────────────────────────────────────────────────────

interface PrintLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
}

/**
 * PrintLayout — wraps invoice detail content in a print-friendly container.
 *
 * Renders an invisible-on-screen header (`print-header`) containing the
 * invoice number and debtor name, which becomes visible in print/PDF output.
 * The `data-print-hide` attribute on sibling elements (fund panel, nav) tells
 * the print CSS to hide them.
 */
export function PrintLayout({ children, title, subtitle, className }: PrintLayoutProps) {
  usePrintStyles();
  return (
    <div className={cn("print-layout", className)}>
      {(title || subtitle) && (
        <div className="print-header hidden print:block mb-6 border-b border-gray-200 pb-4">
          {title && (
            <h1 className="text-xl font-bold text-gray-900 print-amount">{title}</h1>
          )}
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            Kora Protocol · Generated:{" "}
            {new Date().toLocaleDateString("en-US", { dateStyle: "long" })}
          </p>
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Print button ─────────────────────────────────────────────────────────────

interface PrintButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onBeforePrint?: () => void;
  label?: string;
}

/**
 * PrintButton — triggers `window.print()`.
 *
 * Hidden in print output via `print:hidden` (Tailwind) so it doesn't appear
 * in the saved PDF. The button is also `data-print="hidden"` for the CSS rule.
 *
 * ## Usage
 * ```tsx
 * <PrintButton label="Print / Save PDF" />
 * ```
 */
export function PrintButton({
  onBeforePrint,
  label = "Print",
  className,
  ...props
}: PrintButtonProps) {
  const handlePrint = () => {
    onBeforePrint?.();
    window.print();
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      data-print="hidden"
      aria-label={label}
      className={cn(
        "print:hidden inline-flex items-center gap-2 rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors",
        className
      )}
      {...props}
    >
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
        />
      </svg>
      {label}
    </button>
  );
}
