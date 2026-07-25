/**
 * Web Vitals monitoring utilities for Kora Protocol.
 *
 * Development: logs all vitals to console with pass/fail against Core Web Vitals thresholds.
 * Production:  sends vitals to /api/vitals endpoint.
 *
 * Thresholds (Google Core Web Vitals 2024):
 *   LCP  < 2500ms  (good) / < 4000ms (needs improvement)
 *   FID  < 100ms   (good) / < 300ms  (needs improvement)
 *   CLS  < 0.1     (good) / < 0.25   (needs improvement)
 *   TTFB < 800ms   (good) / < 1800ms (needs improvement)
 *   INP  < 200ms   (good) / < 500ms  (needs improvement)
 */

import type { NextWebVitalsMetric } from "next/app";

// ─── Thresholds ───────────────────────────────────────────────────────────────

export type VitalRating = "good" | "needs-improvement" | "poor";

export interface VitalThreshold {
  good: number;
  needsImprovement: number;
  unit: string;
}

export const VITAL_THRESHOLDS: Record<string, VitalThreshold> = {
  LCP:  { good: 2500,  needsImprovement: 4000,  unit: "ms" },
  FID:  { good: 100,   needsImprovement: 300,   unit: "ms" },
  CLS:  { good: 0.1,   needsImprovement: 0.25,  unit: "" },
  TTFB: { good: 800,   needsImprovement: 1800,  unit: "ms" },
  INP:  { good: 200,   needsImprovement: 500,   unit: "ms" },
};

export function getVitalRating(name: string, value: number): VitalRating {
  const threshold = VITAL_THRESHOLDS[name];
  if (!threshold) return "good";
  if (value <= threshold.good) return "good";
  if (value <= threshold.needsImprovement) return "needs-improvement";
  return "poor";
}

// ─── Console logger (development) ────────────────────────────────────────────

const RATING_STYLES: Record<VitalRating, string> = {
  "good":              "color: #22c55e; font-weight: bold",
  "needs-improvement": "color: #f59e0b; font-weight: bold",
  "poor":              "color: #ef4444; font-weight: bold",
};

const RATING_LABELS: Record<VitalRating, string> = {
  "good":              "✅ PASS",
  "needs-improvement": "⚠️  WARN",
  "poor":              "❌ FAIL",
};

export function logVitalToConsole(metric: NextWebVitalsMetric): void {
  const { name, value, id, label } = metric;
  const threshold = VITAL_THRESHOLDS[name];
  const rating = getVitalRating(name, value);
  const unit = threshold?.unit ?? "";
  const displayValue = name === "CLS" ? value.toFixed(4) : `${Math.round(value)}${unit}`;

  const style = RATING_STYLES[rating];
  const badge = RATING_LABELS[rating];

  console.groupCollapsed(
    `%c${badge}%c  Web Vital: %c${name}%c = ${displayValue}`,
    style,
    "color: inherit; font-weight: normal",
    "color: #14b8a6; font-weight: bold",
    "color: inherit"
  );
  console.log("Value:   ", displayValue);
  console.log("Rating:  ", rating);
  console.log("ID:      ", id);
  console.log("Label:   ", label);
  if (threshold) {
    console.log(
      `Threshold: good < ${threshold.good}${unit} | needs-improvement < ${threshold.needsImprovement}${unit}`
    );
  }
  console.groupEnd();

  // Warn loudly when a vital exceeds its threshold
  if (rating === "poor") {
    console.warn(
      `[Kora Web Vitals] ❌ ${name} is POOR (${displayValue}). ` +
        `Threshold: good < ${threshold?.good}${unit}. ` +
        `This will hurt Core Web Vitals scores.`
    );
  } else if (rating === "needs-improvement") {
    console.warn(
      `[Kora Web Vitals] ⚠️  ${name} needs improvement (${displayValue}). ` +
        `Target: < ${threshold?.good}${unit}.`
    );
  }
}

// ─── Production reporter ──────────────────────────────────────────────────────

/** Batched queue so we don't fire a request per metric */
let _queue: NextWebVitalsMetric[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(): void {
  if (_flushTimer !== null) return;
  _flushTimer = setTimeout(() => {
    flushVitals();
    _flushTimer = null;
  }, 2000); // batch within 2 s
}

export function flushVitals(): void {
  if (_queue.length === 0) return;
  const payload = _queue.splice(0);

  const body = JSON.stringify({
    metrics: payload.map(({ name, value, id, label, startTime }) => ({
      name,
      value: name === "CLS" ? Number(value.toFixed(4)) : Math.round(value),
      id,
      label,
      startTime: Math.round(startTime),
      rating: getVitalRating(name, value),
      url: typeof window !== "undefined" ? window.location.pathname : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      timestamp: Date.now(),
    })),
  });

  // Use sendBeacon when available (non-blocking, survives page unload)
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/vitals", new Blob([body], { type: "application/json" }));
  } else {
    fetch("/api/vitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Silently ignore — vitals reporting must never break the app
    });
  }
}

export function sendVitalToEndpoint(metric: NextWebVitalsMetric): void {
  _queue.push(metric);
  scheduleFlush();
}

// ─── Main handler (used by reportWebVitals in layout.tsx) ────────────────────

export function handleWebVital(metric: NextWebVitalsMetric): void {
  if (process.env.NODE_ENV === "development") {
    logVitalToConsole(metric);
  } else {
    sendVitalToEndpoint(metric);
  }
}
