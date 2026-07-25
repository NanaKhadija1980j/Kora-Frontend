import { describe, it, expect, beforeEach } from "vitest";
import { useSettingsStore, DEFAULT_NOTIFICATION_PREFS } from "../store/settingsStore";

function resetStore() {
  useSettingsStore.setState({ notifications: { ...DEFAULT_NOTIFICATION_PREFS } });
}

describe("settingsStore — notification preferences", () => {
  beforeEach(resetStore);

  it("defaults all notifications to true", () => {
    const { notifications } = useSettingsStore.getState();
    expect(notifications.maturityReminder).toBe(true);
    expect(notifications.fundingAlerts).toBe(true);
    expect(notifications.repaymentAlerts).toBe(true);
  });

  it("defaults maturityReminderDays to 3", () => {
    expect(useSettingsStore.getState().notifications.maturityReminderDays).toBe(3);
  });

  it("updates a single preference without affecting others", () => {
    useSettingsStore.getState().setNotifications({ maturityReminder: false });
    const { notifications } = useSettingsStore.getState();
    expect(notifications.maturityReminder).toBe(false);
    expect(notifications.fundingAlerts).toBe(true);
    expect(notifications.repaymentAlerts).toBe(true);
  });

  it("updates maturityReminderDays", () => {
    useSettingsStore.getState().setNotifications({ maturityReminderDays: 7 });
    expect(useSettingsStore.getState().notifications.maturityReminderDays).toBe(7);
  });

  it("resets to defaults", () => {
    useSettingsStore.getState().setNotifications({
      maturityReminder: false,
      fundingAlerts: false,
      repaymentAlerts: false,
      maturityReminderDays: 1,
    });
    useSettingsStore.getState().resetNotifications();
    expect(useSettingsStore.getState().notifications).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });
});
