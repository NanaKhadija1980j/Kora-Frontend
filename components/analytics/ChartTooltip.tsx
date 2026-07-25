import React from "react";
import { format } from "date-fns";

export default function ChartTooltip({ active, payload, label, unit = "USDC" }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const value = item.value;
  const date = label;

  return (
    <div style={{ background: "rgba(24,24,27,0.9)", border: "1px solid #27272a", padding: 10, borderRadius: 8, color: "#e6eef0", minWidth: 160 }}>
      <div style={{ fontSize: 12, color: "#9ca3af" }}>{typeof date === "string" ? date : format(new Date(date), "yyyy-MM-dd")}</div>
      <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#14b8a6" }}>
          {unit === "USDC" ? `$${Number(value).toLocaleString()}` : Number(value).toLocaleString()}
        </div>
        <div style={{ fontSize: 12, color: "#9ca3af" }}>{item.name ?? ""}</div>
      </div>
    </div>
  );
}
