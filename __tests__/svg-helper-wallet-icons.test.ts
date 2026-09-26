/**
 * Wallet icon SVG helper (issue #816).
 *
 * The icons are inlined as raw SVG rather than shipped as image files, so the
 * things worth pinning are: every wallet the app claims to support resolves to
 * a real, inlineable SVG; every wallet has its own artwork; nothing resolves
 * for an ID we do not recognise (a `null` the caller can branch on); and the
 * markup stays inside the sub-1KB budget the module documents.
 */

import { describe, expect, it, vi } from "vitest";

import { getWalletIconSvg, sanitizeSvg } from "@/lib/svgHelper";

/** The wallets `lib/walletAssets` / the connect modal present to a user. */
const KNOWN_WALLET_IDS = ["freighter", "xbull", "lobstr", "albedo"];

const SVG_OPEN = "<svg ";
const SVG_CLOSE = "</svg>";
const SVG_MAX_BYTES = 1024;

describe("getWalletIconSvg", () => {
  it.each(KNOWN_WALLET_IDS)("returns an inlineable SVG for %s", (walletId) => {
    const svg = getWalletIconSvg(walletId);

    expect(svg).not.toBeNull();
    expect(svg!.startsWith(SVG_OPEN)).toBe(true);
    expect(svg!.endsWith(SVG_CLOSE)).toBe(true);
  });

  it.each(KNOWN_WALLET_IDS)("gives %s a namespaced root so it renders inline", (walletId) => {
    expect(getWalletIconSvg(walletId)).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it.each(KNOWN_WALLET_IDS)("keeps the %s logo inside the 1KB inline budget", (walletId) => {
    const svg = getWalletIconSvg(walletId)!;

    expect(svg.length).toBeLessThan(SVG_MAX_BYTES);
  });

  it("gives every wallet its own artwork", () => {
    const icons = KNOWN_WALLET_IDS.map((walletId) => getWalletIconSvg(walletId));

    expect(new Set(icons).size).toBe(KNOWN_WALLET_IDS.length);
  });

  it("returns null for an unrecognised wallet ID", () => {
    expect(getWalletIconSvg("not-a-real-wallet")).toBeNull();
  });

  it("returns null for an empty ID rather than falling back to a default icon", () => {
    expect(getWalletIconSvg("")).toBeNull();
  });

  it("does not match wallet IDs by prefix or case", () => {
    // The lookup is exact; a looser match would hand one wallet's logo to another.
    expect(getWalletIconSvg("Freighter")).toBeNull();
    expect(getWalletIconSvg("freighter ")).toBeNull();
    expect(getWalletIconSvg("freighter-extra")).toBeNull();
  });
});

describe("sanitizeSvg", () => {
  it("returns the markup untouched on the server so hydration matches", () => {
    // Server renders have no DOMPurify; passing the string through unchanged is
    // what keeps the server and client markup identical on first paint.
    const svg = getWalletIconSvg("freighter")!;
    vi.stubGlobal("window", undefined);

    try {
      expect(sanitizeSvg(svg)).toBe(svg);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
