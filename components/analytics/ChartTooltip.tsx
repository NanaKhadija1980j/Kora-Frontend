import React from "react";
import { format } from "date-fns";

export interface ChartTooltipPayloadItem {
  value?: number | string | Array<number | string>;
  name?: string | number;
}

/** Props injected by Recharts' `<Tooltip content={...} />` plus our `unit`. */
export interface ChartTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<ChartTooltipPayloadItem>;
  label?: string | number;
  unit?: string;
}

export default function ChartTooltip({ active, payload, label, unit = "USDC" }: ChartTooltipProps) {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  const item = payload[0];
  if (!item || item.value === undefined || item.value === null) return null;
  const value = item.value;
  const date = label;

  return (
    <div style={{ background: "rgba(24,24,27,0.9)", border: "1px solid #27272a", padding: 10, borderRadius: 8, color: "#e6eef0", minWidth: 160 }}>
      <div style={{ fontSize: 12, color: "#9ca3af" }}>{typeof date === "number" ? format(new Date(date), "yyyy-MM-dd") : (date ?? "")}</div>
      <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#14b8a6" }}>
          {unit === "USDC" ? `$${Number(value).toLocaleString()}` : Number(value).toLocaleString()}
        </div>
        <div style={{ fontSize: 12, color: "#9ca3af" }}>{item.name ?? ""}</div>
      </div>
    </div>
  );
}
