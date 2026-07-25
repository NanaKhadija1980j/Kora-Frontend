"use client";

/**
 * WebVitalsPanel — development-only collapsible overlay that displays live
 * Core Web Vitals readings with pass/fail colouring.
 *
 * Only rendered when:
 *   - process.env.NODE_ENV === "development", OR
 *   - NEXT_PUBLIC_ENABLE_DEVTOOLS === "true"
 *
 * Toggle with Ctrl+Shift+V (registered via useKeyboardShortcuts).
 * The panel is draggable and constrained to the viewport.
 *
 * Uses a global event bus (CustomEvent "kora:webvital") so it can receive
 * metrics from the reportWebVitals export in layout.tsx without prop-drilling.
 * Listens for "kora:toggle-webvitals" to show/hide.
 */

import React, { useEffect, useReducer, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { getVitalRating, VITAL_THRESHOLDS, type VitalRating } from "@/lib/webVitals";
import type { NextWebVitalsMetric } from "next/app";
import { ChevronDown, ChevronUp, Activity, X, GripVertical } from "lucide-react";

// ─── Dev guard ────────────────────────────────────────────────────────────────

const IS_DEV_ENABLED =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS === "true";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VitalEntry {
  name: string;
  value: number;
  rating: VitalRating;
  unit: string;
  displayValue: string;
  updatedAt: number;
}

type VitalsMap = Record<string, VitalEntry>;

interface Position {
  x: number;
  y: number;
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

function vitalsReducer(state: VitalsMap, metric: NextWebVitalsMetric): VitalsMap {
  const { name, value } = metric;
  const threshold = VITAL_THRESHOLDS[name];
  const unit = threshold?.unit ?? "";
  const displayValue = name === "CLS" ? value.toFixed(4) : `${Math.round(value)}${unit}`;
  return {
    ...state,
    [name]: {
      name,
      value,
      rating: getVitalRating(name, value),
      unit,
      displayValue,
      updatedAt: Date.now(),
    },
  };
}

// ─── Styling helpers ──────────────────────────────────────────────────────────

const RATING_DOT: Record<VitalRating, string> = {
  "good":              "bg-emerald-500",
  "needs-improvement": "bg-amber-400",
  "poor":              "bg-red-500",
};

const RATING_TEXT: Record<VitalRating, string> = {
  "good":              "text-emerald-400",
  "needs-improvement": "text-amber-400",
  "poor":              "text-red-400",
};

const RATING_LABEL: Record<VitalRating, string> = {
  "good":              "PASS",
  "needs-improvement": "WARN",
  "poor":              "FAIL",
};

// Ordered display list
const VITAL_ORDER = ["LCP", "FID", "INP", "CLS", "TTFB"];

// Panel dimensions (approximate) used to clamp drag position
const PANEL_WIDTH = 256;
const PANEL_HEIGHT_APPROX = 240;

// ─── Drag hook ────────────────────────────────────────────────────────────────

function useDraggable(initialPos: Position) {
  const [pos, setPos] = useState<Position>(initialPos);
  const dragging = useRef(false);
  const dragStart = useRef<{ mouseX: number; mouseY: number; panelX: number; panelY: number } | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Only drag on primary mouse button
    if (e.button !== 0) return;
    e.preventDefault();
    dragging.current = true;
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, panelX: pos.x, panelY: pos.y };
  }, [pos]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current || !dragStart.current) return;
      const dx = e.clientX - dragStart.current.mouseX;
      const dy = e.clientY - dragStart.current.mouseY;
      const newX = dragStart.current.panelX + dx;
      const newY = dragStart.current.panelY + dy;

      // Clamp to viewport
      const maxX = window.innerWidth - PANEL_WIDTH - 8;
      const maxY = window.innerHeight - PANEL_HEIGHT_APPROX - 8;
      setPos({
        x: Math.max(8, Math.min(newX, maxX)),
        y: Math.max(8, Math.min(newY, maxY)),
      });
    }

    function onMouseUp() {
      dragging.current = false;
      dragStart.current = null;
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return { pos, onMouseDown };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WebVitalsPanel() {
  // Production guard — completely absent from prod builds when devtools disabled
  if (!IS_DEV_ENABLED) return null;

  return <WebVitalsPanelInner />;
}

function WebVitalsPanelInner() {
  const [vitals, dispatch] = useReducer(vitalsReducer, {} as VitalsMap);
  const [collapsed, setCollapsed] = useState(false);
  const [visible, setVisible] = useState(true);

  const { pos, onMouseDown } = useDraggable({ x: 16, y: window.innerHeight - 260 });

  // Listen for vitals metrics via event bus
  useEffect(() => {
    function onVital(e: Event) {
      const metric = (e as CustomEvent<NextWebVitalsMetric>).detail;
      dispatch(metric);
    }
    window.addEventListener("kora:webvital", onVital);
    return () => window.removeEventListener("kora:webvital", onVital);
  }, []);

  // Listen for toggle event dispatched by KeyboardShortcutsProvider
  useEffect(() => {
    function onToggle() {
      setVisible((v) => !v);
    }
    window.addEventListener("kora:toggle-webvitals", onToggle);
    return () => window.removeEventListener("kora:toggle-webvitals", onToggle);
  }, []);

  if (!visible) return null;

  const entries = VITAL_ORDER.map((name) => vitals[name]).filter(Boolean) as VitalEntry[];
  const hasAnyPoor = entries.some((e) => e.rating === "poor");
  const hasAnyWarn = entries.some((e) => e.rating === "needs-improvement");
  const overallBadge = hasAnyPoor ? "poor" : hasAnyWarn ? "needs-improvement" : "good";

  return (
    <div
      data-testid="web-vitals-panel"
      style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 9999 }}
      className={cn(
        "w-64 rounded-xl border shadow-2xl",
        "bg-zinc-950/95 backdrop-blur-md border-zinc-800 text-zinc-100",
        "font-mono text-xs select-none"
      )}
      role="region"
      aria-label="Web Vitals Dev Panel"
    >
      {/* Drag handle + header */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-t-xl hover:bg-zinc-900/60 transition-colors"
        role="button"
        aria-expanded={!collapsed}
        aria-controls="web-vitals-body"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setCollapsed((c) => !c)}
      >
        {/* Drag grip */}
        <div
          className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 mr-1 text-zinc-600 hover:text-zinc-400 transition-colors"
          onMouseDown={onMouseDown}
          aria-label="Drag to reposition panel"
          title="Drag to move"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>

        <div
          className="flex items-center gap-2 flex-1 cursor-pointer"
          onClick={() => setCollapsed((c) => !c)}
        >
          <Activity className="h-3.5 w-3.5 text-teal-400" />
          <span className="font-semibold text-zinc-200 tracking-wide">Web Vitals</span>
          {entries.length > 0 && (
            <span
              className={cn(
                "rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                overallBadge === "good" && "bg-emerald-500/20 text-emerald-400",
                overallBadge === "needs-improvement" && "bg-amber-500/20 text-amber-400",
                overallBadge === "poor" && "bg-red-500/20 text-red-400"
              )}
            >
              {RATING_LABEL[overallBadge]}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand Web Vitals panel" : "Collapse Web Vitals panel"}
            className="rounded p-0.5 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {collapsed ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            className="rounded p-0.5 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
            onClick={() => setVisible(false)}
            aria-label="Hide Web Vitals panel (Ctrl+Shift+V to reopen)"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div id="web-vitals-body" className="px-3 pb-3 pt-1 space-y-1.5">
          {entries.length === 0 ? (
            <p className="text-zinc-500 text-[10px] py-2 text-center">
              Waiting for metrics…
              <br />
              <span className="text-zinc-600">Navigate or interact with the page</span>
            </p>
          ) : (
            entries.map((entry) => {
              return (
                <div
                  key={entry.name}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 bg-zinc-900/60"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", RATING_DOT[entry.rating])} />
                    <span className="text-zinc-400 w-8 flex-shrink-0">{entry.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("font-bold tabular-nums", RATING_TEXT[entry.rating])}>
                      {entry.displayValue}
                    </span>
                    <span
                      className={cn(
                        "text-[9px] font-bold uppercase tracking-wider px-1 rounded",
                        entry.rating === "good" && "text-emerald-500/70",
                        entry.rating === "needs-improvement" && "text-amber-500/70",
                        entry.rating === "poor" && "text-red-500/70"
                      )}
                    >
                      {RATING_LABEL[entry.rating]}
                    </span>
                  </div>
                </div>
              );
            })
          )}

          {/* Legend */}
          {entries.length > 0 && (
            <div className="pt-1 border-t border-zinc-800 flex items-center justify-between text-[9px] text-zinc-600">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> good
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> warn
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> poor
              </span>
            </div>
          )}

          <div className="pt-1 border-t border-zinc-800 text-[9px] text-zinc-700 text-center">
            Ctrl+Shift+V to toggle
          </div>
        </div>
      )}
    </div>
  );
}
