/**
 * Dynamic Open Graph image for invoice detail pages.
 * Serves a privacy-safe SVG invoice preview (same generator used for NFT images).
 *
 * Closes #375
 */

import { fetchInvoiceById } from "@/services/invoiceService";
import { validateRouteId } from "@/lib/security";
import { generateInvoiceSvg } from "@/lib/invoiceSvg";
import { invoiceToSvgMetadata } from "@/lib/invoiceSeo";

export const runtime = "nodejs";
export const alt = "Kora Protocol Invoice";
export const size = { width: 1200, height: 630 };
export const contentType = "image/svg+xml";
export const revalidate = 3600;

type Props = {
  params: Promise<{ id: string }>;
};

const FALLBACK_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#09090b"/>
  <text x="600" y="300" fill="#f4f4f5" font-family="system-ui,sans-serif" font-size="48" text-anchor="middle">Kora Protocol</text>
  <text x="600" y="360" fill="#a1a1aa" font-family="system-ui,sans-serif" font-size="24" text-anchor="middle">Invoice Financing on Stellar</text>
</svg>`;

export default async function OpenGraphImage({ params }: Props) {
  const { id } = await params;
  const safeId = validateRouteId(id);

  let svg = FALLBACK_SVG;

  if (safeId) {
    try {
      const invoice = await fetchInvoiceById(safeId);
      if (invoice) {
        const meta = invoiceToSvgMetadata(invoice);
        svg = generateInvoiceSvg(meta, { width: 1200, height: 630 });
      }
    } catch {
      // keep fallback
    }
  }

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
