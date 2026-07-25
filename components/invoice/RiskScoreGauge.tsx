"use client";

import { useEffect, useMemo, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, Tooltip } from "recharts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RiskFactor {
  key: string;
  label: string;
  score: number;
}

interface RiskScoreGaugeProps {
  score: number;
  tier: string;
  factors: RiskFactor[];
  trend: number[];
}

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

function tierVariant(tier: string): "success" | "warning" | "danger" {
  if (tier === "AAA" || tier === "AA" || tier === "A") return "success";
  if (tier === "BBB" || tier === "BB") return "warning";
  return "danger";
}

function scoreColor(score: number) {
  if (score <= 33) return "#15803d";
  if (score <= 66) return "#a16207";
  return "#b91c1c";
}

const RISK_BANDS = [
  {
    id: "low",
    label: "Low Risk",
    range: "0–33",
    dot: "bg-green-700 dark:bg-green-500",
    text: "text-green-800 dark:text-green-300",
    icon: ShieldCheck,
    description:
      "Strong repayment history, stable debtor finances, complete verification, and comfortable collateral coverage.",
  },
  {
    id: "medium",
    label: "Medium Risk",
    range: "34–66",
    dot: "bg-yellow-600 dark:bg-yellow-400",
    text: "text-yellow-800 dark:text-yellow-200",
    icon: ShieldAlert,
    description:
      "Mixed payment history, moderate concentration or tenor, and financial indicators that need closer review.",
  },
  {
    id: "high",
    label: "High Risk",
    range: "67–100",
    dot: "bg-red-700 dark:bg-red-500",
    text: "text-red-800 dark:text-red-300",
    icon: ShieldX,
    description:
      "Weak or limited repayment history, elevated debtor exposure, verification gaps, or low collateral coverage.",
  },
] as const;

export function RiskScoreGauge({
  score,
  tier,
  factors,
  trend,
}: RiskScoreGaugeProps) {
  const [expanded, setExpanded] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const [selectedBand, setSelectedBand] = useState<string | null>(null);
  const [hoveredBand, setHoveredBand] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const boundedScore = clamp(score);
  const radius = 62;
  const circumference = Math.PI * radius;
  const dashOffset = circumference * (1 - boundedScore / 100);

  useEffect(() => {
    if (reduceMotion) {
      setDisplayScore(boundedScore);
      return;
    }
    const controls = animate(0, boundedScore, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (value) => setDisplayScore(Math.round(value)),
    });
    return () => controls.stop();
  }, [boundedScore, reduceMotion]);

  const trendData = useMemo(
    () =>
      trend.slice(-5).map((value, idx) => ({
        index: idx + 1,
        score: clamp(value),
      })),
    [trend],
  );

  return (
    <div className="space-y-4">
      <div className="relative mx-auto w-full max-w-[230px] pt-4">
        <svg
          viewBox="0 0 160 100"
          className="h-36 w-full"
          role="img"
          aria-label={`Risk score ${boundedScore} out of 100`}
        >
          <defs>
            <linearGradient id="riskGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#15803d" />
              <stop offset="50%" stopColor="#ca8a04" />
              <stop offset="100%" stopColor="#b91c1c" />
            </linearGradient>
          </defs>
          <path
            d="M 18 82 A 62 62 0 0 1 142 82"
            fill="none"
            stroke="rgba(148, 163, 184, 0.2)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <motion.path
            d="M 18 82 A 62 62 0 0 1 142 82"
            fill="none"
            stroke="url(#riskGradient)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={reduceMotion ? false : { strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: "spring", damping: 22, stiffness: 90 }
            }
          />
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-5">
          <span
            className="text-4xl font-bold"
            style={{ color: scoreColor(boundedScore) }}
          >
            {displayScore}
          </span>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Risk score
          </span>
          <Badge
            variant={tierVariant(tier)}
            className="mt-2 px-2 py-0.5 text-[11px] font-semibold"
          >
            Tier {tier}
          </Badge>
        </div>
      </div>

      <div
        className="rounded-xl border border-border bg-muted/30 p-3"
        aria-label="Risk score band legend"
        data-testid="risk-band-legend"
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
          Risk bands
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {RISK_BANDS.map((band) => {
            const shown = (hoveredBand ?? selectedBand) === band.id;
            const BandIcon = band.icon;
            return (
              <div key={band.id} className="relative">
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    band.text,
                  )}
                  aria-describedby={shown ? `risk-band-${band.id}` : undefined}
                  aria-expanded={shown}
                  onClick={() =>
                    setSelectedBand((selected) =>
                      selected === band.id ? null : band.id,
                    )
                  }
                  onMouseEnter={() => setHoveredBand(band.id)}
                  onMouseLeave={() => setHoveredBand(null)}
                  onFocus={() => setHoveredBand(band.id)}
                  onBlur={() => setHoveredBand(null)}
                >
                  <span
                    className={cn("h-3 w-3 shrink-0 rounded-full", band.dot)}
                    aria-hidden="true"
                  />
                  {/* Icon supplements color — satisfies WCAG 1.4.1 */}
                  <BandIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="block font-semibold">{band.label}</span>
                    <span className="text-muted-foreground">{band.range}</span>
                  </span>
                </button>
                {shown && (
                  <div
                    id={`risk-band-${band.id}`}
                    role="tooltip"
                    className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-lg border border-border bg-popover p-3 text-xs leading-relaxed text-popover-foreground shadow-lg"
                  >
                    {band.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-controls="risk-score-breakdown"
        className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
      >
        <span>Score Breakdown</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div
          id="risk-score-breakdown"
          className="space-y-2 rounded-lg border border-border bg-card p-3"
        >
          {factors.map((factor) => (
            <div key={factor.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{factor.label}</span>
                <span className="font-medium text-foreground">
                  {factor.score}/100
                </span>
              </div>
              <div className="h-1.5 w-full rounded bg-muted">
                <div
                  className="h-1.5 rounded"
                  style={{
                    width: `${clamp(factor.score)}%`,
                    backgroundColor: scoreColor(factor.score),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-3">
        <p className="mb-2 text-xs text-muted-foreground">
          Historical risk trend (last 5 invoices)
        </p>
        <div className="h-16 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <Tooltip
                cursor={false}
                formatter={(value: number) => [`${value}/100`, "Score"]}
                labelFormatter={(label) => `Invoice ${label}`}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={{ r: 2, fill: "#38bdf8" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
