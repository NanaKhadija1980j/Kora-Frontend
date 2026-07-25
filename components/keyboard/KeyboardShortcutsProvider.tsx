"use client";

import { useState, useCallback, useEffect } from "react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { ShortcutReferenceModal } from "./ShortcutReferenceModal";

/**
 * KeyboardShortcutsProvider
 *
 * Mounts the global keyboard shortcut listener and renders the shortcut
 * reference modal. Drop this inside <Providers> so it's available app-wide.
 *
 * Search (⌘K) is wired to a custom event so any search component can listen
 * without tight coupling. The Navbar keyboard icon also dispatches
 * "kora:open-shortcut-modal" which is handled here.
 *
 * Ctrl+Shift+V dispatches "kora:toggle-webvitals" (dev mode only).
 */
export function KeyboardShortcutsProvider() {
  const [shortcutModalOpen, setShortcutModalOpen] = useState(false);

  const handleOpenSearch = useCallback(() => {
    window.dispatchEvent(new CustomEvent("kora:open-search"));
  }, []);

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
