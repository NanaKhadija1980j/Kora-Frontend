import React from "react";
import { CATEGORIES } from "./filters";

export default function CategoryFilter({ selected = [], onToggle }: any) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-foreground">Category</h3>
      <div className="grid grid-cols-2 gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onToggle(c.key)}
            className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors ${selected.includes(c.key) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            <span className="text-lg">{c.icon}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
