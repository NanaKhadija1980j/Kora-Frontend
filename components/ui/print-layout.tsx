"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Inject print styles once on mount — hides navbar, wallet button, and funding panel
const PRINT_STYLES = `
@media print {
  nav, header, [data-print-hide] { display: none !important; }
  .print-layout { display: block !important; }
}
`;

function usePrintStyles() {
  React.useEffect(() => {
    if (document.getElementById("kora-print-styles")) return;
    const el = document.createElement("style");
    el.id = "kora-print-styles";
    el.textContent = PRINT_STYLES;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);
}

interface PrintLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
}

/**
 * PrintLayout — wraps content in a print-friendly container.
 * Adds a header with title/subtitle visible only in print mode.
 * Use alongside window.print() or the PDF export utility.
 */
export function PrintLayout({ children, title, subtitle, className }: PrintLayoutProps) {
  usePrintStyles();
  return (
    <div className={cn("print-layout", className)}>
      {(title || subtitle) && (
        <div className="print-header hidden print:block mb-6 border-b border-gray-200 pb-4">
          {title && <h1 className="text-xl font-bold text-gray-900">{title}</h1>}
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
          <p className="mt-1 text-xs text-gray-400">
            Generated: {new Date().toLocaleDateString("en-US", { dateStyle: "long" })}
          </p>
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * PrintButton — triggers window.print() with optional pre-print callback.
 */
interface PrintButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onBeforePrint?: () => void;
  label?: string;
}

export function PrintButton({ onBeforePrint, label = "Print", className, ...props }: PrintButtonProps) {
  const handlePrint = () => {
    onBeforePrint?.();
    window.print();
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      className={cn(
        "print:hidden inline-flex items-center gap-2 rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors",
        className
      )}
      {...props}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
      {label}
    </button>
  );
}
