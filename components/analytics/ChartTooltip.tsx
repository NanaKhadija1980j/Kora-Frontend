"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** A single data series rendered inside the tooltip. */
export interface ChartTooltipSeries {
  /** Series name shown as the row label. */
  name: string;
  /** Numeric value for the series. */
  value: number;
  /** Optional CSS color used for the series swatch. */
  color?: string;
}

/** Props accepted by {@link ChartTooltip}. */
export interface ChartTooltipProps {
  /** Whether the tooltip is currently visible. */
  active?: boolean;
  /** Heading shown at the top of the tooltip (e.g. the x-axis label). */
  label?: string | number;
  /** Series to render as rows. */
  series?: ChartTooltipSeries[];
  /** Optional formatter applied to each series value. */
  valueFormatter?: (value: number) => string;
  /** Optional className merged onto the tooltip container. */
  className?: string;
}

/**
 * Shared tooltip used by the analytics charts.
 *
 * Renders a typed label plus one row per series, so charts can pass their
 * payload through without casting to `any`.
 */
export function ChartTooltip({
  active,
  label,
  series = [],
  valueFormatter,
  className,
}: ChartTooltipProps) {
  if (!active || series.length === 0) {
    return null;
  }

  const format = valueFormatter ?? ((value: number) => value.toLocaleString());

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border border-border/50 bg-background/95 px-3 py-2 text-xs shadow-md backdrop-blur",
        className
      )}
    >
      {label !== undefined && (
        <p className="mb-1 font-medium text-foreground">{label}</p>
      )}
      <ul className="flex flex-col gap-0.5">
        {series.map((item) => (
          <li key={item.name} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {item.color && (
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
              )}
              {item.name}
            </span>
            <span className="font-medium text-foreground">
              {format(item.value)}
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
