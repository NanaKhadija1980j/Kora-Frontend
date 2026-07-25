"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

/**
 * Get all focusable elements within a container.
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'button:not([disabled])',
    'a[href]',
    'input:not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
}

/**
 * Drawer component - a slide-in panel from the right side of the screen.
 * Used for detailed views like position details in the investor dashboard.
 * Features:
 * - Focus trap: keyboard users cannot tab outside the drawer
 * - Focus restoration: returns focus to the trigger element on close
 * - Escape key closes the drawer
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "md",
}: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store the currently focused element before opening
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = "hidden";

      // Focus the first focusable element in the drawer
      setTimeout(() => {
        if (drawerRef.current) {
          const focusables = getFocusableElements(drawerRef.current);
          if (focusables.length > 0) {
            focusables[0].focus();
          }
        }
      }, 50);
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open]);

  // Handle Escape key and focus trap
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onOpenChange(false);
      return;
    }

    if (e.key === 'Tab' && drawerRef.current) {
      const focusables = getFocusableElements(drawerRef.current);
      if (focusables.length === 0) return;

      const firstElement = focusables[0];
      const lastElement = focusables[focusables.length - 1];

      // If shift+tab on first element, go to last
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
      // If tab on last element, go to first
      else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }, [onOpenChange]);

  // Restore focus on close
  useEffect(() => {
    return () => {
      if (!open && previousFocusRef.current) {
        previousFocusRef.current?.focus();
        previousFocusRef.current = null;
      }
    };
  }, [open]);

  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-zinc-950/75 backdrop-blur-xs"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={cn(
          "fixed right-0 top-0 z-50 h-full bg-background border-l border-border shadow-lg transform transition-transform duration-300 flex flex-col outline-none",
          open ? "translate-x-0" : "translate-x-full",
          sizeClasses[size]
        )}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
          <div className="flex-1">
            {title && <h2 className="text-lg font-semibold text-foreground">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="ml-4 inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </>
  );
}

interface DrawerContentProps {
  children: React.ReactNode;
  className?: string;
}

export function DrawerContent({ children, className }: DrawerContentProps) {
  return <div className={cn("space-y-6", className)}>{children}</div>;
}

interface DrawerSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function DrawerSection({ title, description, children }: DrawerSectionProps) {
  return (
    <div className="space-y-2">
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}
