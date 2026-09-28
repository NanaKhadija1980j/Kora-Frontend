"use client";

import { useState, useCallback, useEffect } from "react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useUIStore } from "@/store/uiStore";
import { ShortcutReferenceModal } from "./ShortcutReferenceModal";

/**
 * KeyboardShortcutsProvider
 *
 * Mounts the global keyboard shortcut listener and renders the shortcut
 * reference modal. Drop this inside <Providers> so it's available app-wide.
 *
 * Search (⌘K) opens the CommandPalette directly via UIStore rather than
 * dispatching a custom event. The Navbar keyboard icon also dispatches
 * "kora:open-shortcut-modal" which is handled here.
 *
 * Ctrl+Shift+V dispatches "kora:toggle-webvitals" (dev mode only).
 */
export function KeyboardShortcutsProvider() {
  const [shortcutModalOpen, setShortcutModalOpen] = useState(false);
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);

  // Open the command palette directly — the old custom-event approach had no
  // listener on the receiving end, so this was a dead code path before.
  const handleOpenSearch = useCallback(() => {
    setCommandPaletteOpen(true);
  }, [setCommandPaletteOpen]);

  const handleOpenShortcutModal = useCallback(() => {
    setShortcutModalOpen(true);
  }, []);

  const handleToggleWebVitals = useCallback(() => {
    window.dispatchEvent(new CustomEvent("kora:toggle-webvitals"));
  }, []);

  // Also listen for the custom event dispatched by the Navbar keyboard button
  useEffect(() => {
    function handleEvent() {
      setShortcutModalOpen(true);
    }
    window.addEventListener("kora:open-shortcut-modal", handleEvent);
    return () => window.removeEventListener("kora:open-shortcut-modal", handleEvent);
  }, []);

  useKeyboardShortcuts({
    onOpenSearch: handleOpenSearch,
    onOpenShortcutModal: handleOpenShortcutModal,
    onToggleWebVitals: handleToggleWebVitals,
  });

  return (
    <ShortcutReferenceModal
      open={shortcutModalOpen}
      onClose={() => setShortcutModalOpen(false)}
    />
  );
}
