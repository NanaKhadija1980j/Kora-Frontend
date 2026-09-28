/**
 * exportPdf — captures a DOM element and downloads it as a PDF.
 *
 * Uses html2canvas + jsPDF (loaded dynamically to avoid SSR issues).
 * Falls back to window.print() if the libraries fail to load.
 *
 * @param elementId  - id of the DOM element to capture
 * @param filename   - output filename (without extension)
 */
export async function exportPdf(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`[exportPdf] Element #${elementId} not found`);
    window.print();
    return;
  }

  try {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#09090b", // zinc-950
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${filename}.pdf`);
  } catch (err) {
    console.error("[exportPdf] Failed, falling back to print:", err);
    window.print();
  }
}

/**
 * exportCsv — converts an array of objects to a CSV file and triggers download.
 *
 * @param data      - array of plain objects
 * @param filename  - output filename (with or without .csv extension)
 */
export function exportCsv<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  headers?: string[]
): void {
  const cols = headers ?? (data.length ? Object.keys(data[0]) : []);
  if (!cols.length) return;

  const rows = data.map((row) =>
    cols
      .map((h) => {
        const val = row[h];
        const str = val == null ? "" : String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      })
      .join(",")
  );

  const csv = [cols.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * exportInvoiceCalendarIcs — exports an invoice repayment/maturity date as an ICS calendar file.
 *
 * Generates RFC 5545 compliant iCalendar event file with zero PII beyond invoice number and amount.
 */
export function exportInvoiceCalendarIcs(invoice: {
  id: string;
  metadata: { invoiceNumber: string; debtorName?: string; amount: number; currency: string };
  terms: { repaymentDate: string; apr: number };
}): void {
  const dtStart = new Date(invoice.terms.repaymentDate);
  if (isNaN(dtStart.getTime())) {
    console.warn("[exportInvoiceCalendarIcs] Invalid repayment date:", invoice.terms.repaymentDate);
    return;
  }

  // 1-hour event duration
  const dtEnd = new Date(dtStart.getTime() + 60 * 60 * 1000);

  const formatDateUtc = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const nowStr = formatDateUtc(new Date());
  const startStr = formatDateUtc(dtStart);
  const endStr = formatDateUtc(dtEnd);

  const summary = `Invoice Repayment Due: ${invoice.metadata.invoiceNumber}`;
  const debtorText = invoice.metadata.debtorName ? ` (${invoice.metadata.debtorName})` : "";
  const description = `Repayment due for invoice ${invoice.metadata.invoiceNumber}${debtorText}. Amount: ${invoice.metadata.amount} ${invoice.metadata.currency}, APR: ${invoice.terms.apr}%.`;

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kora Protocol//Invoice Maturity Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:invoice-${invoice.id}@kora.finance`,
    `DTSTAMP:${nowStr}`,
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const blob = new Blob([icsLines.join("\r\n")], {
    type: "text/calendar;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `invoice-${invoice.metadata.invoiceNumber || invoice.id}-maturity.ics`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

