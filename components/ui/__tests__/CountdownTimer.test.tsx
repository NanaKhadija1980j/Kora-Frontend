/**
 * CountdownTimer mount coverage — Issue #692.
 *
 * The primitive already existed; what was untested is the surface the
 * marketplace card and the invoice detail page actually rely on: the compact
 * mode cards render, the full mode detail renders, the elapsed/overdue state,
 * and that the calendar export still emits a parseable .ics.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CountdownTimer from "@/components/ui/CountdownTimer";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Offsets are taken from the real clock the hook reads. The extra 30s absorbs
 * the few ms between building the target and the hook's first `Date.now()`, so
 * the floor-based minute never flakes down by one.
 */
function inFuture(ms: number) {
  return new Date(Date.now() + ms + 30_000).toISOString();
}

const INVOICE = {
  id: "inv_692",
  metadata: {
    invoiceNumber: "INV-2025-0692",
    debtorName: "Acme Logistics SA",
    amount: 250_000,
    currency: "USDC",
  },
  terms: { repaymentDate: "2030-02-01T12:00:00.000Z", apr: 24.5 },
};

/** jsdom's Blob has no `.text()`, so read it the way the platform always could. */
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/** Capture what the export handed to `URL.createObjectURL`. jsdom has neither. */
function stubObjectUrl() {
  const blobs: Blob[] = [];
  const createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob);
    return `blob:mock/${blobs.length}`;
  });
  const revokeObjectURL = vi.fn();

  Object.defineProperty(URL, "createObjectURL", {
    value: createObjectURL,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: revokeObjectURL,
    configurable: true,
    writable: true,
  });

  return { blobs, createObjectURL, revokeObjectURL };
}

let clickSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // The export appends a real <a> and clicks it; jsdom would try to navigate.
  clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
});

afterEach(() => {
  clickSpy.mockRestore();
});

describe("CountdownTimer — compact mode (marketplace cards)", () => {
  it("renders abbreviated days, hours and minutes", () => {
    render(<CountdownTimer targetDate={inFuture(14 * DAY + 6 * HOUR + 32 * MINUTE)} compact />);

    expect(screen.getByText("14d")).toBeInTheDocument();
    expect(screen.getByText("6h")).toBeInTheDocument();
    expect(screen.getByText("32m")).toBeInTheDocument();
  });

  it("omits the spelled-out unit labels the full mode uses", () => {
    render(<CountdownTimer targetDate={inFuture(14 * DAY)} compact />);

    expect(screen.queryByText("days")).not.toBeInTheDocument();
    expect(screen.queryByText("hours")).not.toBeInTheDocument();
    expect(screen.queryByText("minutes")).not.toBeInTheDocument();
  });

  it("collapses to 'Expires today' inside the final 24 hours", () => {
    render(<CountdownTimer targetDate={inFuture(3 * HOUR)} compact />);

    expect(screen.getByText("Expires today")).toBeInTheDocument();
    expect(screen.queryByText("0d")).not.toBeInTheDocument();
  });

  it("defaults to compact when the prop is omitted", () => {
    render(<CountdownTimer targetDate={inFuture(5 * DAY)} />);

    expect(screen.getByText("5d")).toBeInTheDocument();
    expect(screen.queryByText("days")).not.toBeInTheDocument();
  });

  it("hides the calendar export by default, keeping cards compact", () => {
    render(<CountdownTimer targetDate={inFuture(5 * DAY)} compact />);

    expect(
      screen.queryByRole("button", { name: /export maturity date to calendar/i })
    ).not.toBeInTheDocument();
  });

  it("can opt into the icon-only export inside the final 24 hours", () => {
    render(
      <CountdownTimer targetDate={inFuture(3 * HOUR)} compact showCalendarExport />
    );

    expect(
      screen.getByRole("button", { name: /export maturity date to calendar/i })
    ).toBeInTheDocument();
  });

  it("applies the caller's className", () => {
    const { container } = render(
      <CountdownTimer targetDate={inFuture(5 * DAY)} compact className="ml-1" />
    );

    expect(container.firstElementChild!.className).toContain("ml-1");
  });
});

describe("CountdownTimer — full mode (invoice detail)", () => {
  it("spells out each unit alongside its value", () => {
    render(
      <CountdownTimer targetDate={inFuture(14 * DAY + 6 * HOUR + 32 * MINUTE)} compact={false} />
    );

    expect(screen.getByText("days")).toBeInTheDocument();
    expect(screen.getByText("hours")).toBeInTheDocument();
    expect(screen.getByText("minutes")).toBeInTheDocument();
    expect(screen.getByText("14d")).toBeInTheDocument();
    expect(screen.getByText("6h")).toBeInTheDocument();
    expect(screen.getByText("32m")).toBeInTheDocument();
  });

  it("keeps the units under 24 hours instead of collapsing", () => {
    // The "Expires today" shortcut is a compact-mode affordance only.
    render(<CountdownTimer targetDate={inFuture(3 * HOUR)} compact={false} />);

    expect(screen.queryByText("Expires today")).not.toBeInTheDocument();
    expect(screen.getByText("0d")).toBeInTheDocument();
    expect(screen.getByText("3h")).toBeInTheDocument();
  });

  it("renders a labelled ICS button when export is enabled", () => {
    render(
      <CountdownTimer
        targetDate={INVOICE.terms.repaymentDate}
        compact={false}
        invoice={INVOICE}
        showCalendarExport
      />
    );

    const button = screen.getByRole("button", {
      name: /export maturity date to calendar/i,
    });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("ICS");
  });

  it("exposes a polite live region for screen readers", () => {
    const { container } = render(
      <CountdownTimer targetDate={inFuture(5 * DAY)} compact={false} />
    );

    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });
});

describe("CountdownTimer — elapsed state", () => {
  it('shows "Expired" once the target is in the past', () => {
    render(<CountdownTimer targetDate={new Date(Date.now() - DAY).toISOString()} />);

    expect(screen.getByRole("status")).toHaveTextContent("Expired");
  });

  it("uses the same elapsed state in full mode", () => {
    render(
      <CountdownTimer
        targetDate={new Date(Date.now() - DAY).toISOString()}
        compact={false}
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Expired");
    expect(screen.queryByText("days")).not.toBeInTheDocument();
  });

  it('renders the overdue label a maturity countdown passes in', () => {
    // An invoice past its repayment date is overdue, not "expired" — the
    // listing wording would tell the investor the wrong thing.
    render(
      <CountdownTimer
        targetDate={new Date(Date.now() - DAY).toISOString()}
        expiredLabel="Overdue"
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Overdue");
    expect(screen.queryByText("Expired")).not.toBeInTheDocument();
  });

  it("marks the elapsed state for styling and assertions", () => {
    render(<CountdownTimer targetDate={new Date(Date.now() - DAY).toISOString()} />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("data-state", "expired");
    expect(status.className).toContain("text-destructive");
  });

  it("treats the exact target instant as elapsed", () => {
    render(<CountdownTimer targetDate={Date.now() - 1} />);
    expect(screen.getByRole("status")).toHaveTextContent("Expired");
  });
});

describe("CountdownTimer — ICS export", () => {
  async function exportAndReadIcs(props: React.ComponentProps<typeof CountdownTimer>) {
    const { blobs, revokeObjectURL } = stubObjectUrl();
    const user = userEvent.setup();

    render(<CountdownTimer {...props} />);
    await user.click(
      screen.getByRole("button", { name: /export maturity date to calendar/i })
    );

    expect(blobs).toHaveLength(1);
    return { ics: await readBlob(blobs[0]), blob: blobs[0], revokeObjectURL };
  }

  it("emits a well-formed iCalendar document", async () => {
    const { ics } = await exportAndReadIcs({
      targetDate: INVOICE.terms.repaymentDate,
      compact: false,
      invoice: INVOICE,
      showCalendarExport: true,
    });

    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("UID:invoice-inv_692@kora.finance");
  });

  it("uses CRLF line endings as RFC 5545 requires", async () => {
    const { ics } = await exportAndReadIcs({
      targetDate: INVOICE.terms.repaymentDate,
      compact: false,
      invoice: INVOICE,
      showCalendarExport: true,
    });

    expect(ics).toContain("\r\n");
    expect(ics.split("\r\n").length).toBeGreaterThan(10);
  });

  it("carries the invoice's own maturity date and summary", async () => {
    const { ics } = await exportAndReadIcs({
      targetDate: INVOICE.terms.repaymentDate,
      compact: false,
      invoice: INVOICE,
      showCalendarExport: true,
    });

    expect(ics).toContain("DTSTART:20300201T120000Z");
    expect(ics).toContain("SUMMARY:Invoice Repayment Due: INV-2025-0692");
  });

  it("serves the blob as text/calendar", async () => {
    const { blob } = await exportAndReadIcs({
      targetDate: INVOICE.terms.repaymentDate,
      compact: false,
      invoice: INVOICE,
      showCalendarExport: true,
    });

    expect(blob.type).toContain("text/calendar");
  });

  it("revokes the object URL after triggering the download", async () => {
    const { revokeObjectURL } = await exportAndReadIcs({
      targetDate: INVOICE.terms.repaymentDate,
      compact: false,
      invoice: INVOICE,
      showCalendarExport: true,
    });

    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("exports from the compact mode too", async () => {
    const { ics } = await exportAndReadIcs({
      targetDate: INVOICE.terms.repaymentDate,
      compact: true,
      invoice: INVOICE,
      showCalendarExport: true,
    });

    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("SUMMARY:Invoice Repayment Due: INV-2025-0692");
  });

  it("falls back to the target date when no invoice is supplied", async () => {
    const { ics } = await exportAndReadIcs({
      targetDate: INVOICE.terms.repaymentDate,
      compact: false,
      showCalendarExport: true,
    });

    expect(ics).toContain("INV-MATURITY");
    expect(ics).toContain("DTSTART:20300201T120000Z");
  });

  it("does not trigger the card click the countdown sits inside", async () => {
    stubObjectUrl();
    const user = userEvent.setup();
    const onClick = vi.fn();

    // Stands in for the marketplace card, which wraps the whole tile in a link
    // to the invoice — exporting must not navigate away from the grid.
    render(
      <div onClick={onClick} data-testid="card">
        <CountdownTimer
          targetDate={INVOICE.terms.repaymentDate}
          compact
          invoice={INVOICE}
          showCalendarExport
        />
      </div>
    );

    await user.click(
      screen.getByRole("button", { name: /export maturity date to calendar/i })
    );

    // The handler stops propagation, so the wrapper's click never fires.
    expect(onClick).not.toHaveBeenCalled();
  });
});
