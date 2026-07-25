"use client";

import { useEffect } from "react";
import { useToast } from "@/hooks/useToast";
import { useSettingsStore } from "@/store/settingsStore";
import type { Invoice } from "@/types";

const REMINDER_STORAGE_KEY = "kora-maturity-reminders";

function getReminderKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(REMINDER_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function markReminderShown(key: string) {
  if (typeof window === "undefined") return;
  const keys = getReminderKeys();
  if (keys.includes(key)) return;
  localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify([key, ...keys].slice(0, 50)));
}

function daysUntilDate(date: string): number {
  const now = new Date();
  const target = new Date(date);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function useMaturityReminder(invoices: Invoice[]) {
  const { notifications } = useSettingsStore();
  const toast = useToast();

  useEffect(() => {
    if (!notifications.maturityReminder || invoices.length === 0) return;

    invoices.forEach((invoice) => {
      const daysLeft = daysUntilDate(invoice.terms.repaymentDate);
      if (daysLeft !== notifications.maturityReminderDays) return;

      const reminderKey = `${invoice.id}:${notifications.maturityReminderDays}`;
      if (getReminderKeys().includes(reminderKey)) return;

      toast.success(
        `Maturity reminder: ${invoice.metadata.invoiceNumber} matures in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
        undefined,
        undefined,
        "maturityReminder"
      );
      markReminderShown(reminderKey);
    });
  }, [invoices, notifications.maturityReminder, notifications.maturityReminderDays, toast]);
}
