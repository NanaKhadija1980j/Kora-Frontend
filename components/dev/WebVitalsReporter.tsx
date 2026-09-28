"use client";

import { useReportWebVitals } from "next/web-vitals";
import { handleWebVital } from "@/lib/webVitals";

export function WebVitalsReporter() {
  useReportWebVitals((metric: any) => {
    handleWebVital(metric as any);
    if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("kora:webvital", { detail: metric })
      );
    }
  });
  return null;
}
