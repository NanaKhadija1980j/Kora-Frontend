import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { shouldShowRepaymentDueBanner, useMaturityReminder } from "@/hooks/useMaturityReminder";
import { DEFAULT_NOTIFICATION_PREFS, useSettingsStore } from "@/store/settingsStore";
import type { Invoice } from "@/types";

const { showSuccess } = vi.hoisted(() => ({ showSuccess: vi.fn() }));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ success: showSuccess }),
}));

const NOW = new Date("2026-08-27T12:00:00.000Z");

function makeInvoice({
  id = "invoice-1",
  status = "fully_funded",
  repaymentDate = "2026-08-29T12:00:00.000Z",
}: {
  id?: string;
  status?: Invoice["status"];
  repaymentDate?: string;
} = {}): Invoice {
  return {
    id,
    status,
    terms: { repaymentDate },
    metadata: { invoiceNumber: `INV-${id}` },
  } as Invoice;
}

describe("useMaturityReminder repayment alerts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    localStorage.clear();
    showSuccess.mockClear();
    useSettingsStore.setState({
      notifications: { ...DEFAULT_NOTIFICATION_PREFS },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hides the due-soon banner when repayment alerts are disabled", () => {
    const invoices = [makeInvoice()];

    expect(shouldShowRepaymentDueBanner(invoices, false, NOW)).toBe(false);
    expect(shouldShowRepaymentDueBanner(invoices, true, NOW)).toBe(true);
  });

  it("shows repayment alerts independently of maturity reminders", () => {
    useSettingsStore.getState().setNotifications({
      maturityReminder: false,
      repaymentAlerts: true,
    });

    renderHook(() => useMaturityReminder([makeInvoice()]));

    expect(showSuccess).toHaveBeenCalledTimes(1);
    expect(showSuccess).toHaveBeenCalledWith("Repayment due soon: INV-invoice-1 is due in 2 days.");
  });

  it("does not show a repayment toast when repayment alerts are disabled", () => {
    useSettingsStore.getState().setNotifications({
      maturityReminder: false,
      repaymentAlerts: false,
    });

    renderHook(() => useMaturityReminder([makeInvoice()]));

    expect(showSuccess).not.toHaveBeenCalled();
  });

  it("keeps maturity reminders enabled when repayment alerts are disabled", () => {
    useSettingsStore.getState().setNotifications({
      maturityReminder: true,
      maturityReminderDays: 3,
      repaymentAlerts: false,
    });

    renderHook(() =>
      useMaturityReminder([makeInvoice({ repaymentDate: "2026-08-30T12:00:00.000Z" })])
    );

    expect(showSuccess).toHaveBeenCalledTimes(1);
    expect(showSuccess.mock.calls[0]?.[0]).toContain("Maturity reminder:");
  });

  it("does not show duplicate repayment toasts for the same invoice", () => {
    useSettingsStore.getState().setNotifications({
      maturityReminder: false,
      repaymentAlerts: true,
    });
    const invoices = [makeInvoice()];

    const { rerender } = renderHook(() => useMaturityReminder(invoices));
    rerender();

    expect(showSuccess).toHaveBeenCalledTimes(1);
  });

  it("ignores invoices that are not fully funded or not due soon", () => {
    const invoices = [
      makeInvoice({ id: "listed", status: "listed" }),
      makeInvoice({ id: "far-away", repaymentDate: "2026-09-30T12:00:00.000Z" }),
    ];

    expect(shouldShowRepaymentDueBanner(invoices, true, NOW)).toBe(false);
  });
});
