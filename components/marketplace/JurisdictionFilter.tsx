import React from "react";
import { JURISDICTIONS } from "./filters";
import { getJurisdictionFlag } from "@/lib/utils";

export default function JurisdictionFilter({ selected = [], onToggle }: any) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-foreground">Jurisdiction</h3>
      <div className="grid grid-cols-2 gap-2">
        {JURISDICTIONS.map((j) => (
          <button
            key={j.code}
            type="button"
            onClick={() => onToggle(j.code)}
            className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors ${selected.includes(j.code) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            <span className="text-lg" role="img" aria-label={j.name}>
              {getJurisdictionFlag(j.code)}
            </span>
            <span>{j.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
