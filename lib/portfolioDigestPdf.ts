/**
 * jsPDF adapter for the portfolio digest (issue #602).
 *
 * Kept apart from `portfolioDigest.ts` on purpose: that module composes the
 * document as plain data and is fully unit-tested, while this one only draws
 * it. Nothing here decides *what* goes in the PDF, so the redaction rules
 * cannot be bypassed by a rendering change.
 *
 * Text is laid out directly rather than screenshotting the DOM with
 * html2canvas (as `lib/export.ts` does): a digest is meant to be read and
 * searched, and a rasterised screenshot has no selectable text, no accessible
 * structure, and balloons the file size.
 */

import type { DigestDocument } from "@/lib/portfolioDigest";

const MARGIN = 14;
const LINE = 6;
const BRAND = { r: 20, g: 184, b: 166 }; // teal-500, matching the app accent

export interface RenderDigestOptions {
  /** Filename without extension. */
  filename: string;
}

/**
 * Render the digest and trigger a download.
 *
 * jspdf is imported dynamically so it never enters the server bundle — the
 * analytics page is a client component but is still prerendered.
 */
export async function renderDigestPdf(
  doc: DigestDocument,
  { filename }: RenderDigestOptions
): Promise<void> {
  const { default: JsPDF } = await import("jspdf");
  const pdf = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let y = MARGIN;

  /** Start a new page when the next block would overflow. */
  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - MARGIN) {
      pdf.addPage();
      y = MARGIN;
    }
  };

  // ── Branded header ────────────────────────────────────────────────────────
  pdf.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.rect(0, 0, pageWidth, 22, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text(doc.title, MARGIN, 12);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(doc.subtitle, MARGIN, 18);
  y = 30;

  pdf.setTextColor(60, 60, 60);
  pdf.setFontSize(9);
  pdf.text(`Generated ${doc.generatedAt.slice(0, 10)}`, MARGIN, y);
  y += LINE;
  pdf.text(doc.filterSummary, MARGIN, y);
  y += LINE * 1.5;

  // ── Summary sections ──────────────────────────────────────────────────────
  for (const section of doc.sections) {
    ensureSpace(LINE * (section.rows.length + 2));

    pdf.setTextColor(20, 20, 20);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text(section.heading, MARGIN, y);
    y += LINE;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    for (const [label, value] of section.rows) {
      pdf.setTextColor(90, 90, 90);
      pdf.text(label, MARGIN, y);
      pdf.setTextColor(20, 20, 20);
      pdf.text(String(value), pageWidth - MARGIN, y, { align: "right" });
      y += LINE;
    }
    y += LINE * 0.5;
  }

  // ── Position table ────────────────────────────────────────────────────────
  if (doc.tableHeaders.length > 0) {
    ensureSpace(LINE * 3);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(20, 20, 20);
    pdf.text("Positions", MARGIN, y);
    y += LINE;

    const usable = pageWidth - MARGIN * 2;
    const colWidth = usable / doc.tableHeaders.length;

    const writeHeaderRow = () => {
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(90, 90, 90);
      doc.tableHeaders.forEach((header, i) => {
        pdf.text(String(header), MARGIN + i * colWidth, y, { maxWidth: colWidth - 2 });
      });
      y += LINE * 0.8;
      pdf.setDrawColor(220, 220, 220);
      pdf.line(MARGIN, y - 3, pageWidth - MARGIN, y - 3);
    };

    writeHeaderRow();

    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(40, 40, 40);
    for (const row of doc.tableRows) {
      if (y + LINE > pageHeight - MARGIN - LINE * 2) {
        pdf.addPage();
        y = MARGIN;
        writeHeaderRow();
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(40, 40, 40);
      }
      row.forEach((cell, i) => {
        pdf.text(String(cell ?? ""), MARGIN + i * colWidth, y, {
          maxWidth: colWidth - 2,
        });
      });
      y += LINE * 0.8;
    }
  }

  // ── Disclaimer ────────────────────────────────────────────────────────────
  ensureSpace(LINE * 3);
  y += LINE;
  pdf.setFontSize(7);
  pdf.setTextColor(130, 130, 130);
  pdf.text(doc.disclaimer, MARGIN, y, { maxWidth: pageWidth - MARGIN * 2 });

  pdf.save(`${filename}.pdf`);
}
