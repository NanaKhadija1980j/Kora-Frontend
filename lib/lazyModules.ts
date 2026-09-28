/**
 * Systematic lazy loading for heavy third-party libraries.
 *
 * Problem
 * ───────
 * Three library groups dominate the initial JS bundle:
 *   1. @creit.tech/stellar-wallets-kit  — Stellar wallet adapters (~180 kB gz)
 *   2. recharts                          — chart primitives (~120 kB gz)
 *   3. PDF export (html2canvas + jspdf)  — only used on explicit user action
 *
 * Strategy
 * ─────────
 * Each group is wrapped in a lazy loader that:
 *   • Returns a singleton promise (import() is called at most once per session)
 *   • Is typed so callers never lose type safety
 *   • Can be pre-warmed with `preload*()` helpers when the user signals intent
 *     (e.g. hovering a "Connect Wallet" button)
 *
 * Usage
 * ─────
 *   // Trigger load on demand
 *   const { StellarWalletsKit, FREIGHTER_ID, … } = await loadWalletKit();
 *
 *   // Pre-warm on hover / focus to hide latency
 *   <button onMouseEnter={preloadWalletKit} onClick={handleConnect}>
 *     Connect Wallet
 *   </button>
 */

// ─── 1. Stellar Wallets Kit ───────────────────────────────────────────────────

type WalletKitModule = typeof import("@creit.tech/stellar-wallets-kit");

let _walletKitPromise: Promise<WalletKitModule> | null = null;

/**
 * Lazily loads @creit.tech/stellar-wallets-kit.
 * The promise is cached — repeated calls return the same import.
 */
export function loadWalletKit(): Promise<WalletKitModule> {
  if (!_walletKitPromise) {
    _walletKitPromise = import("@creit.tech/stellar-wallets-kit").catch(
      (err) => {
        // Reset so the next call retries on a transient network failure.
        _walletKitPromise = null;
        throw err;
      }
    );
  }
  return _walletKitPromise;
}

/**
 * Pre-warm the wallet kit bundle without blocking the caller.
 * Safe to call on hover/focus — resolves silently on error.
 */
export function preloadWalletKit(): void {
  loadWalletKit().catch(() => undefined);
}

// ─── 2. Recharts ─────────────────────────────────────────────────────────────

type RechartsModule = typeof import("recharts");

let _rechartsPromise: Promise<RechartsModule> | null = null;

/**
 * Lazily loads the entire recharts module.
 * Use this when you need to construct chart elements programmatically.
 * For JSX-based chart components prefer Next.js `dynamic()` with `ssr: false`
 * (already applied on AnalyticsCharts in app/analytics/page.tsx) — this
 * loader covers imperative / non-React use-cases.
 */
export function loadRecharts(): Promise<RechartsModule> {
  if (!_rechartsPromise) {
    _rechartsPromise = import("recharts").catch((err) => {
      _rechartsPromise = null;
      throw err;
    });
  }
  return _rechartsPromise;
}

/**
 * Pre-warm recharts when the user navigates to or hovers the analytics section.
 */
export function preloadRecharts(): void {
  loadRecharts().catch(() => undefined);
}

// ─── 3. PDF export (html2canvas + jsPDF) ─────────────────────────────────────

interface PdfExportModule {
  html2canvas: typeof import("html2canvas").default;
  jsPDF: typeof import("jspdf").default;
}

let _pdfExportPromise: Promise<PdfExportModule> | null = null;

/**
 * Lazily loads html2canvas and jsPDF in parallel.
 * Both libraries are only needed when the user explicitly triggers PDF export,
 * so they should never appear in the initial bundle.
 */
export function loadPdfExport(): Promise<PdfExportModule> {
  if (!_pdfExportPromise) {
    _pdfExportPromise = Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ])
      .then(([html2canvasMod, jsPDFMod]) => ({
        html2canvas: html2canvasMod.default,
        jsPDF: jsPDFMod.default,
      }))
      .catch((err) => {
        _pdfExportPromise = null;
        throw err;
      });
  }
  return _pdfExportPromise;
}

/**
 * Pre-warm the PDF export bundle when the user hovers an export button.
 */
export function preloadPdfExport(): void {
  loadPdfExport().catch(() => undefined);
}

// ─── 4. Stellar SDK (heavy — only needed for XDR construction) ────────────────

type StellarSdkModule = typeof import("@stellar/stellar-sdk");

let _stellarSdkPromise: Promise<StellarSdkModule> | null = null;

/**
 * Lazily loads @stellar/stellar-sdk.
 * The SDK is large (~400 kB gz) and only needed for transaction signing flows.
 * Pre-warm when the user shows intent to transact (e.g. clicks "Fund Invoice").
 */
export function loadStellarSdk(): Promise<StellarSdkModule> {
  if (!_stellarSdkPromise) {
    _stellarSdkPromise = import("@stellar/stellar-sdk").catch((err) => {
      _stellarSdkPromise = null;
      throw err;
    });
  }
  return _stellarSdkPromise;
}

/**
 * Pre-warm the Stellar SDK when the user signals intent to transact.
 */
export function preloadStellarSdk(): void {
  loadStellarSdk().catch(() => undefined);
}

// ─── Utility: reset all cached promises (useful in tests) ────────────────────

export function _resetLazyModuleCache(): void {
  _walletKitPromise = null;
  _rechartsPromise = null;
  _pdfExportPromise = null;
  _stellarSdkPromise = null;
}
