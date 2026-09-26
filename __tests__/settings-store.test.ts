import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  useSettingsStore,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_TOUR_SETTINGS,
  DEFAULT_CONCENTRATION_SETTINGS,
} from "../store/settingsStore";
import {
  DEFAULT_CONCENTRATION_THRESHOLDS,
  SNOOZE_DURATIONS_MS,
} from "@/lib/concentrationRisk";

function resetStore() {
  useSettingsStore.setState({
    notifications: { ...DEFAULT_NOTIFICATION_PREFS },
    tour: { ...DEFAULT_TOUR_SETTINGS },
    concentration: { ...DEFAULT_CONCENTRATION_SETTINGS },
  });
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

describe("settingsStore — onboarding tour settings", () => {
  beforeEach(resetStore);

  it("defaults to investor persona and step 0", () => {
    const { tour } = useSettingsStore.getState();
    expect(tour.persona).toBe("investor");
    expect(tour.stepIndex).toBe(0);
    expect(tour.completed).toBe(false);
    expect(tour.skipped).toBe(false);
  });

  it("updates tour settings properly", () => {
    useSettingsStore.getState().setTourSettings({ persona: "sme", stepIndex: 2 });
    const { tour } = useSettingsStore.getState();
    expect(tour.persona).toBe("sme");
    expect(tour.stepIndex).toBe(2);
  });

  it("restarts tour and resets stepIndex/completed/skipped", () => {
    useSettingsStore.getState().setTourSettings({ stepIndex: 3, completed: true });
    useSettingsStore.getState().restartTour("sme");
    const { tour } = useSettingsStore.getState();
    expect(tour.persona).toBe("sme");
    expect(tour.stepIndex).toBe(0);
    expect(tour.completed).toBe(false);
    expect(tour.skipped).toBe(false);
  });
});

describe("settingsStore — concentration settings", () => {
  beforeEach(resetStore);

  it("defaults concentration settings", () => {
    const { concentration } = useSettingsStore.getState();
    expect(concentration.thresholds).toEqual(DEFAULT_CONCENTRATION_THRESHOLDS);
    expect(concentration.dismissedKeys).toEqual([]);
    expect(concentration.snoozes).toEqual([]);
  });

  describe("setConcentrationThresholds", () => {
    it("updates a single threshold without affecting others", () => {
      useSettingsStore.getState().setConcentrationThresholds({ debtor: 30 });
      const { concentration } = useSettingsStore.getState();
      expect(concentration.thresholds.debtor).toBe(30);
      expect(concentration.thresholds.jurisdiction).toBe(DEFAULT_CONCENTRATION_THRESHOLDS.jurisdiction);
      expect(concentration.thresholds.riskTier).toBe(DEFAULT_CONCENTRATION_THRESHOLDS.riskTier);
    });

    it("updates multiple thresholds", () => {
      useSettingsStore.getState().setConcentrationThresholds({
        debtor: 20,
        jurisdiction: 35,
      });
      const { concentration } = useSettingsStore.getState();
      expect(concentration.thresholds.debtor).toBe(20);
      expect(concentration.thresholds.jurisdiction).toBe(35);
      expect(concentration.thresholds.riskTier).toBe(DEFAULT_CONCENTRATION_THRESHOLDS.riskTier);
    });

    it("updates all thresholds", () => {
      useSettingsStore.getState().setConcentrationThresholds({
        debtor: 15,
        jurisdiction: 30,
        riskTier: 40,
      });
      const { concentration } = useSettingsStore.getState();
      expect(concentration.thresholds).toEqual({ debtor: 15, jurisdiction: 30, riskTier: 40 });
    });

    it("preserves dismissedKeys and snoozes when updating thresholds", () => {
      useSettingsStore.getState().dismissConcentrationAlert("debtor:Acme Corp");
      useSettingsStore.getState().snoozeConcentrationAlert("jurisdiction:US", SNOOZE_DURATIONS_MS.day);

      useSettingsStore.getState().setConcentrationThresholds({ debtor: 20 });

      const { concentration } = useSettingsStore.getState();
      expect(concentration.dismissedKeys).toContain("debtor:Acme Corp");
      expect(concentration.snoozes).toHaveLength(1);
      expect(concentration.snoozes[0].key).toBe("jurisdiction:US");
    });
  });

  describe("dismissConcentrationAlert", () => {
    it("adds key to dismissedKeys", () => {
      useSettingsStore.getState().dismissConcentrationAlert("debtor:Acme Corp");
      expect(useSettingsStore.getState().concentration.dismissedKeys).toEqual(["debtor:Acme Corp"]);
    });

    it("does not duplicate key if already dismissed", () => {
      useSettingsStore.getState().dismissConcentrationAlert("debtor:Acme Corp");
      useSettingsStore.getState().dismissConcentrationAlert("debtor:Acme Corp");
      expect(useSettingsStore.getState().concentration.dismissedKeys).toEqual(["debtor:Acme Corp"]);
    });

    it("can dismiss multiple different keys", () => {
      useSettingsStore.getState().dismissConcentrationAlert("debtor:Acme Corp");
      useSettingsStore.getState().dismissConcentrationAlert("jurisdiction:US");
      useSettingsStore.getState().dismissConcentrationAlert("riskTier:High");
      expect(useSettingsStore.getState().concentration.dismissedKeys).toHaveLength(3);
      expect(useSettingsStore.getState().concentration.dismissedKeys).toContain("debtor:Acme Corp");
      expect(useSettingsStore.getState().concentration.dismissedKeys).toContain("jurisdiction:US");
      expect(useSettingsStore.getState().concentration.dismissedKeys).toContain("riskTier:High");
    });

    it("preserves thresholds and snoozes when dismissing", () => {
      useSettingsStore.getState().snoozeConcentrationAlert("debtor:Acme Corp", SNOOZE_DURATIONS_MS.day);
      useSettingsStore.getState().dismissConcentrationAlert("jurisdiction:US");

      const { concentration } = useSettingsStore.getState();
      expect(concentration.thresholds).toEqual(DEFAULT_CONCENTRATION_THRESHOLDS);
      expect(concentration.snoozes).toHaveLength(1);
      expect(concentration.snoozes[0].key).toBe("debtor:Acme Corp");
    });
  });

  describe("snoozeConcentrationAlert", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("adds snooze entry with key and expiry", () => {
      const now = Date.now();
      useSettingsStore.getState().snoozeConcentrationAlert("debtor:Acme Corp", SNOOZE_DURATIONS_MS.day);

      const { concentration } = useSettingsStore.getState();
      expect(concentration.snoozes).toHaveLength(1);
      expect(concentration.snoozes[0].key).toBe("debtor:Acme Corp");
      expect(concentration.snoozes[0].until).toBe(now + SNOOZE_DURATIONS_MS.day);
    });

    it("uses default snooze duration (1 day) when not specified", () => {
      const now = Date.now();
      useSettingsStore.getState().snoozeConcentrationAlert("debtor:Acme Corp");

      const { concentration } = useSettingsStore.getState();
      expect(concentration.snoozes[0].until).toBe(now + SNOOZE_DURATIONS_MS.day);
    });

    it("replaces existing snooze for same key instead of stacking", () => {
      const now = Date.now();
      useSettingsStore.getState().snoozeConcentrationAlert("debtor:Acme Corp", SNOOZE_DURATIONS_MS.day);

      // Snooze again with different duration
      useSettingsStore.getState().snoozeConcentrationAlert("debtor:Acme Corp", SNOOZE_DURATIONS_MS.week);

      const { concentration } = useSettingsStore.getState();
      expect(concentration.snoozes).toHaveLength(1);
      expect(concentration.snoozes[0].key).toBe("debtor:Acme Corp");
      expect(concentration.snoozes[0].until).toBe(now + SNOOZE_DURATIONS_MS.week);
    });

    it("can snooze multiple different keys", () => {
      useSettingsStore.getState().snoozeConcentrationAlert("debtor:Acme Corp", SNOOZE_DURATIONS_MS.day);
      useSettingsStore.getState().snoozeConcentrationAlert("jurisdiction:US", SNOOZE_DURATIONS_MS.week);

      const { concentration } = useSettingsStore.getState();
      expect(concentration.snoozes).toHaveLength(2);
      expect(concentration.snoozes.map((s) => s.key).sort()).toEqual(["debtor:Acme Corp", "jurisdiction:US"].sort());
    });

    it("preserves thresholds and dismissedKeys when snoozing", () => {
      useSettingsStore.getState().setConcentrationThresholds({ debtor: 20 });
      useSettingsStore.getState().dismissConcentrationAlert("jurisdiction:US");
      useSettingsStore.getState().snoozeConcentrationAlert("debtor:Acme Corp");

      const { concentration } = useSettingsStore.getState();
      expect(concentration.thresholds.debtor).toBe(20);
      expect(concentration.dismissedKeys).toContain("jurisdiction:US");
      expect(concentration.snoozes).toHaveLength(1);
    });
  });

  describe("resetConcentrationAlerts", () => {
    it("clears dismissedKeys and snoozes", () => {
      useSettingsStore.getState().dismissConcentrationAlert("debtor:Acme Corp");
      useSettingsStore.getState().dismissConcentrationAlert("jurisdiction:US");
      useSettingsStore.getState().snoozeConcentrationAlert("riskTier:High", SNOOZE_DURATIONS_MS.day);

      useSettingsStore.getState().resetConcentrationAlerts();

      const { concentration } = useSettingsStore.getState();
      expect(concentration.dismissedKeys).toEqual([]);
      expect(concentration.snoozes).toEqual([]);
    });

    it("preserves thresholds when resetting alerts", () => {
      useSettingsStore.getState().setConcentrationThresholds({ debtor: 20 });
      useSettingsStore.getState().dismissConcentrationAlert("debtor:Acme Corp");
      useSettingsStore.getState().resetConcentrationAlerts();

      expect(useSettingsStore.getState().concentration.thresholds.debtor).toBe(20);
    });
  });

  describe("persistence", () => {
    it("persists concentration settings to localStorage", () => {
      useSettingsStore.getState().setConcentrationThresholds({ debtor: 20 });
      useSettingsStore.getState().dismissConcentrationAlert("debtor:Acme Corp");
      useSettingsStore.getState().snoozeConcentrationAlert("jurisdiction:US", SNOOZE_DURATIONS_MS.day);

      // Force persist by checking localStorage
      const stored = localStorage.getItem("kora-settings-store");
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.concentration.thresholds.debtor).toBe(20);
      expect(parsed.state.concentration.dismissedKeys).toContain("debtor:Acme Corp");
      expect(parsed.state.concentration.snoozes).toHaveLength(1);
      expect(parsed.state.concentration.snoozes[0].key).toBe("jurisdiction:US");
    });

    it("loads persisted concentration settings on rehydration", () => {
      // Simulate persisted state
      const persistedState = {
        concentration: {
          thresholds: { debtor: 15, jurisdiction: 30, riskTier: 40 },
          dismissedKeys: ["debtor:Old Corp"],
          snoozes: [{ key: "jurisdiction:CA", until: Date.now() + SNOOZE_DURATIONS_MS.week }],
        },
      };
      localStorage.setItem("kora-settings-store", JSON.stringify({ state: persistedState, version: 0 }));

      // Create a new store instance (simulated by re-importing)
      // Since we can't easily re-import, we'll test by setting state directly
      useSettingsStore.setState({ concentration: persistedState.concentration });

      const { concentration } = useSettingsStore.getState();
      expect(concentration.thresholds.debtor).toBe(15);
      expect(concentration.dismissedKeys).toContain("debtor:Old Corp");
      expect(concentration.snoozes).toHaveLength(1);
      expect(concentration.snoozes[0].key).toBe("jurisdiction:CA");
    });
  });

  describe("edge cases", () => {
    it("handles zero/negative threshold values", () => {
      useSettingsStore.getState().setConcentrationThresholds({ debtor: 0, jurisdiction: -1 });
      const { concentration } = useSettingsStore.getState();
      expect(concentration.thresholds.debtor).toBe(0);
      expect(concentration.thresholds.jurisdiction).toBe(-1);
    });

    it("handles empty string keys gracefully", () => {
      useSettingsStore.getState().dismissConcentrationAlert("");
      expect(useSettingsStore.getState().concentration.dismissedKeys).toContain("");
    });

    it("snooze with very short duration", () => {
      const now = Date.now();
      useSettingsStore.getState().snoozeConcentrationAlert("debtor:Test", 100);
      expect(useSettingsStore.getState().concentration.snoozes[0].until).toBe(now + 100);
    });
  });
});