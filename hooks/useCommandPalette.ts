"use client";

import { useCallback, useEffect } from "react";
import { useUIStore } from "@/store/uiStore";

const RECENT_KEY = "kora-cmd-recent";
const MAX_RECENT = 5;

export interface RecentItem {
  id: string;
  label: string;
  href: string;
  type: "page" | "invoice";
}

/**
 * Short list of command-palette–specific shortcuts for the
 * ShortcutReferenceModal (complements SHORTCUT_DEFINITIONS in useKeyboardShortcuts).
 */
export const COMMAND_PALETTE_SHORTCUTS: Array<{
  label: string;
  description: string;
}> = [
  { label: "⌘K / Ctrl+K", description: "Open / close command palette" },
  { label: "↑ ↓", description: "Navigate results" },
  { label: "↵", description: "Select highlighted command" },
  { label: "Esc", description: "Close command palette" },
];

function loadRecent(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecent(items: RecentItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(RECENT_KEY, JSON.stringify(items));
}

export function useCommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);

  // Cmd/Ctrl+K global shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setOpen]);

  const getRecent = useCallback((): RecentItem[] => loadRecent(), []);

  const pushRecent = useCallback((item: RecentItem) => {
    const prev = loadRecent().filter((r) => r.id !== item.id);
    saveRecent([item, ...prev].slice(0, MAX_RECENT));
  }, []);

  const clearRecent = useCallback(() => {
    saveRecent([]);
  }, []);

  return { open, setOpen, getRecent, pushRecent, clearRecent };
}
