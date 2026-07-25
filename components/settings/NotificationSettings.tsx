"use client";

import { Keyboard, RotateCcw } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { useSettingsStore } from "@/store/settingsStore";
import { Button } from "@/components/ui/button";
import type { MaturityReminderDays } from "@/store/settingsStore";

const NOTIFICATION_ITEMS: Array<{
  key: "maturityReminder" | "fundingAlerts" | "repaymentAlerts";
  label: string;
  description: string;
}> = [
  {
    key: "maturityReminder",
    label: "Maturity Reminders",
    description: "Remind you before invoice maturity date.",
  },
  {
    key: "fundingAlerts",
    label: "Funding Alerts",
    description: "Notify when your invoice reaches funding milestones.",
  },
  {
    key: "repaymentAlerts",
    label: "Repayment Alerts",
    description: "Notify when repayment is due or completed.",
  },
];

function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}

export function NotificationSettings() {
  const { notifications, setNotifications, resetNotifications } = useSettingsStore();
  const shortcutsEnabled = useUIStore((s) => s.shortcutsEnabled);
  const setShortcutsEnabled = useUIStore((s) => s.setShortcutsEnabled);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">Notification Preferences</h3>
        <p className="text-sm text-muted-foreground">Control which in-app alerts appear during your workflow.</p>
      </div>

      <div className="space-y-3">
        {NOTIFICATION_ITEMS.map((item) => (
          <div key={item.key} className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-3">
            <div>
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
            </div>
            <Toggle
              checked={notifications[item.key]}
              onChange={(next) => setNotifications({ [item.key]: next })}
              ariaLabel={`Toggle ${item.label}`}
            />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <label htmlFor="maturity-reminder-days" className="block text-sm font-medium text-foreground">
          Reminder timing
        </label>
        <p className="mt-0.5 text-xs text-muted-foreground">Choose when to alert before maturity date.</p>
        <select
          id="maturity-reminder-days"
          value={notifications.maturityReminderDays}
          onChange={(e) => setNotifications({ maturityReminderDays: Number(e.target.value) as MaturityReminderDays })}
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          disabled={!notifications.maturityReminder}
        >
          <option value={1}>1 day before maturity</option>
          <option value={3}>3 days before maturity</option>
          <option value={7}>7 days before maturity</option>
        </select>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
        onClick={resetNotifications}
      >
        Reset to defaults
      </Button>

      {/* ── Keyboard shortcuts toggle ──────────────────────────────────────── */}
      <div className="space-y-1 pt-2">
        <h3 className="text-base font-semibold text-foreground">Keyboard Shortcuts</h3>
        <p className="text-sm text-muted-foreground">
          Enable global keyboard shortcuts for faster navigation.
        </p>
      </div>
      <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-foreground">Enable shortcuts</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Press <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">?</kbd> to view all shortcuts.
            </p>
          </div>
        </div>
        <Toggle
          checked={shortcutsEnabled}
          onChange={setShortcutsEnabled}
          ariaLabel="Toggle keyboard shortcuts"
        />
      </div>
    </div>
  );
}
