/**
 * Tests for useMaturityReminder (Issue #677).
 *
 * The hook drives the SME maturity toasts and dedupes them through a
 * localStorage key list, so the things worth pinning down are: it fires only on
 * an exact day match, it fires once per invoice key no matter how often the
 * component re-renders, the preference switch actually suppresses it, and the
 * key list stays capped so it cannot grow forever.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

import { createMockInvoice } from "./fixtures";
import { useSettingsStore } from "@/store/settingsStore";
import type { Invoice } from "@/types";

const REMINDER_STORAGE_KEY = "kora-maturity-reminders";

const toastSuccess = vi.fn();
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({
    success: toastSuccess,
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

const exportIcs = vi.fn();
vi.mock("@/lib/export", () => ({
  exportInvoiceCalendarIcs: (invoice: unknown) => exportIcs(invoice),
}));

import { useMaturityReminder } from "@/hooks/useMaturityReminder";

/** An invoice maturing exactly `days` from now. */
function invoiceMaturingIn(days: number, overrides: Partial<Invoice> = {}): Invoice {
  const repaymentDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const base = createMockInvoice(overrides);
  return {
    ...base,
    terms: { ...base.terms, repaymentDate },
  };
}

function setPrefs(maturityReminder: boolean, maturityReminderDays: 1 | 3 | 7 = 7) {
  useSettingsStore.setState((state) => ({
    notifications: { ...state.notifications, maturityReminder, maturityReminderDays },
  }));
}

beforeEach(() => {
  localStorage.clear();
  toastSuccess.mockClear();
  exportIcs.mockClear();
  setPrefs(true, 7);
});

afterEach(() => {
  useSettingsStore.getState().resetNotifications();
});

describe("useMaturityReminder", () => {
  describe("day matching", () => {
    it("fires for an invoice maturing on the configured day", () => {
      const invoice = invoiceMaturingIn(7, { id: "inv_match" });
      renderHook(() => useMaturityReminder([invoice]));

      expect(toastSuccess).toHaveBeenCalledTimes(1);
      expect(toastSuccess.mock.calls[0][0]).toContain(invoice.metadata.invoiceNumber);
    });

    it("does not fire for an invoice maturing on a different day", () => {
      renderHook(() => useMaturityReminder([invoiceMaturingIn(4, { id: "inv_other_day" })]));

      expect(toastSuccess).not.toHaveBeenCalled();
    });

    it("follows the configured reminder day rather than a fixed one", () => {
      setPrefs(true, 3);
      renderHook(() => useMaturityReminder([invoiceMaturingIn(3, { id: "inv_three" })]));

      expect(toastSuccess).toHaveBeenCalledTimes(1);
    });

    it("does nothing for an empty invoice list", () => {
      renderHook(() => useMaturityReminder([]));

      expect(toastSuccess).not.toHaveBeenCalled();
    });

    it("fires once per matching invoice", () => {
      renderHook(() =>
        useMaturityReminder([
          invoiceMaturingIn(7, { id: "inv_a" }),
          invoiceMaturingIn(7, { id: "inv_b" }),
          invoiceMaturingIn(2, { id: "inv_c" }),
        ])
      );

      expect(toastSuccess).toHaveBeenCalledTimes(2);
    });

    it("uses the singular form one day out", () => {
      setPrefs(true, 1);
      renderHook(() => useMaturityReminder([invoiceMaturingIn(1, { id: "inv_one_day" })]));

      expect(toastSuccess.mock.calls[0][0]).toContain("1 day.");
    });
  });

  describe("dedupe", () => {
    it("does not toast the same invoice twice across renders", () => {
      const invoice = invoiceMaturingIn(7, { id: "inv_dedupe" });
      const { rerender } = renderHook(() => useMaturityReminder([invoice]));

      rerender();
      rerender();

      expect(toastSuccess).toHaveBeenCalledTimes(1);
    });

    it("does not toast again for a fresh mount once the key is stored", () => {
      const invoice = invoiceMaturingIn(7, { id: "inv_remount" });
      renderHook(() => useMaturityReminder([invoice]));
      expect(toastSuccess).toHaveBeenCalledTimes(1);

      renderHook(() => useMaturityReminder([invoice]));

      expect(toastSuccess).toHaveBeenCalledTimes(1);
    });

    it("records the reminder key against the invoice and day", () => {
      const invoice = invoiceMaturingIn(7, { id: "inv_key" });
      renderHook(() => useMaturityReminder([invoice]));

      const stored = JSON.parse(localStorage.getItem(REMINDER_STORAGE_KEY) || "[]");
      expect(stored).toContain("inv_key:7");
    });

    it("treats a different reminder-day preference as a separate key", () => {
      const invoice = invoiceMaturingIn(7, { id: "inv_day_scope" });
      renderHook(() => useMaturityReminder([invoice]));

      // Same invoice, but now the preference points at a day it also matches.
      setPrefs(true, 3);
      renderHook(() => useMaturityReminder([invoiceMaturingIn(3, { id: "inv_day_scope" })]));

      const stored = JSON.parse(localStorage.getItem(REMINDER_STORAGE_KEY) || "[]");
      expect(stored).toContain("inv_day_scope:7");
      expect(stored).toContain("inv_day_scope:3");
      expect(toastSuccess).toHaveBeenCalledTimes(2);
    });

    it("survives a corrupt stored value instead of throwing", () => {
      localStorage.setItem(REMINDER_STORAGE_KEY, "not-json");

      expect(() =>
        renderHook(() => useMaturityReminder([invoiceMaturingIn(7, { id: "inv_corrupt" })]))
      ).not.toThrow();
      expect(toastSuccess).toHaveBeenCalledTimes(1);
    });
  });

  describe("preference", () => {
    it("stays silent when maturityReminder is off", () => {
      setPrefs(false, 7);
      renderHook(() => useMaturityReminder([invoiceMaturingIn(7, { id: "inv_disabled" })]));

      expect(toastSuccess).not.toHaveBeenCalled();
    });

    it("does not record a key while disabled", () => {
      setPrefs(false, 7);
      renderHook(() => useMaturityReminder([invoiceMaturingIn(7, { id: "inv_disabled_key" })]));

      expect(localStorage.getItem(REMINDER_STORAGE_KEY)).toBeNull();
    });
  });

  describe("stored key cap", () => {
    it("keeps at most 50 keys, newest first", () => {
      const existing = Array.from({ length: 50 }, (_, i) => `old_${i}:7`);
      localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(existing));

      renderHook(() => useMaturityReminder([invoiceMaturingIn(7, { id: "inv_newest" })]));

      const stored = JSON.parse(localStorage.getItem(REMINDER_STORAGE_KEY) || "[]");
      expect(stored).toHaveLength(50);
      expect(stored[0]).toBe("inv_newest:7");
      expect(stored).not.toContain("old_49:7");
    });
  });

  describe("cleanup", () => {
    it("does not toast after unmount", () => {
      const invoice = invoiceMaturingIn(7, { id: "inv_unmount" });
      const { unmount } = renderHook(() => useMaturityReminder([invoice]));
      expect(toastSuccess).toHaveBeenCalledTimes(1);

      unmount();

      expect(toastSuccess).toHaveBeenCalledTimes(1);
    });
  });

  describe("downloadCalendarForInvoice", () => {
    it("exports the calendar entry for the given invoice", () => {
      const invoice = invoiceMaturingIn(30, { id: "inv_ics" });
      const { result } = renderHook(() => useMaturityReminder([invoice]));

      result.current.downloadCalendarForInvoice(invoice);

      expect(exportIcs).toHaveBeenCalledWith(invoice);
    });
  });
});
