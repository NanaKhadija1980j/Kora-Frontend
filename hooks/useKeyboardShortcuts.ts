"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/store/uiStore";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ShortcutDefinition {
  /** Human-readable key sequence label, e.g. "⌘K" or "G M" */
  label: string;
  /** Short description shown in the reference modal */
  description: string;
  /** Category for grouping in the modal */
  category: "Navigation" | "Marketplace" | "Dashboard";
  /** When true, only registered in dev builds */
  devOnly?: boolean;
}

// ── Shortcut registry (exported for the modal) ────────────────────────────────
export const SHORTCUT_DEFINITIONS: Record<string, ShortcutDefinition> = {
  "cmd+k": {
    label: "⌘K / Ctrl+K",
    description: "Open search",
    category: "Marketplace",
  },
  "cmd+w": {
    label: "⌘W / Ctrl+W",
    description: "Open wallet modal",
    category: "Navigation",
  },
  "g m": {
    label: "G M",
    description: "Go to Marketplace",
    category: "Marketplace",
  },
  "g d": {
    label: "G D",
    description: "Go to Dashboard",
    category: "Dashboard",
  },
  "g c": {
    label: "G C",
    description: "Go to Create Invoice",
    category: "Marketplace",
  },
  "g t": {
    label: "G T",
    description: "Go to Transaction History",
    category: "Dashboard",
  },
  "g a": {
    label: "G A",
    description: "Go to Analytics",
    category: "Dashboard",
  },
  "?": {
    label: "?",
    description: "Open shortcut reference",
    category: "Navigation",
  },
  ...(process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS === "true"
    ? {
        "ctrl+shift+v": {
          label: "Ctrl+Shift+V",
          description: "Toggle Web Vitals panel (dev only)",
          category: "Navigation" as const,
          devOnly: true,
        },
      }
    : {}),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true when the event target is an interactive text input */
function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = (el as HTMLElement).tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

/** Normalise a KeyboardEvent into a canonical key string */
function eventToKey(e: KeyboardEvent): string {
  const mod = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();
  if (mod && e.shiftKey) return `ctrl+shift+${key}`;
  if (mod) return `cmd+${key}`;
  return key;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
/**
 * useKeyboardShortcuts
 *
 * Registers global keyboard shortcuts. Supports:
 * - Single-key shortcuts (e.g. "?")
 * - Modifier shortcuts (e.g. Cmd/Ctrl+K)
 * - Two-key sequences (e.g. "G M" — press G then M within 1 500 ms)
 *
 * Shortcuts are disabled when the user is typing in an input field, or when
 * `shortcutsEnabled` is false in the UI store.
 */
export function useKeyboardShortcuts({
  onOpenSearch,
  onOpenShortcutModal,
  onToggleWebVitals,
}: {
  onOpenSearch?: () => void;
  onOpenShortcutModal?: () => void;
  onToggleWebVitals?: () => void;
}) {
  const router = useRouter();
  const setWalletModalOpen = useUIStore((s) => s.setWalletModalOpen);
  const shortcutsEnabled = useUIStore((s) => s.shortcutsEnabled);

  // Sequence buffer: stores the last key pressed for two-key sequences
  const sequenceRef = useRef<string | null>(null);
  const sequenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSequence = useCallback(() => {
    sequenceRef.current = null;
    if (sequenceTimerRef.current) {
      clearTimeout(sequenceTimerRef.current);
      sequenceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!shortcutsEnabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Never fire when user is typing
      if (isInputFocused()) return;

      const key = eventToKey(e);

      // ── Modifier shortcuts (fire immediately) ──────────────────────────────
      if (key === "cmd+k") {
        e.preventDefault();
        onOpenSearch?.();
        clearSequence();
        return;
      }

      if (key === "cmd+w") {
        // Only intercept if not a browser tab-close scenario (no modifier ambiguity on Mac)
        e.preventDefault();
        setWalletModalOpen(true);
        clearSequence();
        return;
      }

      // ── Dev-only shortcuts ─────────────────────────────────────────────────
      if (
        key === "ctrl+shift+v" &&
        process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS === "true"
      ) {
        e.preventDefault();
        onToggleWebVitals?.();
        clearSequence();
        return;
      }

      // ── Single-key shortcuts ───────────────────────────────────────────────
      if (key === "?") {
        e.preventDefault();
        onOpenShortcutModal?.();
        clearSequence();
        return;
      }

      // ── Two-key sequences (G + letter) ─────────────────────────────────────
      if (key === "g" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        clearSequence();
        sequenceRef.current = "g";
        // Auto-clear after 1.5 s if no second key
        sequenceTimerRef.current = setTimeout(clearSequence, 1500);
        return;
      }

      if (sequenceRef.current === "g") {
        clearSequence();
        switch (key) {
          case "m":
            e.preventDefault();
            router.push("/marketplace");
            break;
          case "d":
            e.preventDefault();
            router.push("/dashboard/investor");
            break;
          case "c":
            e.preventDefault();
            router.push("/invoice/create");
            break;
          case "t":
            e.preventDefault();
            router.push("/transactions");
            break;
          case "a":
            e.preventDefault();
            router.push("/analytics");
            break;
          default:
            break;
        }
        return;
      }

      // Any other key clears the sequence buffer
      clearSequence();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearSequence();
    };
  }, [
    shortcutsEnabled,
    router,
    setWalletModalOpen,
    onOpenSearch,
    onOpenShortcutModal,
    onToggleWebVitals,
    clearSequence,
  ]);
}
