"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * BottomSheet component - a slide-up panel from the bottom of the screen.
 * Mobile-optimized for responsive layouts, appears on screens below lg breakpoint.
 * Dismissible by overlay tap or swipe (swipe via browser back gesture).
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
}: BottomSheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop - dismissible by tap */}
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Bottom Sheet Panel */}
      <div className="fixed inset-0 z-50 flex items-end justify-center lg:hidden">
        <div
          className={cn(
            "relative z-50 w-full rounded-t-[32px] border border-zinc-900 bg-zinc-950 p-6 shadow-2xl shadow-black/40",
            "max-h-[90vh] overflow-hidden",
            "animate-in slide-in-from-bottom-5 duration-300"
          )}
        >
          {/* Header with title and close button */}
          {title && (
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-6">
              <h2 className="text-md font-bold text-zinc-150">{title}</h2>
              <button
                onClick={() => onOpenChange(false)}
                aria-label={`Close ${title}`}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Scrollable content area */}
          <div className={cn(
            "flex flex-col overflow-hidden",
            title ? "h-[calc(90vh-5rem)]" : "h-[calc(90vh-1.5rem)]"
          )}>
            <div className="overflow-y-auto pr-2 space-y-6">
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
