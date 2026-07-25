"use client";

import React from "react";
import { CheckCircle2, Circle, Clock, TrendingUp } from "lucide-react";
import { cn, formatDate, daysUntil } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RepaymentTimelineProps {
  /** ISO 8601 date when the position was funded */
  fundedAt: string;
  /** ISO 8601 expected maturity / repayment date */
  maturityDate: string;
  /**
   * ISO 8601 actual repayment date — provide only when `isRepaid` is true.
   * Falls back to `maturityDate` for display when absent.
   */
  repaidAt?: string;
  /** Whether the position has been fully repaid */
  isRepaid?: boolean;
  /**
   * Yield received at repayment — shown in the repaid milestone when provided.
   * Formatted externally so the caller can use `formatCurrency` from lib/utils.
   */
  yieldReceived?: string;
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Clamp a value between 0 and 100 (inclusive).
 */
function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Calculate how far along the timeline the current date is, expressed as a
 * percentage between `start` and `end`.
 */
function calcProgress(start: Date, end: Date, now: Date): number {
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 100;
  const elapsed = now.getTime() - start.getTime();
  return clamp((elapsed / total) * 100);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MilestoneProps {
  label: string;
  date: string;
  completed: boolean;
  active?: boolean;
  icon: React.ReactNode;
  sub?: React.ReactNode;
  /** Alignment: left milestone anchors left, right anchors right, centre centres */
  align?: "left" | "center" | "right";
}

function Milestone({ label, date, completed, active, icon, sub, align = "center" }: MilestoneProps) {
  const dotClasses = cn(
    "relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
    completed
      ? "border-emerald-500 bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]"
      : active
      ? "border-primary bg-primary text-primary-foreground shadow-[0_0_12px_rgba(99,102,241,0.4)] animate-pulse"
      : "border-border bg-muted text-muted-foreground",
  );

  const textAlignClass =
    align === "left" ? "items-start text-left" : align === "right" ? "items-end text-right" : "items-center text-center";

  return (
    <div className={cn("flex flex-col gap-2", textAlignClass)}>
      {/* Label + Date above the dot */}
      <div className="space-y-0.5">
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            completed ? "text-emerald-400" : active ? "text-primary" : "text-muted-foreground",
          )}
        >
          {label}
        </p>
        <p className="text-[11px] text-muted-foreground">{formatDate(date)}</p>
        {sub && <div className="mt-0.5">{sub}</div>}
      </div>

      {/* Dot */}
      <div className={dotClasses}>{icon}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * RepaymentTimeline renders a horizontal three-milestone timeline:
 *
 *   Funded ────────────── [today marker] ──────────── Maturity ── Repaid
 *
 * - When `isRepaid` is false the "Repaid" milestone is rendered as a future
 *   placeholder with a dashed connector.
 * - When `isRepaid` is true all milestones are filled and the actual
 *   repayment date (plus optional yield) is shown.
 * - The current-date marker slides along the progress bar showing exactly
 *   where in the lifecycle the position sits today.
 */
export function RepaymentTimeline({
  fundedAt,
  maturityDate,
  repaidAt,
  isRepaid = false,
  yieldReceived,
  className,
}: RepaymentTimelineProps) {
  const now = new Date();
  const startDate = new Date(fundedAt);
  const endDate = new Date(maturityDate);

  // Progress percentage for the filled part of the bar (funded → maturity).
  const progressPct = isRepaid ? 100 : calcProgress(startDate, endDate, now);

  // Days remaining label shown beneath the maturity milestone when active.
  const daysLeft = isRepaid ? 0 : daysUntil(maturityDate);

  // The displayed date for the repaid milestone.
  const displayRepaidAt = repaidAt ?? maturityDate;

  return (
    <div className={cn("w-full select-none", className)} aria-label="Repayment timeline">
      {/* ── Milestones row ─────────────────────────────────────────────────── */}
      <div className="relative flex items-end justify-between">
        {/* Left milestone: Funded */}
        <Milestone
          label="Funded"
          date={fundedAt}
          completed
          icon={<CheckCircle2 className="h-4 w-4" />}
          align="left"
        />

        {/* Centre milestone: Maturity */}
        <Milestone
          label="Maturity"
          date={maturityDate}
          completed={isRepaid || now >= endDate}
          active={!isRepaid && now < endDate && progressPct >= 50}
          icon={
            isRepaid || now >= endDate ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Clock className="h-4 w-4" />
            )
          }
          sub={
            !isRepaid && daysLeft > 0 ? (
              <span className="text-[11px] font-medium text-amber-400">
                {daysLeft}d left
              </span>
            ) : null
          }
          align="center"
        />

        {/* Right milestone: Repaid */}
        <Milestone
          label="Repaid"
          date={displayRepaidAt}
          completed={isRepaid}
          icon={
            isRepaid ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <Circle className="h-4 w-4" />
            )
          }
          sub={
            isRepaid && yieldReceived ? (
              <span className="text-[11px] font-semibold text-emerald-400">
                +{yieldReceived}
              </span>
            ) : null
          }
          align="right"
        />
      </div>

      {/* ── Progress bar ───────────────────────────────────────────────────── */}
      <div className="relative mt-3 flex items-center">
        {/* Track background */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
          {/* Filled portion */}
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              isRepaid
                ? "bg-gradient-to-r from-primary via-emerald-500 to-emerald-400"
                : "bg-gradient-to-r from-primary to-primary/60",
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Dashed extension for the "not yet repaid" segment (maturity → repaid) */}
        {!isRepaid && (
          <div
            className="absolute right-0 h-px border-t-2 border-dashed border-border"
            style={{ width: `${100 - progressPct}%`, right: 0 }}
            aria-hidden="true"
          />
        )}

        {/* Current-date marker — only shown for in-progress positions */}
        {!isRepaid && progressPct > 0 && progressPct < 100 && (
          <div
            className="absolute -top-1.5 z-10 flex flex-col items-center"
            style={{ left: `calc(${progressPct}% - 7px)` }}
            aria-label={`Today: ${formatDate(now.toISOString())}`}
          >
            {/* Thumb */}
            <div className="h-4 w-3.5 rounded-sm bg-primary shadow-[0_0_8px_rgba(99,102,241,0.6)] ring-1 ring-primary/40" />
            {/* Tick label */}
            <span className="mt-1 whitespace-nowrap rounded bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary ring-1 ring-primary/20">
              Today
            </span>
          </div>
        )}
      </div>

      {/* ── Status badge ───────────────────────────────────────────────────── */}
      <div className="mt-4 flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
            isRepaid
              ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
              : now >= endDate
              ? "bg-amber-500/10 text-amber-400 ring-amber-500/20"
              : "bg-primary/10 text-primary ring-primary/20",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isRepaid ? "bg-emerald-400" : now >= endDate ? "bg-amber-400" : "bg-primary",
            )}
          />
          {isRepaid ? "Completed" : now >= endDate ? "Awaiting repayment" : "Active — in progress"}
        </span>

        {!isRepaid && (
          <span className="text-xs text-muted-foreground">
            {Math.round(progressPct)}% of lifecycle elapsed
          </span>
        )}
      </div>
    </div>
  );
}
