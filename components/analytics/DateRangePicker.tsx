"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type PresetRange = "7d" | "30d" | "90d" | "ytd" | "all";

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface DateRangePickerProps {
  value: PresetRange | "custom";
  customRange?: DateRange;
  onChange: (preset: PresetRange | "custom", range?: DateRange) => void;
  className?: string;
}

const PRESETS: { label: string; value: PresetRange }[] = [
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
  { label: "YTD", value: "ytd" },
  { label: "All", value: "all" },
];

/**
 * DateRangePicker — preset range chips + optional custom date inputs.
 */
export function DateRangePicker({ value, customRange, onChange, className }: DateRangePickerProps) {
  const [showCustom, setShowCustom] = React.useState(value === "custom");
  const [from, setFrom] = React.useState(customRange?.from ?? null);
  const [to, setTo] = React.useState(customRange?.to ?? null);

  const handlePreset = (preset: PresetRange) => {
    setShowCustom(false);
    onChange(preset);
  };

  const handleCustomApply = () => {
    if (from && to) {
      onChange("custom", { from, to });
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {PRESETS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => handlePreset(p.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === p.value
              ? "bg-primary text-primary-foreground"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          )}
        >
          {p.label}
        </button>
      ))}

      <button
        type="button"
        onClick={() => setShowCustom((v) => !v)}
        className={cn(
          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
          value === "custom"
            ? "bg-primary text-primary-foreground"
            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
        )}
      >
        Custom
      </button>

      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from ? from.toISOString().split("T")[0] : ""}
            onChange={(e) => setFrom(e.target.value ? new Date(e.target.value) : null)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
            aria-label="From date"
          />
          <span className="text-xs text-zinc-500">–</span>
          <input
            type="date"
            value={to ? to.toISOString().split("T")[0] : ""}
            onChange={(e) => setTo(e.target.value ? new Date(e.target.value) : null)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
            aria-label="To date"
          />
          <button
            type="button"
            onClick={handleCustomApply}
            disabled={!from || !to}
            className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
