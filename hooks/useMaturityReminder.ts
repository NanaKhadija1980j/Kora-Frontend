"use client";

import { useEffect, useCallback } from "react";
import { useToast } from "@/hooks/useToast";
import { useSettingsStore } from "@/store/settingsStore";
import { exportInvoiceCalendarIcs } from "@/lib/export";
import type { Invoice } from "@/types";

const REMINDER_STORAGE_KEY = "kora-maturity-reminders";
const REPAYMENT_ALERT_STORAGE_KEY = "kora-repayment-alerts";
const REPAYMENT_DUE_SOON_DAYS = 7;

function getShownKeys(storageKey: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function markShown(storageKey: string, key: string) {
  if (typeof window === "undefined") return;
  const keys = getShownKeys(storageKey);
  if (keys.includes(key)) return;
  localStorage.setItem(storageKey, JSON.stringify([key, ...keys].slice(0, 50)));
}

function daysUntilDate(date: string, now = new Date()): number {
  const target = new Date(date);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function isRepaymentDueSoon(invoice: Invoice, now = new Date()): boolean {
  if (invoice.status !== "fully_funded") return false;
  const daysLeft = daysUntilDate(invoice.terms.repaymentDate, now);
  return daysLeft >= 0 && daysLeft <= REPAYMENT_DUE_SOON_DAYS;
}

export function shouldShowRepaymentDueBanner(
  invoices: Invoice[],
  repaymentAlerts: boolean,
  now = new Date()
): boolean {
  return repaymentAlerts && invoices.some((invoice) => isRepaymentDueSoon(invoice, now));
}

export function useMaturityReminder(invoices: Invoice[]) {
  const { notifications } = useSettingsStore();
  const toast = useToast();

  const downloadCalendarForInvoice = useCallback((invoice: Invoice) => {
    exportInvoiceCalendarIcs(invoice);
  }, []);

  useEffect(() => {
    if (!notifications.maturityReminder || invoices.length === 0) return;

    invoices.forEach((invoice) => {
      const daysLeft = daysUntilDate(invoice.terms.repaymentDate);
      if (daysLeft !== notifications.maturityReminderDays) return;

      const reminderKey = `${invoice.id}:${notifications.maturityReminderDays}`;
      if (getShownKeys(REMINDER_STORAGE_KEY).includes(reminderKey)) return;

      toast.success(
        `Maturity reminder: ${invoice.metadata.invoiceNumber} matures in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`
      );
      markShown(REMINDER_STORAGE_KEY, reminderKey);
    });
  }, [invoices, notifications.maturityReminder, notifications.maturityReminderDays, toast]);

  useEffect(() => {
    if (!notifications.repaymentAlerts || invoices.length === 0) return;

    invoices.forEach((invoice) => {
      if (!isRepaymentDueSoon(invoice)) return;

      const alertKey = invoice.id;
      if (getShownKeys(REPAYMENT_ALERT_STORAGE_KEY).includes(alertKey)) return;

      const daysLeft = daysUntilDate(invoice.terms.repaymentDate);
      const timing = daysLeft === 0 ? "today" : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
      toast.success(`Repayment due soon: ${invoice.metadata.invoiceNumber} is due ${timing}.`);
      markShown(REPAYMENT_ALERT_STORAGE_KEY, alertKey);
    });
  }, [invoices, notifications.repaymentAlerts, toast]);

  return { downloadCalendarForInvoice };
}
