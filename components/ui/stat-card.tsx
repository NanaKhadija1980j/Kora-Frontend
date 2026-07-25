import { cn, formatCurrency } from "@/lib/utils";
import { StatCardSkeleton } from "./skeleton";
import { LineChart, Line } from "recharts";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { useEffect, useState } from "react";
import { useMotionValue, animate } from "framer-motion";

interface Trend {
  percentage: number;
}

interface StatCardProps {
  label: string;
  value: string | number;
  valueRaw?: number; // numeric value for animation/formatting
  trend?: Trend | null;
  sparklineData?: number[];
  isLoading?: boolean;
  prefix?: string;
  suffix?: string;
  icon?: React.ReactNode;
  className?: string;
}

function formatNumber(n: number) {
  return Math.round(n).toLocaleString();
}

export function StatCard({
  label,
  value,
  valueRaw,
  trend,
  sparklineData,
  isLoading,
  prefix,
  suffix,
  icon,
  className,
}: StatCardProps) {
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState<number>(typeof valueRaw === "number" ? valueRaw : 0);

  useEffect(() => {
    if (isLoading) return;
    const target = typeof valueRaw === "number" ? valueRaw : typeof value === "number" ? value : 0;
    const controls = animate(mv, target, { duration: 1.1, ease: "easeOut" });
    const unsubscribe = mv.onChange((v) => setDisplay(v));
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [valueRaw, value, isLoading, mv]);

  if (isLoading) return <StatCardSkeleton />;

  const trendIcon = trend ? trend.percentage : 0;
  const trendNode = trend ? (
    <div className={cn("ml-2 flex items-center text-sm font-medium", trend.percentage > 0 ? "text-emerald-400" : trend.percentage < 0 ? "text-red-400" : "text-zinc-400") }>
      {trend.percentage > 0 ? <ArrowUp className="h-3 w-3" /> : trend.percentage < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      <span className="ml-1">{Math.abs(trend.percentage).toFixed(1)}%</span>
    </div>
  ) : null;

  return (
    <div className={cn("rounded-xl border border-border bg-card/60 p-5 backdrop-blur-sm", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="flex items-center gap-2">
          {icon && <div className="text-muted-foreground">{icon}</div>}
          {trendNode}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-4">
        <div>
          <p className="text-2xl font-semibold tracking-tight text-foreground">
            {typeof valueRaw === "number" || typeof value === "number" ? (
              <span>
                {prefix ?? ""}
                {typeof valueRaw === "number" ? formatCurrency(Math.round(display), prefix ? "USDC" : "", !!prefix) : formatNumber(display)}
                {suffix ?? ""}
              </span>
            ) : (
              <span>{value}</span>
            )}
          </p>
        </div>

        {sparklineData && sparklineData.length > 0 && (
          <div className="w-24 h-10">
            <LineChart data={sparklineData.map((v) => ({ v }))} width={96} height={40}>
              <Line type="monotone" dataKey="v" stroke="#14b8a6" strokeWidth={2} dot={false} />
            </LineChart>
          </div>
        )}
      </div>
    </div>
  );
}
