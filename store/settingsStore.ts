/**
 * settingsStore — persists user notification preferences via Zustand persist middleware.
 * Consistent with walletStore pattern. All notifications default to true on first load.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MaturityReminderDays = 1 | 3 | 7;

export interface NotificationPrefs {
  maturityReminder: boolean;
  fundingAlerts: boolean;
  repaymentAlerts: boolean;
  maturityReminderDays: MaturityReminderDays;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  maturityReminder: true,
  fundingAlerts: true,
  repaymentAlerts: true,
  maturityReminderDays: 3,
};

interface SettingsStore {
  notifications: NotificationPrefs;
  setNotifications: (prefs: Partial<NotificationPrefs>) => void;
  resetNotifications: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      notifications: DEFAULT_NOTIFICATION_PREFS,
      setNotifications: (prefs) =>
        set((s) => ({ notifications: { ...s.notifications, ...prefs } })),
      resetNotifications: () => set({ notifications: DEFAULT_NOTIFICATION_PREFS }),
    }),
    {
      name: "kora-settings-store",
    }
  )
);
