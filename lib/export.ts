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
    // eslint-disable-next-line
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas" as any),
      import("jspdf" as any),
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
