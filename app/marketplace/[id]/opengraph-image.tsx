/**
 * Dynamic Open Graph image for invoice detail pages.
 * Renders a crawler-friendly PNG preview from the same invoice SVG metadata
 * pipeline used for NFT images (invoiceSvg / invoiceToSvgMetadata).
 *
 * Closes #375 / #383
 */

import { ImageResponse } from "next/og";
import { fetchInvoiceById } from "@/services/invoiceService";
import { validateRouteId } from "@/lib/security";
import { invoiceToSvgMetadata } from "@/lib/invoiceSeo";

export const runtime = "nodejs";
export const alt = "Kora Protocol Invoice";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

type Props = {
  params: Promise<{ id: string }>;
};

export default async function OpenGraphImage({ params }: Props) {
  const { id } = await params;
  const safeId = validateRouteId(id);

  let title = "Kora Protocol";
  let subtitle = "Invoice Financing on Stellar";
  let amount = "";
  let apr = "";
  let risk = "";
  let due = "";

  if (safeId) {
    try {
      const invoice = await fetchInvoiceById(safeId);
      if (invoice) {
        const meta = invoiceToSvgMetadata(invoice);
        title = meta.invoice_number || title;
        subtitle = meta.debtor?.name || subtitle;
        amount = `${meta.currency} ${Number(meta.amount).toLocaleString()}`;
        apr = `${invoice.terms.apr}% APR`;
        risk = meta.risk_tier || "";
        due = meta.due_date ? `Due ${meta.due_date}` : "";
      }
    } catch {
      // keep fallback copy
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#09090b",
          color: "#f4f4f5",
          padding: "64px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 28, color: "#38bdf8", fontWeight: 700 }}>Kora</div>
            <div style={{ fontSize: 18, color: "#a1a1aa" }}>Invoice Financing</div>
          </div>
          {risk ? (
            <div
              style={{
                display: "flex",
                padding: "10px 18px",
                borderRadius: 999,
                border: "1px solid #27272a",
                background: "#18181b",
                fontSize: 22,
                color: "#22d3ee",
                fontWeight: 700,
              }}
            >
              {risk}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
          <div style={{ fontSize: 28, color: "#a1a1aa" }}>{subtitle}</div>
        </div>

        <div style={{ display: "flex", gap: 40, alignItems: "flex-end" }}>
          {amount ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 16, color: "#71717a", textTransform: "uppercase" }}>Face Value</div>
              <div style={{ fontSize: 36, fontWeight: 700 }}>{amount}</div>
            </div>
          ) : null}
          {apr ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 16, color: "#71717a", textTransform: "uppercase" }}>Yield</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#38bdf8" }}>{apr}</div>
            </div>
          ) : null}
          {due ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 16, color: "#71717a", textTransform: "uppercase" }}>Maturity</div>
              <div style={{ fontSize: 28, fontWeight: 600 }}>{due}</div>
            </div>
          ) : null}
        </div>
      </div>
    ),
    { ...size }
  );
}
