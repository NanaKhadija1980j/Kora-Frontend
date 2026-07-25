"use client";

/**
 * Shared error page UI — Issue #276
 *
 * Used by all Next.js route-level error.tsx boundaries.
 * Logs the error to /api/vitals for monitoring.
 */

import { useEffect } from "react";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("[ErrorBoundary]", error);

    // Log to /api/vitals for monitoring
    const payload = {
      metrics: [
        {
          name: "error",
          value: 1,
          id: error.digest ?? `error-${Date.now()}`,
          label: "error-boundary",
          startTime: Date.now(),
          rating: "poor" as const,
          url: typeof window !== "undefined" ? window.location.href : "/",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          timestamp: Date.now(),
          message: error.message,
        },
      ],
    };

    fetch("/api/vitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silently swallow — don't cause another error from the error handler
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800">
        <AlertTriangle className="h-8 w-8 text-zinc-400" />
      </div>

      <div className="space-y-2">
        {/* Kora logo text */}
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-500">⬡ Kora</p>
        <h1 className="text-2xl font-bold text-zinc-100">Something went wrong</h1>
        <p className="max-w-md text-sm text-zinc-400">
          An unexpected error occurred. You can try again or return to the home page.
        </p>
        {process.env.NODE_ENV === "development" && error.message && (
          <p className="mx-auto max-w-md rounded bg-zinc-800 px-3 py-1.5 font-mono text-xs text-zinc-500">
            {error.message}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={reset} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Try Again
        </Button>
        <Button asChild>
          <Link href="/" className="inline-flex items-center gap-2">
            <Home className="h-3.5 w-3.5" />
            Go Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
